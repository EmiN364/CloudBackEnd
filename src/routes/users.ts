import bcrypt from 'bcryptjs';
import { Hono } from 'hono';
import pool from '../config/database.js';
import { authMiddleware, generateToken } from '../middleware/auth.js';
import { createUserSchema, loginSchema, updateUserSchema } from '../schemas/validation.js';

const users = new Hono();

// Register new user
users.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = createUserSchema.parse(body);
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND deleted = false',
      [validatedData.email]
    );
    
    if (existingUser.rows.length > 0) {
      return c.json({ error: 'User with this email already exists' }, 409);
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    
    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password, phone, first_name, last_name, is_seller, is_active, locale, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, email, first_name, last_name, is_seller, is_active, locale, address`,
      [
        validatedData.email,
        hashedPassword,
        validatedData.phone,
        validatedData.first_name,
        validatedData.last_name,
        validatedData.is_seller,
        validatedData.is_active,
        validatedData.locale,
        validatedData.address
      ]
    );
    
    const user = result.rows[0];
    const token = generateToken({
      id: user.id,
      email: user.email,
      is_seller: user.is_seller,
      is_active: user.is_active
    });
    
    return c.json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_seller: user.is_seller,
        is_active: user.is_active,
        locale: user.locale,
        address: user.address
      },
      token
    }, 201);
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Login user
users.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = loginSchema.parse(body);
    
    // Find user
    const result = await pool.query(
      'SELECT id, email, password, first_name, last_name, is_seller, is_active FROM users WHERE email = $1 AND deleted = false',
      [validatedData.email]
    );
    
    if (result.rows.length === 0) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    const user = result.rows[0];
    
    // Check password
    const isValidPassword = await bcrypt.compare(validatedData.password, user.password);
    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    if (!user.is_active) {
      return c.json({ error: 'Account is not active' }, 401);
    }
    
    const token = generateToken({
      id: user.id,
      email: user.email,
      is_seller: user.is_seller,
      is_active: user.is_active
    });
    
    return c.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_seller: user.is_seller,
        is_active: user.is_active
      },
      token
    });
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

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
