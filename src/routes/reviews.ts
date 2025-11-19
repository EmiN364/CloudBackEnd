import { Hono } from "hono";
import { z } from "zod";
import pool from "../config/database.js";
import {
  paginatedReviewsResponseSchema,
  reviewsQuerySchema,
  createReviewSchema,
} from "../schemas/review.schema.js";
import { authMiddleware } from "../middleware/auth.js";

const reviews = new Hono();

/**
 * GET /reviews?product_id={id}&page={page}&limit={limit}
 * Get reviews for a specific product with pagination
 */
reviews.get("/", async (c) => {
  try {
    // Parse and validate query parameters
    const queryResult = reviewsQuerySchema.safeParse({
      page: c.req.query("page"),
      limit: c.req.query("limit"),
      product_id: c.req.query("product_id"),
    });

    if (!queryResult.success) {
      return c.json(
        {
          error: "Invalid query parameters",
          details: queryResult.error.errors,
        },
        400,
      );
    }

    const { page, limit, product_id } = queryResult.data;

    // Validate that product_id is provided and valid
    if (isNaN(product_id)) {
      return c.json({ error: "Valid product_id is required" }, 400);
    }

    // Check if product exists
    const productCheck = await pool.query(
      "SELECT id FROM products WHERE id = $1 AND deleted = false",
      [product_id],
    );

    if (productCheck.rows.length === 0) {
      return c.json({ error: "Product not found" }, 404);
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Get total count of reviews for the product
    const countResult = await pool.query(
      "SELECT COUNT(*) as total FROM reviews WHERE product_id = $1",
      [product_id],
    );
    const total = parseInt(countResult.rows[0].total);

    // Get reviews with pagination
    const reviewsResult = await pool.query(
      `SELECT r.id, r.description, r.rating, r.timestamp,
              u.given_name, u.family_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1
       ORDER BY r.timestamp DESC
       LIMIT $2 OFFSET $3`,
      [product_id, limit, offset],
    );

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const responseData = {
      reviews: reviewsResult.rows.map((row) => ({
        ...row,
        timestamp: row.timestamp.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
      },
    };

    // Validate response data
    const validatedResponse =
      paginatedReviewsResponseSchema.parse(responseData);
    return c.json(validatedResponse);
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * POST /reviews
 * Create a new review for a product (requires authentication)
 */
reviews.post("/", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = createReviewSchema.parse(body);

    const user = c.get("user");

    // Get user from database
    const userResult = await pool.query(
      "SELECT id FROM users WHERE cognito_sub = $1",
      [user.sub],
    );

    if (userResult.rows.length === 0) {
      return c.json({ error: "User not found. Please register first." }, 404);
    }

    const userId = userResult.rows[0].id;

    // Check if product exists
    const productCheck = await pool.query(
      "SELECT id FROM products WHERE id = $1 AND deleted = false",
      [validatedData.product_id],
    );

    if (productCheck.rows.length === 0) {
      return c.json({ error: "Product not found" }, 404);
    }

    // Check if user already reviewed this product
    const existingReview = await pool.query(
      "SELECT id FROM reviews WHERE user_id = $1 AND product_id = $2",
      [userId, validatedData.product_id],
    );

    if (existingReview.rows.length > 0) {
      return c.json({ error: "You have already reviewed this product" }, 400);
    }

    // Create the review
    const result = await pool.query(
      `INSERT INTO reviews (description, rating, product_id, user_id, timestamp)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, description, rating, product_id, user_id, timestamp`,
      [
        validatedData.description || null,
        validatedData.rating,
        validatedData.product_id,
        userId,
      ],
    );

    const newReview = result.rows[0];

    return c.json(
      {
        message: "Review created successfully",
        review: {
          id: newReview.id,
          description: newReview.description,
          rating: newReview.rating,
          product_id: newReview.product_id,
          user_id: newReview.user_id,
          timestamp: newReview.timestamp.toISOString(),
        },
      },
      201,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: "Invalid request data",
          details: error.errors,
        },
        400,
      );
    }
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default reviews;
