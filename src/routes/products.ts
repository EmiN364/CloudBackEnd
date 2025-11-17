import { Hono } from "hono";
import pool from "../config/database.js";
import {
  authMiddleware,
  optionalAuthMiddleware,
  getUserId,
} from "../middleware/auth.js";
import {
  createProductSchema,
  productsListResponseSchema,
  productResponseSchema,
  productCreationResponseSchema,
} from "../schemas/product.schema.js";

const products = new Hono();

products.get("/", optionalAuthMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "20");
    const category = c.req.query("category");
    const search = c.req.query("search");
    const seller_id = c.req.query("seller_id");
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

    let whereClause = "WHERE p.deleted = false AND p.paused = false";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Build query with optional favorite check
    let selectClause = `SELECT p.id, p.name, p.description, p.category, p.price, p.paused, p.image_url, p.seller_id,
              COALESCE(AVG(r.rating), 0) as rating,
              COUNT(r.id) as ratingCount`;
    let fromClause = `FROM products p
       LEFT JOIN reviews r ON p.id = r.product_id`;

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
       GROUP BY p.id, p.name, p.description, p.category, p.price, p.paused, p.image_url, p.seller_id${userId ? ", f.user_id" : ""}
       ORDER BY p.id DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values,
    );

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM products p`;
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
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get product by ID (public)
products.get("/:id", optionalAuthMiddleware, async (c) => {
  try {
    const productId = parseInt(c.req.param("id"));

    if (isNaN(productId)) {
      return c.json({ error: "Invalid product ID" }, 400);
    }

    // Get user ID if authenticated (null if not authenticated)
    const userId = await getUserId(c);

    // Build query with optional favorite check
    let selectClause = `SELECT p.id, p.name, p.description, p.category, p.price, p.paused, p.image_url, p.seller_id,
              COALESCE(AVG(r.rating), 0) as rating,
              COUNT(r.id) as ratingCount`;
    let fromClause = `FROM products p
       LEFT JOIN reviews r ON p.id = r.product_id`;

    if (userId) {
      selectClause += `,
              CASE WHEN f.user_id IS NOT NULL THEN true ELSE false END as is_favorite`;
      fromClause += `
       LEFT JOIN favorites f ON p.id = f.product_id AND f.user_id = ${userId}`;
    }

    const result = await pool.query(
      `${selectClause}
       ${fromClause}
       WHERE p.id = $1 AND p.deleted = false
       GROUP BY p.id, p.name, p.description, p.category, p.price, p.paused, p.image_url, p.seller_id${userId ? ", f.user_id" : ""}`,
      [productId],
    );

    if (result.rows.length === 0) {
      return c.json({ error: "Product not found" }, 404);
    }

    const productData = result.rows[0];

    // Process product to ensure proper data types
    const product = {
      ...productData,
      rating: parseFloat(productData.rating) || 0,
      ratingCount: parseInt(productData.ratingcount) || 0,
      ...(userId && { is_favorite: productData.is_favorite || false }),
    };

    // Validate response data
    const validatedResponse = productResponseSchema.parse(product);
    return c.json({ product: validatedResponse });
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

products.post("/", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = createProductSchema.parse(body);

    const user = c.get("user");

    const existingUser = await pool.query<{ id: number; is_seller: boolean }>(
      "SELECT id, is_seller FROM users WHERE cognito_sub = $1",
      [user.sub],
    );

    if (existingUser.rows.length === 0) {
      return c.json({ error: "User not found. Please register first." }, 404);
    }

    const userId = existingUser.rows[0].id;
    const isCurrentlySeller = existingUser.rows[0].is_seller;

    if (!isCurrentlySeller) {
      await pool.query("UPDATE users SET is_seller = true WHERE id = $1", [
        userId,
      ]);
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
        validatedData.price,
      ],
    );

    const responseData = {
      message: "Product created successfully",
      product: result.rows[0],
    };

    // Validate response data
    const validatedResponse = productCreationResponseSchema.parse(responseData);
    return c.json(validatedResponse, 201);
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default products;
