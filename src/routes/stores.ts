import { Hono } from 'hono';
import pool from '../config/database.js';
import { authMiddleware, sellerMiddleware } from '../middleware/auth.js';
import { createStoreSchema, updateStoreSchema } from '../schemas/validation.js';

const stores = new Hono();

// Get all stores (public)
stores.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const search = c.req.query('search');
    
    let whereClause = 'WHERE s.store_id IN (SELECT id FROM users WHERE deleted = false AND is_active = true)';
    const values: any[] = [];
    let paramCount = 1;
    
    if (search) {
      whereClause += ` AND (s.store_name ILIKE $${paramCount} OR s.description ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }
    
    const offset = (page - 1) * limit;
    values.push(limit, offset);
    
    const result = await pool.query(
      `SELECT s.store_id, s.store_name, s.description, s.cbu,
              u.first_name, u.last_name, u.email,
              si.id as store_image_id, ci.id as cover_image_id
       FROM stores s
       JOIN users u ON s.store_id = u.id
       LEFT JOIN images si ON s.store_image_id = si.id
       LEFT JOIN images ci ON s.cover_image_id = ci.id
       ${whereClause}
       ORDER BY s.store_id DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values
    );
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM stores s ${whereClause}`,
      values.slice(0, -2)
    );
    
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    
    return c.json({
      stores: result.rows,
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

// Get store by ID (public)
stores.get('/:id', async (c) => {
  try {
    const storeId = parseInt(c.req.param('id'));
    
    if (isNaN(storeId)) {
      return c.json({ error: 'Invalid store ID' }, 400);
    }
    
    const result = await pool.query(
      `SELECT s.store_id, s.store_name, s.description, s.cbu,
              u.first_name, u.last_name, u.email, u.locale, u.address,
              si.id as store_image_id, ci.id as cover_image_id
       FROM stores s
       JOIN users u ON s.store_id = u.id
       LEFT JOIN images si ON s.store_image_id = si.id
       LEFT JOIN images ci ON s.cover_image_id = ci.id
       WHERE s.store_id = $1 AND u.deleted = false AND u.is_active = true`,
      [storeId]
    );
    
    if (result.rows.length === 0) {
      return c.json({ error: 'Store not found' }, 404);
    }
    
    // Get store products count
    const productsCountResult = await pool.query(
      'SELECT COUNT(*) FROM products WHERE seller_id = $1 AND deleted = false AND paused = false',
      [storeId]
    );
    
    const store = result.rows[0];
    store.products_count = parseInt(productsCountResult.rows[0].count);
    
    return c.json({ store });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create store (seller only)
stores.post('/', authMiddleware, sellerMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    // Check if store already exists
    const existingStore = await pool.query(
      'SELECT store_id FROM stores WHERE store_id = $1',
      [user.id]
    );
    
    if (existingStore.rows.length > 0) {
      return c.json({ error: 'Store already exists for this user' }, 409);
    }
    
    const body = await c.req.json();
    const validatedData = createStoreSchema.parse(body);
    
    const result = await pool.query(
      `INSERT INTO stores (store_id, store_name, description, store_image_id, cover_image_id, cbu)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING store_id, store_name, description, store_image_id, cover_image_id, cbu`,
      [
        user.id,
        validatedData.store_name,
        validatedData.description,
        validatedData.store_image_id,
        validatedData.cover_image_id,
        validatedData.cbu
      ]
    );
    
    return c.json({
      message: 'Store created successfully',
      store: result.rows[0]
    }, 201);
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update store (seller only, own store)
stores.put('/:id', authMiddleware, sellerMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const storeId = parseInt(c.req.param('id'));
    
    if (isNaN(storeId)) {
      return c.json({ error: 'Invalid store ID' }, 400);
    }
    
    if (storeId !== user.id) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Verify store exists
    const storeCheck = await pool.query(
      'SELECT store_id FROM stores WHERE store_id = $1',
      [storeId]
    );
    
    if (storeCheck.rows.length === 0) {
      return c.json({ error: 'Store not found' }, 404);
    }
    
    const body = await c.req.json();
    const validatedData = updateStoreSchema.parse(body);
    
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
    
    values.push(storeId);
    
    const result = await pool.query(
      `UPDATE stores SET ${updateFields.join(', ')}
       WHERE store_id = $${paramCount}
       RETURNING store_id, store_name, description, store_image_id, cover_image_id, cbu`,
      values
    );
    
    return c.json({
      message: 'Store updated successfully',
      store: result.rows[0]
    });
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get current user's store
stores.get('/me/store', authMiddleware, sellerMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    const result = await pool.query(
      `SELECT s.store_id, s.store_name, s.description, s.cbu,
              si.id as store_image_id, ci.id as cover_image_id
       FROM stores s
       LEFT JOIN images si ON s.store_image_id = si.id
       LEFT JOIN images ci ON s.cover_image_id = ci.id
       WHERE s.store_id = $1`,
      [user.id]
    );
    
    if (result.rows.length === 0) {
      return c.json({ error: 'Store not found' }, 404);
    }
    
    // Get store statistics
    const productsCountResult = await pool.query(
      'SELECT COUNT(*) FROM products WHERE seller_id = $1 AND deleted = false',
      [user.id]
    );
    
    const activeProductsCountResult = await pool.query(
      'SELECT COUNT(*) FROM products WHERE seller_id = $1 AND deleted = false AND paused = false',
      [user.id]
    );
    
    const store = result.rows[0];
    store.stats = {
      total_products: parseInt(productsCountResult.rows[0].count),
      active_products: parseInt(activeProductsCountResult.rows[0].count)
    };
    
    return c.json({ store });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete store (seller only, own store)
stores.delete('/:id', authMiddleware, sellerMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const storeId = parseInt(c.req.param('id'));
    
    if (isNaN(storeId)) {
      return c.json({ error: 'Invalid store ID' }, 400);
    }
    
    if (storeId !== user.id) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    // Verify store exists
    const storeCheck = await pool.query(
      'SELECT store_id FROM stores WHERE store_id = $1',
      [storeId]
    );
    
    if (storeCheck.rows.length === 0) {
      return c.json({ error: 'Store not found' }, 404);
    }
    
    await pool.query(
      'DELETE FROM stores WHERE store_id = $1',
      [storeId]
    );
    
    return c.json({ message: 'Store deleted successfully' });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default stores;
