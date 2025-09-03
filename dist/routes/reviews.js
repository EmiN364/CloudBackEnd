import { Hono } from 'hono';
import pool from '../config/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { createReviewSchema, updateReviewSchema } from '../schemas/validation.js';
const reviews = new Hono();
// Get reviews for a product (public)
reviews.get('/product/:productId', async (c) => {
    try {
        const productId = parseInt(c.req.param('productId'));
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');
        if (isNaN(productId)) {
            return c.json({ error: 'Invalid product ID' }, 400);
        }
        const offset = (page - 1) * limit;
        const result = await pool.query(`SELECT r.id, r.description, r.rating, r.timestamp,
              u.first_name, u.last_name, u.id as user_id
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1
       ORDER BY r.timestamp DESC
       LIMIT $2 OFFSET $3`, [productId, limit, offset]);
        // Get total count
        const countResult = await pool.query('SELECT COUNT(*) FROM reviews WHERE product_id = $1', [productId]);
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);
        // Get average rating
        const avgRatingResult = await pool.query('SELECT AVG(rating) as average_rating FROM reviews WHERE product_id = $1', [productId]);
        const averageRating = parseFloat(avgRatingResult.rows[0].average_rating || '0');
        return c.json({
            reviews: result.rows,
            average_rating: averageRating,
            total_reviews: total,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    }
    catch (error) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
// Get user's reviews
reviews.get('/user/me', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');
        const offset = (page - 1) * limit;
        const result = await pool.query(`SELECT r.id, r.description, r.rating, r.timestamp,
              p.id as product_id, p.name as product_name
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       WHERE r.user_id = $1
       ORDER BY r.timestamp DESC
       LIMIT $2 OFFSET $3`, [user.id, limit, offset]);
        // Get total count
        const countResult = await pool.query('SELECT COUNT(*) FROM reviews WHERE user_id = $1', [user.id]);
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);
        return c.json({
            reviews: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    }
    catch (error) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
// Create review
reviews.post('/', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const body = await c.req.json();
        const validatedData = createReviewSchema.parse(body);
        // Check if product exists
        const productCheck = await pool.query('SELECT id FROM products WHERE id = $1 AND deleted = false', [validatedData.product_id]);
        if (productCheck.rows.length === 0) {
            return c.json({ error: 'Product not found' }, 404);
        }
        // Check if user has already reviewed this product
        const existingReview = await pool.query('SELECT id FROM reviews WHERE user_id = $1 AND product_id = $2', [user.id, validatedData.product_id]);
        if (existingReview.rows.length > 0) {
            return c.json({ error: 'You have already reviewed this product' }, 409);
        }
        // Check if user has purchased this product (optional validation)
        const purchaseCheck = await pool.query(`SELECT 1 FROM sales_products sp
       JOIN sales s ON sp.sale_id = s.id
       WHERE sp.product_id = $1 AND s.user_id = $2 AND s.status != 'cancelled'
       LIMIT 1`, [validatedData.product_id, user.id]);
        if (purchaseCheck.rows.length === 0) {
            return c.json({ error: 'You can only review products you have purchased' }, 403);
        }
        const result = await pool.query(`INSERT INTO reviews (description, rating, product_id, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, description, rating, product_id, user_id, timestamp`, [
            validatedData.description,
            validatedData.rating,
            validatedData.product_id,
            user.id
        ]);
        return c.json({
            message: 'Review created successfully',
            review: result.rows[0]
        }, 201);
    }
    catch (error) {
        if (error instanceof Error) {
            return c.json({ error: error.message }, 400);
        }
        return c.json({ error: 'Internal server error' }, 500);
    }
});
// Update review
reviews.put('/:id', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const reviewId = parseInt(c.req.param('id'));
        if (isNaN(reviewId)) {
            return c.json({ error: 'Invalid review ID' }, 400);
        }
        // Verify review belongs to user
        const reviewCheck = await pool.query('SELECT id FROM reviews WHERE id = $1 AND user_id = $2', [reviewId, user.id]);
        if (reviewCheck.rows.length === 0) {
            return c.json({ error: 'Review not found or access denied' }, 404);
        }
        const body = await c.req.json();
        const validatedData = updateReviewSchema.parse(body);
        // Build dynamic update query
        const updateFields = [];
        const values = [];
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
        values.push(reviewId, user.id);
        const result = await pool.query(`UPDATE reviews SET ${updateFields.join(', ')}
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING id, description, rating, product_id, user_id, timestamp`, values);
        return c.json({
            message: 'Review updated successfully',
            review: result.rows[0]
        });
    }
    catch (error) {
        if (error instanceof Error) {
            return c.json({ error: error.message }, 400);
        }
        return c.json({ error: 'Internal server error' }, 500);
    }
});
// Delete review
reviews.delete('/:id', authMiddleware, async (c) => {
    try {
        const user = c.get('user');
        const reviewId = parseInt(c.req.param('id'));
        if (isNaN(reviewId)) {
            return c.json({ error: 'Invalid review ID' }, 400);
        }
        // Verify review belongs to user
        const reviewCheck = await pool.query('SELECT id FROM reviews WHERE id = $1 AND user_id = $2', [reviewId, user.id]);
        if (reviewCheck.rows.length === 0) {
            return c.json({ error: 'Review not found or access denied' }, 404);
        }
        await pool.query('DELETE FROM reviews WHERE id = $1', [reviewId]);
        return c.json({ message: 'Review deleted successfully' });
    }
    catch (error) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
// Get review by ID (public)
reviews.get('/:id', async (c) => {
    try {
        const reviewId = parseInt(c.req.param('id'));
        if (isNaN(reviewId)) {
            return c.json({ error: 'Invalid review ID' }, 400);
        }
        const result = await pool.query(`SELECT r.id, r.description, r.rating, r.timestamp,
              r.product_id, r.user_id,
              u.first_name, u.last_name,
              p.name as product_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN products p ON r.product_id = p.id
       WHERE r.id = $1`, [reviewId]);
        if (result.rows.length === 0) {
            return c.json({ error: 'Review not found' }, 404);
        }
        return c.json({ review: result.rows[0] });
    }
    catch (error) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
export default reviews;
