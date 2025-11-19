import { Hono } from 'hono';
import pool from '../config/database.js';
import { authMiddleware, sellerMiddleware } from '../middleware/auth.js';
import { createProductSchema, updateProductSchema } from '../schemas/validation.js';

const products = new Hono();

// Get all products (public)
products.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const category = c.req.query('category');
    const search = c.req.query('search');
    const seller_id = c.req.query('seller_id');
    
    let whereClause = 'WHERE p.deleted = false AND p.paused = false';
    const values: any[] = [];
    let paramCount = 1;
    
    if (category) {
      whereClause += ` AND p.category = $${paramCount}`;
      values.push(category);
      paramCount++;
    }
    
    if (search) {
      whereClause += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }
    
    if (seller_id) {
      whereClause += ` AND p.seller_id = $${paramCount}`;
      values.push(parseInt(seller_id));
      paramCount++;
    }
    
    const offset = (page - 1) * limit;
    values.push(limit, offset);

    console.log(`SELECT p.id, p.name, p.description, p.category, p.price, p.paused, p.image_url,
              u.first_name, u.last_name, u.id as seller_id,
       FROM products p
       LEFT JOIN users u ON p.seller_id = u.id
       ${whereClause}
       ORDER BY p.id DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values)
    
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.category, p.price, p.paused, p.image_url,
              u.first_name, u.last_name, u.id as seller_id
       FROM products p
       LEFT JOIN users u ON p.seller_id = u.id
       ${whereClause}
       ORDER BY p.id DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values
    );

    console.log("result", result);
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM products p ${whereClause}`,
      values.slice(0, -2)
    );
    
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    
    return c.json({
      products: result.rows,
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
    console.error(error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get product by ID (public)
products.get('/:id', async (c) => {
  try {
    const productId = parseInt(c.req.param('id'));
    
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.category, p.price, p.paused, p.image_url,
              u.first_name, u.last_name, u.id as seller_id,
              s.store_name, s.description as store_description
       FROM products p
       LEFT JOIN users u ON p.seller_id = u.id
       LEFT JOIN stores s ON p.seller_id = s.store_id
       WHERE p.id = $1 AND p.deleted = false`,
      [productId]
    );
    console.log(result)
    
    if (result.rows.length === 0) {
      return c.json({ error: 'Product not found' }, 404);
    }
    
    // Get reviews
    const reviewsResult = await pool.query(
      `SELECT r.id, r.description, r.rating, r.timestamp,
              u.first_name, u.last_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1
       ORDER BY r.timestamp DESC
       LIMIT 10`,
      [productId]
    );
    
    const product = result.rows[0];
    product.reviews = reviewsResult.rows;
    
    return c.json({ product });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create product (seller only)
products.post('/', authMiddleware, sellerMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = createProductSchema.parse(body);

    // Check if user already exists
    const existingUser = await pool.query<{ id: number }>(
      'SELECT id FROM users WHERE email = $1',
      [validatedData.email]
    );

    let userId;
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
    } else {
      const newUser = await pool.query<{ id: number }>(
        `INSERT INTO users (email) VALUES ($1) RETURNING id`,
        [validatedData.email]
      );
      userId = newUser.rows[0].id;
      await pool.query<{ id: number }>(
        `INSERT INTO stores (store_id, store_name) VALUES ($1, $2)`,
        [userId, validatedData.store_name]
      );
    }
    
    const result = await pool.query(
      `INSERT INTO products (name, description, category, seller_id, image_url, price)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, category, price, seller_id, image_url`,
      [
        validatedData.name,
        validatedData.description,
        validatedData.category,
        userId,
        validatedData.image_url,
        validatedData.price
      ]
    );
    
    return c.json({
      message: 'Product created successfully',
      product: result.rows[0]
    }, 201);
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update product (seller only, own products)
products.put('/:id', authMiddleware, sellerMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const productId = parseInt(c.req.param('id'));
    
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    // Verify product belongs to user
    const productCheck = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND seller_id = $2 AND deleted = false',
      [productId, user.id]
    );
    
    if (productCheck.rows.length === 0) {
      return c.json({ error: 'Product not found or access denied' }, 404);
    }
    
    const body = await c.req.json();
    const validatedData = updateProductSchema.parse(body);
    
    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    Object.entries(validatedData).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });
    
    if (updateFields.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }
    
    values.push(productId, user.id);
    
    const result = await pool.query(
      `UPDATE products SET ${updateFields.join(', ')}
       WHERE id = $${paramCount} AND seller_id = $${paramCount + 1} AND deleted = false
        RETURNING id, name, description, category, price, seller_id, image_url, paused`,
      values
    );
    
    return c.json({
      message: 'Product updated successfully',
      product: result.rows[0]
    });
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete product (seller only, own products)
products.delete('/:id', authMiddleware, sellerMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const productId = parseInt(c.req.param('id'));
    
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    // Verify product belongs to user
    const productCheck = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND seller_id = $2 AND deleted = false',
      [productId, user.id]
    );
    
    if (productCheck.rows.length === 0) {
      return c.json({ error: 'Product not found or access denied' }, 404);
    }
    
    await pool.query(
      'UPDATE products SET deleted = true WHERE id = $1',
      [productId]
    );
    
    return c.json({ message: 'Product deleted successfully' });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Pause/Unpause product (seller only, own products)
products.patch('/:id/pause', authMiddleware, sellerMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const productId = parseInt(c.req.param('id'));
    
    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }
    
    // Verify product belongs to user
    const productCheck = await pool.query(
      'SELECT id, paused FROM products WHERE id = $1 AND seller_id = $2 AND deleted = false',
      [productId, user.id]
    );
    
    if (productCheck.rows.length === 0) {
      return c.json({ error: 'Product not found or access denied' }, 404);
    }
    
    const currentPaused = productCheck.rows[0].paused;
    const newPaused = !currentPaused;
    
    await pool.query(
      'UPDATE products SET paused = $1 WHERE id = $2',
      [newPaused, productId]
    );
    
    return c.json({
      message: `Product ${newPaused ? 'paused' : 'unpaused'} successfully`,
      paused: newPaused
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get seller's products
products.get('/seller/me', authMiddleware, sellerMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    
    const offset = (page - 1) * limit;
    
    const result = await pool.query(
      `SELECT id, name, description, category, price, paused, deleted
       FROM products
       WHERE seller_id = $1
       ORDER BY id DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );
    
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM products WHERE seller_id = $1',
      [user.id]
    );
    
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    
    return c.json({
      products: result.rows,
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

export default products;
