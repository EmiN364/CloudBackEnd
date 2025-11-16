import { Hono } from 'hono';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { createSaleProductSchema, createSaleSchema, updateSaleSchema } from '../schemas/validation.js';

const sales = new Hono();

// Get user's purchases (compras del usuario)
sales.get('/purchases', authMiddleware, async (c) => {
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
      purchases: salesWithProducts,
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

// Get seller's sales (ventas del vendedor)
sales.get('/seller', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    
    const offset = (page - 1) * limit;
    
    // Get sales where the seller's products are included
    const result = await pool.query(
      `SELECT DISTINCT s.id, s.date, s.total, s.status, s.note, s.invoice_id, s.address,
              u.first_name, u.last_name, u.id as buyer_id
       FROM sales s
       JOIN sales_products sp ON s.id = sp.sale_id
       JOIN products p ON sp.product_id = p.id
       JOIN users u ON s.user_id = u.id
       WHERE p.seller_id = $1
       ORDER BY s.date DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT s.id)
       FROM sales s
       JOIN sales_products sp ON s.id = sp.sale_id
       JOIN products p ON sp.product_id = p.id
       WHERE p.seller_id = $1`,
      [user.id]
    );
    
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    
    // Get products for each sale
    const salesWithProducts = await Promise.all(
      result.rows.map(async (sale) => {
        const productsResult = await pool.query(
          `SELECT sp.product_id, sp.price, sp.amount,
                  p.name, p.description, p.seller_id
           FROM sales_products sp
           JOIN products p ON sp.product_id = p.id
           WHERE sp.sale_id = $1 AND p.seller_id = $2`,
          [sale.id, user.id]
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

// Get user's sales history (mantener compatibilidad, ahora usa purchases)
sales.get('/', authMiddleware, async (c) => {
  // Usar la misma lógica que purchases para mantener compatibilidad
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
    
    // Verify sale belongs to user (buyer) and can be cancelled
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

// Mark sale as preparing (seller only)
sales.patch('/:id/prepare', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const saleId = parseInt(c.req.param('id'));
    
    if (isNaN(saleId)) {
      return c.json({ error: 'Invalid sale ID' }, 400);
    }
    
    // Verify sale has seller's products
    const saleCheck = await pool.query(
      `SELECT s.id, s.status
       FROM sales s
       JOIN sales_products sp ON s.id = sp.sale_id
       JOIN products p ON sp.product_id = p.id
       WHERE s.id = $1 AND p.seller_id = $2
       LIMIT 1`,
      [saleId, user.id]
    );
    
    if (saleCheck.rows.length === 0) {
      return c.json({ error: 'Sale not found or access denied' }, 404);
    }
    
    await pool.query(
      'UPDATE sales SET status = $1 WHERE id = $2',
      ['preparing', saleId]
    );
    
    return c.json({
      message: 'Sale marked as preparing',
      status: 'preparing'
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Mark sale as shipped (seller only)
sales.patch('/:id/ship', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const saleId = parseInt(c.req.param('id'));
    
    if (isNaN(saleId)) {
      return c.json({ error: 'Invalid sale ID' }, 400);
    }
    
    // Verify sale has seller's products
    const saleCheck = await pool.query(
      `SELECT s.id, s.status
       FROM sales s
       JOIN sales_products sp ON s.id = sp.sale_id
       JOIN products p ON sp.product_id = p.id
       WHERE s.id = $1 AND p.seller_id = $2
       LIMIT 1`,
      [saleId, user.id]
    );
    
    if (saleCheck.rows.length === 0) {
      return c.json({ error: 'Sale not found or access denied' }, 404);
    }
    
    await pool.query(
      'UPDATE sales SET status = $1 WHERE id = $2',
      ['shipped', saleId]
    );
    
    return c.json({
      message: 'Sale marked as shipped',
      status: 'shipped'
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Mark sale as delivered (seller only)
sales.patch('/:id/delivery', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const saleId = parseInt(c.req.param('id'));
    
    if (isNaN(saleId)) {
      return c.json({ error: 'Invalid sale ID' }, 400);
    }
    
    // Verify sale has seller's products
    const saleCheck = await pool.query(
      `SELECT s.id, s.status
       FROM sales s
       JOIN sales_products sp ON s.id = sp.sale_id
       JOIN products p ON sp.product_id = p.id
       WHERE s.id = $1 AND p.seller_id = $2
       LIMIT 1`,
      [saleId, user.id]
    );
    
    if (saleCheck.rows.length === 0) {
      return c.json({ error: 'Sale not found or access denied' }, 404);
    }
    
    await pool.query(
      'UPDATE sales SET status = $1 WHERE id = $2',
      ['delivered', saleId]
    );
    
    return c.json({
      message: 'Sale marked as delivered',
      status: 'delivered'
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Mark sale as received (buyer only)
sales.patch('/:id/receive', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const saleId = parseInt(c.req.param('id'));
    
    if (isNaN(saleId)) {
      return c.json({ error: 'Invalid sale ID' }, 400);
    }
    
    // Verify sale belongs to user (buyer)
    const saleCheck = await pool.query(
      'SELECT id, status FROM sales WHERE id = $1 AND user_id = $2',
      [saleId, user.id]
    );
    
    if (saleCheck.rows.length === 0) {
      return c.json({ error: 'Sale not found or access denied' }, 404);
    }
    
    await pool.query(
      'UPDATE sales SET status = $1 WHERE id = $2',
      ['received', saleId]
    );
    
    return c.json({
      message: 'Sale marked as received',
      status: 'received'
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Upload invoice (buyer only)
sales.post('/:id/invoice', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const saleId = parseInt(c.req.param('id'));
    
    if (isNaN(saleId)) {
      return c.json({ error: 'Invalid sale ID' }, 400);
    }
    
    // Verify sale belongs to user (buyer)
    const saleCheck = await pool.query(
      'SELECT id FROM sales WHERE id = $1 AND user_id = $2',
      [saleId, user.id]
    );
    
    if (saleCheck.rows.length === 0) {
      return c.json({ error: 'Sale not found or access denied' }, 404);
    }
    
    const body = await c.req.json();
    const { invoice_id } = body;
    
    if (!invoice_id) {
      return c.json({ error: 'Invoice ID is required' }, 400);
    }
    
    await pool.query(
      'UPDATE sales SET invoice_id = $1 WHERE id = $2',
      [invoice_id, saleId]
    );
    
    return c.json({
      message: 'Invoice uploaded successfully',
      invoice_id: invoice_id
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Approve invoice (seller only)
sales.patch('/:id/approve-invoice', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const saleId = parseInt(c.req.param('id'));
    
    if (isNaN(saleId)) {
      return c.json({ error: 'Invalid sale ID' }, 400);
    }
    
    // Verify sale has seller's products
    const saleCheck = await pool.query(
      `SELECT s.id, s.status
       FROM sales s
       JOIN sales_products sp ON s.id = sp.sale_id
       JOIN products p ON sp.product_id = p.id
       WHERE s.id = $1 AND p.seller_id = $2
       LIMIT 1`,
      [saleId, user.id]
    );
    
    if (saleCheck.rows.length === 0) {
      return c.json({ error: 'Sale not found or access denied' }, 404);
    }
    
    await pool.query(
      'UPDATE sales SET status = $1 WHERE id = $2',
      ['paid', saleId]
    );
    
    return c.json({
      message: 'Invoice approved successfully',
      status: 'paid'
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Reject invoice (seller only)
sales.patch('/:id/reject-invoice', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const saleId = parseInt(c.req.param('id'));
    
    if (isNaN(saleId)) {
      return c.json({ error: 'Invalid sale ID' }, 400);
    }
    
    // Verify sale has seller's products
    const saleCheck = await pool.query(
      `SELECT s.id, s.status
       FROM sales s
       JOIN sales_products sp ON s.id = sp.sale_id
       JOIN products p ON sp.product_id = p.id
       WHERE s.id = $1 AND p.seller_id = $2
       LIMIT 1`,
      [saleId, user.id]
    );
    
    if (saleCheck.rows.length === 0) {
      return c.json({ error: 'Sale not found or access denied' }, 404);
    }
    
    await pool.query(
      'UPDATE sales SET status = $1 WHERE id = $2',
      ['rejected', saleId]
    );
    
    return c.json({
      message: 'Invoice rejected',
      status: 'rejected'
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default sales;
