import { Hono } from 'hono';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { createNotificationSchema, updateNotificationSchema } from '../schemas/validation.js';

const notifications = new Hono();

// Get user's notifications
notifications.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const unreadOnly = c.req.query('unread') === 'true';
    
    let whereClause = 'WHERE user_id = $1';
    const values: any[] = [user.id];
    let paramCount = 2;
    
    if (unreadOnly) {
      whereClause += ` AND read = false`;
    }
    
    const offset = (page - 1) * limit;
    values.push(limit, offset);
    
    const result = await pool.query(
      `SELECT id, message, type, read, date, product_id
       FROM notifications
       ${whereClause}
       ORDER BY date DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values
    );
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM notifications ${whereClause}`,
      values.slice(0, -2)
    );
    
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);
    
    // Get unread count
    const unreadCountResult = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false',
      [user.id]
    );
    
    const unreadCount = parseInt(unreadCountResult.rows[0].count);
    
    return c.json({
      notifications: result.rows,
      unread_count: unreadCount,
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

// Get notification by ID
notifications.get('/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const notificationId = parseInt(c.req.param('id'));
    
    if (isNaN(notificationId)) {
      return c.json({ error: 'Invalid notification ID' }, 400);
    }
    
    const result = await pool.query(
      `SELECT id, message, type, read, date, product_id
       FROM notifications
       WHERE id = $1 AND user_id = $2`,
      [notificationId, user.id]
    );
    
    if (result.rows.length === 0) {
      return c.json({ error: 'Notification not found' }, 404);
    }
    
    // Mark as read if not already read
    if (!result.rows[0].read) {
      await pool.query(
        'UPDATE notifications SET read = true WHERE id = $1',
        [notificationId]
      );
      result.rows[0].read = true;
    }
    
    return c.json({ notification: result.rows[0] });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Mark notification as read
notifications.patch('/:id/read', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const notificationId = parseInt(c.req.param('id'));
    
    if (isNaN(notificationId)) {
      return c.json({ error: 'Invalid notification ID' }, 400);
    }
    
    const result = await pool.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [notificationId, user.id]
    );
    
    if (result.rows.length === 0) {
      return c.json({ error: 'Notification not found' }, 404);
    }
    
    return c.json({ message: 'Notification marked as read' });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Mark all notifications as read
notifications.patch('/read-all', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    await pool.query(
      'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
      [user.id]
    );
    
    return c.json({ message: 'All notifications marked as read' });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Create notification (admin/system use)
notifications.post('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validatedData = createNotificationSchema.parse(body);
    
    // For now, allow users to create notifications for themselves
    // In a real app, this might be restricted to admins
    const targetUserId = body.user_id || user.id;
    
    // Verify target user exists
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND deleted = false',
      [targetUserId]
    );
    
    if (userCheck.rows.length === 0) {
      return c.json({ error: 'Target user not found' }, 404);
    }
    
    const result = await pool.query(
      `INSERT INTO notifications (user_id, message, type, product_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, message, type, read, date, product_id`,
      [
        targetUserId,
        validatedData.message,
        validatedData.type,
        validatedData.product_id
      ]
    );
    
    return c.json({
      message: 'Notification created successfully',
      notification: result.rows[0]
    }, 201);
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update notification
notifications.put('/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const notificationId = parseInt(c.req.param('id'));
    
    if (isNaN(notificationId)) {
      return c.json({ error: 'Invalid notification ID' }, 400);
    }
    
    // Verify notification belongs to user
    const notificationCheck = await pool.query(
      'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, user.id]
    );
    
    if (notificationCheck.rows.length === 0) {
      return c.json({ error: 'Notification not found or access denied' }, 404);
    }
    
    const body = await c.req.json();
    const validatedData = updateNotificationSchema.parse(body);
    
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
    
    values.push(notificationId, user.id);
    
    const result = await pool.query(
      `UPDATE notifications SET ${updateFields.join(', ')}
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING id, message, type, read, date, product_id`,
      values
    );
    
    return c.json({
      message: 'Notification updated successfully',
      notification: result.rows[0]
    });
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete notification
notifications.delete('/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const notificationId = parseInt(c.req.param('id'));
    
    if (isNaN(notificationId)) {
      return c.json({ error: 'Invalid notification ID' }, 400);
    }
    
    // Verify notification belongs to user
    const notificationCheck = await pool.query(
      'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, user.id]
    );
    
    if (notificationCheck.rows.length === 0) {
      return c.json({ error: 'Notification not found or access denied' }, 404);
    }
    
    await pool.query(
      'DELETE FROM notifications WHERE id = $1',
      [notificationId]
    );
    
    return c.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Delete all read notifications
notifications.delete('/read', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    const result = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1 AND read = true RETURNING id',
      [user.id]
    );
    
    const deletedCount = result.rows.length;
    
    return c.json({ 
      message: `${deletedCount} read notifications deleted successfully` 
    });
  } catch (error) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default notifications;
