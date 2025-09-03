import { Hono } from 'hono';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { createProductLikeSchema } from '../schemas/validation.js';

const likes = new Hono();

// Get user's liked products
likes.get('/user/me', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    
    const offset = (page - 1) * limit;
    
    const result = await pool.query(
      `SELECT pl.product_id, pl.user_id,
              p.name, p.description, p.price, p.category,
              u.first_name, u.last_name,
              i.id as image_id
       FROM product_likes pl
       JOIN products p ON pl.product_id = p.id
       JOIN users u ON p.seller_id = u.id
       LEFT JOIN images i ON p.image_id = i.id
       WHERE pl.user_id = $1 AND p.deleted = false AND p.paused = false
       ORDER BY pl.product_id DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );
    
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM product_likes WHERE user_id = $1',
      [user.id]
    );
    
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    
    return c.json({
      liked_products: result.rows,
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

// Check if user likes a specific product
likes.get('/check/:productId', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const productId = parseInt(c.req.param('productId'));
    
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    const result = await pool.query(
      'SELECT 1 FROM product_likes WHERE user_id = $1 AND product_id = $2',
      [user.id, productId]
    );
    
    return c.json({
      liked: result.rows.length > 0
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Like a product
likes.post('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validatedData = createProductLikeSchema.parse(body);
    
    // Check if product exists and is available
    const productCheck = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND deleted = false AND paused = false',
      [validatedData.product_id]
    );
    
    if (productCheck.rows.length === 0) {
      return c.json({ error: 'Product not found or not available' }, 404);
    }
    
    // Check if already liked
    const existingLike = await pool.query(
      'SELECT 1 FROM product_likes WHERE user_id = $1 AND product_id = $2',
      [user.id, validatedData.product_id]
    );
    
    if (existingLike.rows.length > 0) {
      return c.json({ error: 'Product already liked' }, 409);
    }
    
    // Add like
    await pool.query(
      'INSERT INTO product_likes (user_id, product_id) VALUES ($1, $2)',
      [user.id, validatedData.product_id]
    );
    
    return c.json({
      message: 'Product liked successfully'
    }, 201);
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Unlike a product
likes.delete('/:productId', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const productId = parseInt(c.req.param('productId'));
    
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    const result = await pool.query(
      'DELETE FROM product_likes WHERE user_id = $1 AND product_id = $2 RETURNING product_id',
      [user.id, productId]
    );
    
    if (result.rows.length === 0) {
      return c.json({ error: 'Product not found in likes' }, 404);
    }
    
    return c.json({ message: 'Product unliked successfully' });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get product likes count (public)
likes.get('/product/:productId/count', async (c) => {
  try {
    const productId = parseInt(c.req.param('productId'));
    
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    const result = await pool.query(
      'SELECT COUNT(*) FROM product_likes WHERE product_id = $1',
      [productId]
    );
    
    const count = parseInt(result.rows[0].count);
    
    return c.json({ likes_count: count });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get users who liked a product (public, limited info)
likes.get('/product/:productId/users', async (c) => {
  try {
    const productId = parseInt(c.req.param('productId'));
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    const offset = (page - 1) * limit;
    
    const result = await pool.query(
      `SELECT u.first_name, u.last_name
       FROM product_likes pl
       JOIN users u ON pl.user_id = u.id
       WHERE pl.product_id = $1 AND u.deleted = false AND u.is_active = true
       ORDER BY pl.user_id
       LIMIT $2 OFFSET $3`,
      [productId, limit, offset]
    );
    
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM product_likes WHERE product_id = $1',
      [productId]
    );
    
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    
    return c.json({
      users: result.rows,
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

// Toggle like (like if not liked, unlike if already liked)
likes.post('/toggle/:productId', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const productId = parseInt(c.req.param('productId'));
    
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    // Check if product exists and is available
    const productCheck = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND deleted = false AND paused = false',
      [productId]
    );
    
    if (productCheck.rows.length === 0) {
      return c.json({ error: 'Product not found or not available' }, 404);
    }
    
    // Check current like status
    const existingLike = await pool.query(
      'SELECT 1 FROM product_likes WHERE user_id = $1 AND product_id = $2',
      [user.id, productId]
    );
    
    if (existingLike.rows.length > 0) {
      // Unlike
      await pool.query(
        'DELETE FROM product_likes WHERE user_id = $1 AND product_id = $2',
        [user.id, productId]
      );
      
      return c.json({
        message: 'Product unliked successfully',
        liked: false
      });
    } else {
      // Like
      await pool.query(
        'INSERT INTO product_likes (user_id, product_id) VALUES ($1, $2)',
        [user.id, productId]
      );
      
      return c.json({
        message: 'Product liked successfully',
        liked: true
      });
    }
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default likes;
