import { Hono } from 'hono';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { createSaleProductSchema, createSaleSchema, updateSaleSchema } from '../schemas/validation.js';

const sales = new Hono();

// Get user's sales history
sales.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    
    const offset = (page - 1) * limit;
    
    const result = await pool.query(
      `SELECT s.id, s.date, s.total, s.status, s.note, s.invoice_id, s.address
       FROM sales s
       WHERE s.user_id = $1
       ORDER BY s.date DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );
    
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM sales WHERE user_id = $1',
      [user.id]
    );
    
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    
    // Get products for each sale
    const salesWithProducts = await Promise.all(
      result.rows.map(async (sale) => {
        const productsResult = await pool.query(
          `SELECT sp.product_id, sp.price, sp.amount,
                  p.name, p.description,
                  u.first_name, u.last_name
           FROM sales_products sp
           JOIN products p ON sp.product_id = p.id
           JOIN users u ON p.seller_id = u.id
           WHERE sp.sale_id = $1`,
          [sale.id]
        );
        
        return {
          ...sale,
          products: productsResult.rows
        };
      })
    );
    
    return c.json({
      sales: salesWithProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get sale by ID
sales.get('/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const saleId = parseInt(c.req.param('id'));
    
    if (isNaN(saleId)) {
      return c.json({ error: 'Invalid sale ID' }, 400);
    }
    
    const result = await pool.query(
      `SELECT s.id, s.date, s.total, s.status, s.note, s.invoice_id, s.address
       FROM sales s
       WHERE s.id = $1 AND s.user_id = $2`,
      [saleId, user.id]
    );
    
    if (result.rows.length === 0) {
      return c.json({ error: 'Sale not found' }, 404);
    }
    
    const sale = result.rows[0];
    
    // Get products for this sale
    const productsResult = await pool.query(
      `SELECT sp.product_id, sp.price, sp.amount,
              p.name, p.description,
              u.first_name, u.last_name
       FROM sales_products sp
       JOIN products p ON sp.product_id = p.id
       JOIN users u ON p.seller_id = u.id
       WHERE sp.sale_id = $1`,
      [saleId]
    );
    
    sale.products = productsResult.rows;
    
    return c.json({ sale });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create new sale (checkout from cart)
sales.post('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validatedData = createSaleSchema.parse(body);
    
    // Get user's cart
    const cartResult = await pool.query(
      `SELECT cp.product_id, cp.amount, p.price, p.name, p.seller_id
       FROM cart_products cp
       JOIN products p ON cp.product_id = p.id
       WHERE cp.user_id = $1 AND p.deleted = false AND p.paused = false`,
      [user.id]
    );
    
    if (cartResult.rows.length === 0) {
      return c.json({ error: 'Cart is empty' }, 400);
    }
    
    // Calculate total
    let total = 0;
    cartResult.rows.forEach(item => {
      total += item.price * item.amount;
    });
    
    // Validate total matches
    if (Math.abs(total - validatedData.total) > 0.01) {
      return c.json({ error: 'Total amount mismatch' }, 400);
    }
    
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create sale
      const saleResult = await client.query(
        `INSERT INTO sales (user_id, total, status, note, invoice_id, address)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          user.id,
          total,
          validatedData.status || 'pending',
          validatedData.note,
          validatedData.invoice_id,
          validatedData.address
        ]
      );
      
      const saleId = saleResult.rows[0].id;
      
      // Create sale products
      for (const item of cartResult.rows) {
        await client.query(
          'INSERT INTO sales_products (sale_id, product_id, price, amount) VALUES ($1, $2, $3, $4)',
          [saleId, item.product_id, item.price, item.amount]
        );
      }
      
      // Clear cart
      await client.query(
        'DELETE FROM cart_products WHERE user_id = $1',
        [user.id]
      );
      
      await client.query('COMMIT');
      
      return c.json({
        message: 'Sale created successfully',
        sale_id: saleId,
        total: total
      }, 201);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update sale status
sales.put('/:id/status', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const saleId = parseInt(c.req.param('id'));
    
    if (isNaN(saleId)) {
      return c.json({ error: 'Invalid sale ID' }, 400);
    }
    
    const body = await c.req.json();
    const { status } = body;
    
    if (!status || typeof status !== 'string') {
      return c.json({ error: 'Status is required' }, 400);
    }
    
    // Verify sale belongs to user
    const saleCheck = await pool.query(
      'SELECT id FROM sales WHERE id = $1 AND user_id = $2',
      [saleId, user.id]
    );
    
    if (saleCheck.rows.length === 0) {
      return c.json({ error: 'Sale not found' }, 404);
    }
    
    await pool.query(
      'UPDATE sales SET status = $1 WHERE id = $2',
      [status, saleId]
    );
    
    return c.json({
      message: 'Sale status updated successfully',
      status: status
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get sales statistics
sales.get('/stats/summary', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_sales,
         SUM(total) as total_spent,
         AVG(total) as average_order,
         MIN(date) as first_order,
         MAX(date) as last_order
       FROM sales
       WHERE user_id = $1`,
      [user.id]
    );
    
    const stats = result.rows[0];
    
    return c.json({
      total_sales: parseInt(stats.total_sales || '0'),
      total_spent: parseFloat(stats.total_spent || '0'),
      average_order: parseFloat(stats.average_order || '0'),
      first_order: stats.first_order,
      last_order: stats.last_order
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Cancel sale (if status allows)
sales.patch('/:id/cancel', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const saleId = parseInt(c.req.param('id'));
    
    if (isNaN(saleId)) {
      return c.json({ error: 'Invalid sale ID' }, 400);
    }
    
    // Verify sale belongs to user and can be cancelled
    const saleCheck = await pool.query(
      'SELECT id, status FROM sales WHERE id = $1 AND user_id = $2',
      [saleId, user.id]
    );
    
    if (saleCheck.rows.length === 0) {
      return c.json({ error: 'Sale not found' }, 404);
    }
    
    const sale = saleCheck.rows[0];
    
    // Only allow cancellation of pending sales
    if (sale.status !== 'pending') {
      return c.json({ error: 'Sale cannot be cancelled in current status' }, 400);
    }
    
    await pool.query(
      'UPDATE sales SET status = $1 WHERE id = $2',
      ['cancelled', saleId]
    );
    
    return c.json({
      message: 'Sale cancelled successfully',
      status: 'cancelled'
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default sales;
