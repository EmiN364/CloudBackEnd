import { Hono } from 'hono';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { createCartProductSchema } from '../schemas/validation.js';

const cart = new Hono();

// Get user's cart
cart.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    const result = await pool.query(
      `SELECT cp.product_id, cp.amount,
              p.name, p.description, p.price, p.paused,
              u.first_name, u.last_name,
       FROM cart_products cp
       JOIN products p ON cp.product_id = p.id
       JOIN users u ON p.seller_id = u.id
       WHERE cp.user_id = $1 AND p.deleted = false AND p.paused = false
       ORDER BY cp.product_id`,
      [user.id]
    );
    
    // Calculate totals
    let total = 0;
    const cartItems = result.rows.map(item => {
      const itemTotal = item.price * item.amount;
      total += itemTotal;
      return {
        ...item,
        item_total: itemTotal
      };
    });
    
    return c.json({
      cart: cartItems,
      total: total,
      item_count: cartItems.length
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Add product to cart
cart.post('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validatedData = createCartProductSchema.parse(body);
    
    // Check if product exists and is available
    const productCheck = await pool.query(
      'SELECT id, price, paused, deleted FROM products WHERE id = $1',
      [validatedData.product_id]
    );
    
    if (productCheck.rows.length === 0) {
      return c.json({ error: 'Product not found' }, 404);
    }
    
    const product = productCheck.rows[0];
    
    if (product.deleted) {
      return c.json({ error: 'Product is no longer available' }, 400);
    }
    
    if (product.paused) {
      return c.json({ error: 'Product is currently paused' }, 400);
    }
    
    // Check if product is already in cart
    const existingCartItem = await pool.query(
      'SELECT amount FROM cart_products WHERE user_id = $1 AND product_id = $2',
      [user.id, validatedData.product_id]
    );
    
    if (existingCartItem.rows.length > 0) {
      // Update amount
      const newAmount = existingCartItem.rows[0].amount + validatedData.amount;
      
      await pool.query(
        'UPDATE cart_products SET amount = $1 WHERE user_id = $2 AND product_id = $3',
        [newAmount, user.id, validatedData.product_id]
      );
      
      return c.json({
        message: 'Cart updated successfully',
        amount: newAmount
      });
    } else {
      // Add new item
      await pool.query(
        'INSERT INTO cart_products (user_id, product_id, amount) VALUES ($1, $2, $3)',
        [user.id, validatedData.product_id, validatedData.amount]
      );
      
      return c.json({
        message: 'Product added to cart successfully',
        amount: validatedData.amount
      }, 201);
    }
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update cart item amount
cart.put('/:productId', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const productId = parseInt(c.req.param('productId'));
    
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    const body = await c.req.json();
    const { amount } = body;
    
    if (typeof amount !== 'number' || amount < 1) {
      return c.json({ error: 'Amount must be a positive number' }, 400);
    }
    
    // Check if item exists in cart
    const cartItemCheck = await pool.query(
      'SELECT cp.amount, p.paused, p.deleted FROM cart_products cp JOIN products p ON cp.product_id = p.id WHERE cp.user_id = $1 AND cp.product_id = $2',
      [user.id, productId]
    );
    
    if (cartItemCheck.rows.length === 0) {
      return c.json({ error: 'Product not found in cart' }, 404);
    }
    
    const cartItem = cartItemCheck.rows[0];
    
    if (cartItem.deleted) {
      return c.json({ error: 'Product is no longer available' }, 400);
    }
    
    if (cartItem.paused) {
      return c.json({ error: 'Product is currently paused' }, 400);
    }
    
    // Update amount
    await pool.query(
      'UPDATE cart_products SET amount = $1 WHERE user_id = $2 AND product_id = $3',
      [amount, user.id, productId]
    );
    
    return c.json({
      message: 'Cart updated successfully',
      amount: amount
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Remove product from cart
cart.delete('/:productId', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const productId = parseInt(c.req.param('productId'));
    
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    const result = await pool.query(
      'DELETE FROM cart_products WHERE user_id = $1 AND product_id = $2 RETURNING product_id',
      [user.id, productId]
    );
    
    if (result.rows.length === 0) {
      return c.json({ error: 'Product not found in cart' }, 404);
    }
    
    return c.json({ message: 'Product removed from cart successfully' });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Clear entire cart
cart.delete('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    await pool.query(
      'DELETE FROM cart_products WHERE user_id = $1',
      [user.id]
    );
    
    return c.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get cart summary (count and total)
cart.get('/summary', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    const result = await pool.query(
      `SELECT COUNT(*) as item_count, SUM(cp.amount * p.price) as total
       FROM cart_products cp
       JOIN products p ON cp.product_id = p.id
       WHERE cp.user_id = $1 AND p.deleted = false AND p.paused = false`,
      [user.id]
    );
    
    const summary = result.rows[0];
    
    return c.json({
      item_count: parseInt(summary.item_count || '0'),
      total: parseFloat(summary.total || '0')
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Increase product amount in cart
cart.post('/increase', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { product_id } = body;
    
    if (!product_id) {
      return c.json({ error: 'Product ID is required' }, 400);
    }
    
    const productId = parseInt(product_id);
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    // Check if product exists in cart
    const cartItemCheck = await pool.query(
      'SELECT amount FROM cart_products WHERE user_id = $1 AND product_id = $2',
      [user.id, productId]
    );
    
    if (cartItemCheck.rows.length === 0) {
      return c.json({ error: 'Product not found in cart' }, 404);
    }
    
    const newAmount = cartItemCheck.rows[0].amount + 1;
    
    await pool.query(
      'UPDATE cart_products SET amount = $1 WHERE user_id = $2 AND product_id = $3',
      [newAmount, user.id, productId]
    );
    
    return c.json({
      message: 'Product amount increased',
      amount: newAmount
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Decrease product amount in cart
cart.post('/decrease', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { product_id } = body;
    
    if (!product_id) {
      return c.json({ error: 'Product ID is required' }, 400);
    }
    
    const productId = parseInt(product_id);
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    // Check if product exists in cart
    const cartItemCheck = await pool.query(
      'SELECT amount FROM cart_products WHERE user_id = $1 AND product_id = $2',
      [user.id, productId]
    );
    
    if (cartItemCheck.rows.length === 0) {
      return c.json({ error: 'Product not found in cart' }, 404);
    }
    
    const currentAmount = cartItemCheck.rows[0].amount;
    
    if (currentAmount <= 1) {
      // Remove from cart if amount is 1
      await pool.query(
        'DELETE FROM cart_products WHERE user_id = $1 AND product_id = $2',
        [user.id, productId]
      );
      
      return c.json({
        message: 'Product removed from cart',
        amount: 0
      });
    }
    
    const newAmount = currentAmount - 1;
    
    await pool.query(
      'UPDATE cart_products SET amount = $1 WHERE user_id = $2 AND product_id = $3',
      [newAmount, user.id, productId]
    );
    
    return c.json({
      message: 'Product amount decreased',
      amount: newAmount
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Buy cart (checkout)
cart.post('/buy', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { note, address } = body;
    
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
    
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create sale
      const saleResult = await client.query(
        `INSERT INTO sales (user_id, total, status, note, address)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          user.id,
          total,
          'pending',
          note || null,
          address || ''
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
        message: 'Purchase completed successfully',
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

export default cart;
