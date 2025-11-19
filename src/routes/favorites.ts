import { Hono } from "hono";
import pool from "../config/database.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  toggleFavoriteSchema,
  toggleFavoriteResponseSchema,
} from "../schemas/favorite.schema.js";

const favorites = new Hono();

favorites.post("/toggle", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = toggleFavoriteSchema.parse(body);
    const user = c.get("user");

    // Get user ID from cognito_sub
    const userResult = await pool.query(
      "SELECT id FROM users WHERE cognito_sub = $1",
      [user.sub],
    );

    if (userResult.rows.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }

    const userId = userResult.rows[0].id;

    // Check if product exists and is not deleted
    const productResult = await pool.query(
      "SELECT id FROM products WHERE id = $1 AND deleted = false",
      [validatedData.product_id],
    );

    if (productResult.rows.length === 0) {
      return c.json({ error: "Product not found" }, 404);
    }

    // Check if favorite already exists
    const existingFavorite = await pool.query(
      "SELECT user_id FROM favorites WHERE user_id = $1 AND product_id = $2",
      [userId, validatedData.product_id],
    );

    let responseData;

    if (existingFavorite.rows.length > 0) {
      // Remove from favorites
      await pool.query(
        "DELETE FROM favorites WHERE user_id = $1 AND product_id = $2",
        [userId, validatedData.product_id],
      );

      responseData = {
        message: "Product removed from favorites",
        is_favorite: false,
      };
    } else {
      // Add to favorites
      await pool.query(
        `INSERT INTO favorites (user_id, product_id)
         VALUES ($1, $2)`,
        [userId, validatedData.product_id],
      );

      responseData = {
        message: "Product added to favorites",
        is_favorite: true,
      };
    }

    // Validate response data
    const validatedResponse = toggleFavoriteResponseSchema.parse(responseData);
    return c.json(validatedResponse);
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default favorites;
