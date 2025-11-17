import { Hono } from "hono";
import pool from "../config/database.js";
import {
  authMiddleware,
  optionalAuthMiddleware,
  getUserId,
} from "../middleware/auth.js";
import {
  storesListResponseSchema,
  singleStoreResponseSchema,
  storeUpdateSchema,
  storeUpdateResponseSchema,
} from "../schemas/store.schema.js";
import { productsListResponseSchema } from "../schemas/product.schema.js";

const stores = new Hono();

// Get all stores paginated
stores.get("/", async (c) => {
  try {
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "20");

    const offset = (page - 1) * limit;

    // Get stores with pagination
    const result = await pool.query(
      `SELECT s.store_id, s.store_name, s.description, s.store_image_url, s.cover_image_url
       FROM stores s
       ORDER BY s.store_id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    // Get total count
    const countResult = await pool.query("SELECT COUNT(*) FROM stores");
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    const responseData = {
      stores: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    // Validate response data
    const validatedResponse = storesListResponseSchema.parse(responseData);
    return c.json(validatedResponse);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get store info by ID
stores.get("/:id", async (c) => {
  try {
    const storeId = parseInt(c.req.param("id"));

    if (isNaN(storeId)) {
      return c.json({ error: "Invalid store ID" }, 400);
    }

    const result = await pool.query(
      `SELECT s.store_id, s.store_name, s.description, s.store_image_url, s.cover_image_url
       FROM stores s
       WHERE s.store_id = $1`,
      [storeId],
    );

    if (result.rows.length === 0) {
      return c.json({ error: "Store not found" }, 404);
    }

    const responseData = { store: result.rows[0] };

    // Validate response data
    const validatedResponse = singleStoreResponseSchema.parse(responseData);
    return c.json(validatedResponse);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get store products paginated (reuse products logic with store filter)
stores.get("/:id/products", optionalAuthMiddleware, async (c) => {
  try {
    const storeId = parseInt(c.req.param("id"));

    if (isNaN(storeId)) {
      return c.json({ error: "Invalid store ID" }, 400);
    }

    // First verify store exists (store_id corresponds to user_id)
    const storeResult = await pool.query(
      "SELECT store_id FROM stores WHERE store_id = $1",
      [storeId],
    );

    if (storeResult.rows.length === 0) {
      return c.json({ error: "Store not found" }, 404);
    }

    const sellerId = storeResult.rows[0].store_id;

    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "20");
    const category = c.req.query("category");
    const search = c.req.query("search");
    const liked = c.req.query("liked") === "true";

    // Get user ID if authenticated (null if not authenticated)
    const userId = await getUserId(c);

    // Check if liked filter is requested but user is not authenticated
    if (liked && !userId) {
      return c.json(
        { error: "Authentication required to filter by liked products" },
        401,
      );
    }

    let whereClause =
      "WHERE p.deleted = false AND p.paused = false AND p.seller_id = $1";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [sellerId];
    let paramCount = 2;

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

    const offset = (page - 1) * limit;
    values.push(limit, offset);

    // Build query with optional favorite check
    let selectClause = `SELECT p.id, p.name, p.description, p.category, p.price, p.paused, p.image_url, p.seller_id,
              COALESCE(AVG(r.rating), 0) as rating,
              COUNT(r.id) as ratingCount,
              s.store_id, s.store_name, s.store_image_url`;
    let fromClause = `FROM products p
       LEFT JOIN reviews r ON p.id = r.product_id
       LEFT JOIN stores s ON p.seller_id = s.store_id`;

    if (userId) {
      selectClause += `,
              CASE WHEN f.user_id IS NOT NULL THEN true ELSE false END as is_favorite`;

      // If liked filter is active, use INNER JOIN to only get favorited products
      if (liked) {
        fromClause += `
       INNER JOIN favorites f ON p.id = f.product_id AND f.user_id = ${userId}`;
      } else {
        fromClause += `
       LEFT JOIN favorites f ON p.id = f.product_id AND f.user_id = ${userId}`;
      }
    }

    const result = await pool.query(
      `${selectClause}
       ${fromClause}
       ${whereClause}
       GROUP BY p.id, p.name, p.description, p.category, p.price, p.paused, p.image_url, p.seller_id, s.store_id, s.store_name, s.store_image_url${userId ? ", f.user_id" : ""}
       ORDER BY p.id DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values,
    );

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM products p LEFT JOIN stores s ON p.seller_id = s.store_id`;
    if (liked && userId) {
      countQuery += ` INNER JOIN favorites f ON p.id = f.product_id AND f.user_id = ${userId}`;
    }
    countQuery += ` ${whereClause}`;

    const countResult = await pool.query(countQuery, values.slice(0, -2));

    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // Process products to ensure proper data types
    const products = result.rows.map((product) => ({
      ...product,
      rating: parseFloat(product.rating) || 0,
      ratingCount: parseInt(product.ratingcount) || 0,
      ...(userId && { is_favorite: product.is_favorite || false }),
    }));

    const responseData = {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    // Validate response data
    const validatedResponse = productsListResponseSchema.parse(responseData);
    return c.json(validatedResponse);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Update store info (only store owner can update)
stores.put("/:id", authMiddleware, async (c) => {
  try {
    const storeId = parseInt(c.req.param("id"));

    if (isNaN(storeId)) {
      return c.json({ error: "Invalid store ID" }, 400);
    }

    const body = await c.req.json();
    const validatedData = storeUpdateSchema.parse(body);

    const cognitoUser = c.get("user");

    // Get user ID from cognito_sub
    const userResult = await pool.query(
      "SELECT id FROM users WHERE cognito_sub = $1 AND deleted = false",
      [cognitoUser.sub],
    );

    if (userResult.rows.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }

    const userId = userResult.rows[0].id;

    // Check if store exists and belongs to the user
    const storeResult = await pool.query(
      "SELECT store_id FROM stores WHERE store_id = $1",
      [storeId],
    );

    if (storeResult.rows.length === 0) {
      return c.json({ error: "Store not found" }, 404);
    }

    if (storeResult.rows[0].store_id !== userId) {
      return c.json({ error: "You can only update your own store" }, 403);
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (validatedData.store_name !== undefined) {
      updateFields.push(`store_name = $${paramCount}`);
      updateValues.push(validatedData.store_name);
      paramCount++;
    }

    if (validatedData.description !== undefined) {
      updateFields.push(`description = $${paramCount}`);
      updateValues.push(validatedData.description);
      paramCount++;
    }

    if (validatedData.store_image_url !== undefined) {
      updateFields.push(`store_image_url = $${paramCount}`);
      updateValues.push(validatedData.store_image_url);
      paramCount++;
    }

    if (validatedData.cover_image_url !== undefined) {
      updateFields.push(`cover_image_url = $${paramCount}`);
      updateValues.push(validatedData.cover_image_url);
      paramCount++;
    }

    // If no fields to update, return error
    if (updateFields.length === 0) {
      return c.json({ error: "No valid fields provided for update" }, 400);
    }

    // Add store ID to values for WHERE clause
    updateValues.push(storeId);

    // Execute update query
    const updateQuery = `
      UPDATE stores 
      SET ${updateFields.join(", ")} 
      WHERE store_id = $${paramCount}
      RETURNING store_id, store_name, description, store_image_url, cover_image_url
    `;

    const updatedStore = await pool.query(updateQuery, updateValues);

    if (updatedStore.rows.length === 0) {
      return c.json({ error: "Failed to update store" }, 500);
    }

    const responseData = {
      message: "Store updated successfully",
      store: updatedStore.rows[0],
    };

    // Validate response data
    const validatedResponse = storeUpdateResponseSchema.parse(responseData);
    return c.json(validatedResponse);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default stores;
