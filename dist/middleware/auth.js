import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
export const authMiddleware = async (c, next) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Access token required' }, 401);
        }
        const token = authHeader.substring(7);
        const secret = process.env.JWT_SECRET || 'fallback_secret';
        const decoded = jwt.verify(token, secret);
        if (!decoded || !decoded.id) {
            return c.json({ error: 'Invalid token' }, 401);
        }
        // Verify user still exists and is active
        const result = await pool.query('SELECT id, email, is_seller, is_active FROM users WHERE id = $1 AND deleted = false', [decoded.id]);
        if (result.rows.length === 0) {
            return c.json({ error: 'User not found' }, 401);
        }
        const user = result.rows[0];
        if (!user.is_active) {
            return c.json({ error: 'User account is not active' }, 401);
        }
        c.set('user', user);
        await next();
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        return c.json({ error: 'Invalid token' }, 401);
    }
};
export const sellerMiddleware = async (c, next) => {
    const user = c.get('user');
    if (!user.is_seller) {
        return c.json({ error: 'Seller access required' }, 403);
    }
    await next();
};
export const generateToken = (user) => {
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    return jwt.sign({ id: user.id, email: user.email, is_seller: user.is_seller }, secret, { expiresIn: expiresIn });
};
