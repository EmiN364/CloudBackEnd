import { Hono } from 'hono';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { updateUserSchema } from '../schemas/validation.js';

const users = new Hono();

// Note: Registration and login are handled by AWS Cognito Hosted UI
// Users are automatically created in the database when they first authenticate via authMiddleware

// Get current user profile
users.get('/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    const result = await pool.query(
      `SELECT id, email, phone, first_name, last_name, is_seller, is_active, locale, address
       FROM users WHERE id = $1 AND deleted = false`,
      [user.id]
    );
    
    if (result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json({ user: result.rows[0] });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update user profile
users.put('/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validatedData = updateUserSchema.parse(body);
    
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
    
    values.push(user.id);
    
    const result = await pool.query(
      `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount} AND deleted = false
       RETURNING id, email, phone, first_name, last_name, is_seller, is_active, locale, address`,
      values
    );
    
    if (result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user by ID (public info only)
users.get('/:id', async (c) => {
  try {
    const userId = parseInt(c.req.param('id'));
    
    if (isNaN(userId)) {
      return c.json({ error: 'Invalid user ID' }, 400);
    }
    
    const result = await pool.query(
      `SELECT id, first_name, last_name, is_seller, locale, address
       FROM users WHERE id = $1 AND deleted = false AND is_active = true`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json({ user: result.rows[0] });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Promote user to seller
users.post('/promote-to-seller', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    if (user.is_seller) {
      return c.json({ error: 'User is already a seller' }, 400);
    }
    
    const result = await pool.query(
      `UPDATE users SET is_seller = true 
       WHERE id = $1 AND deleted = false
       RETURNING id, email, phone, first_name, last_name, is_seller, is_active, locale, address`,
      [user.id]
    );
    
    if (result.rows.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json({
      message: 'User promoted to seller successfully',
      user: result.rows[0]
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete user (soft delete)
users.delete('/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    await pool.query(
      'UPDATE users SET deleted = true WHERE id = $1',
      [user.id]
    );
    
    return c.json({ message: 'Account deleted successfully' });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default users;
