import { Hono } from "hono";
import pool from "../config/database.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  createSaleSchema,
  saleCreationResponseSchema,
  salesListResponseSchema,
  saleWithProductsResponseSchema,
} from "../schemas/sale.schema.js";

const sales = new Hono();

// Create a new sale
sales.post("/", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = createSaleSchema.parse(body);

    const user = c.get("user");

    // Get user from database
    const existingUser = await pool.query<{ id: number }>(
      "SELECT id FROM users WHERE cognito_sub = $1",
      [user.sub],
    );

    if (existingUser.rows.length === 0) {
      return c.json({ error: "User not found. Please register first." }, 404);
    }

    const userId = existingUser.rows[0].id;

    // Get all product details and validate them
    const productIds = validatedData.products.map((p) => p.product_id);
    const productResult = await pool.query(
      `SELECT id, name, description, category, price, image_url, seller_id, deleted, paused
       FROM products 
       WHERE id = ANY($1)`,
      [productIds],
    );

    if (productResult.rows.length !== productIds.length) {
      return c.json({ error: "One or more products not found" }, 404);
    }

    const products = productResult.rows;

    // Check if any products are not available
    const unavailableProducts = products.filter((p) => p.deleted || p.paused);
    if (unavailableProducts.length > 0) {
      return c.json(
        { error: "One or more products are not available for purchase" },
        400,
      );
    }

    // Check if user is trying to buy their own products
    const ownProducts = products.filter((p) => p.seller_id === userId);
    if (ownProducts.length > 0) {
      return c.json({ error: "You cannot buy your own products" }, 400);
    }

    // Begin transaction
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Calculate total amount for all products
      let totalAmount = 0;
      const saleProductsData = [];

      for (const requestProduct of validatedData.products) {
        const product = products.find(
          (p) => p.id === requestProduct.product_id,
        );
        const quantity = requestProduct.quantity;
        const unitPrice = product.price;
        const productTotal = unitPrice * quantity;

        totalAmount += productTotal;
        saleProductsData.push({
          product_id: requestProduct.product_id,
          quantity,
          unit_price: unitPrice,
          total_price: productTotal,
          product,
        });
      }

      // Create the sale with completed status
      const saleResult = await client.query(
        `INSERT INTO sales (user_id, total_amount, status, note, address)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, date, total_amount, status, note, invoice_id, address`,
        [
          userId,
          totalAmount,
          "completed",
          validatedData.note || null,
          validatedData.address || "",
        ],
      );

      const sale = saleResult.rows[0];

      // Create sale_product entries for all products
      for (const saleProduct of saleProductsData) {
        await client.query(
          `INSERT INTO sale_products (sale_id, product_id, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            sale.id,
            saleProduct.product_id,
            saleProduct.quantity,
            saleProduct.unit_price,
            saleProduct.total_price,
          ],
        );
      }

      // Get the complete sale with product details
      const completeSaleResult = await client.query(
        `SELECT 
          s.id, s.user_id, s.date, s.total_amount, s.status, 
          s.note, s.invoice_id, s.address,
          sp.product_id, sp.quantity, sp.unit_price, sp.total_price,
          p.name as product_name, p.description as product_description,
          p.category as product_category, p.image_url as product_image_url
         FROM sales s
         JOIN sale_products sp ON s.id = sp.sale_id
         JOIN products p ON sp.product_id = p.id
         WHERE s.id = $1`,
        [sale.id],
      );

      await client.query("COMMIT");

      // Format the response
      const firstRow = completeSaleResult.rows[0];
      const responseData = {
        message: "Sale created successfully",
        sale: {
          id: firstRow.id,
          user_id: firstRow.user_id,
          date: firstRow.date.toISOString(),
          total_amount: firstRow.total_amount,
          status: firstRow.status,
          note: firstRow.note,
          invoice_id: firstRow.invoice_id,
          address: firstRow.address,
          products: completeSaleResult.rows.map((row) => ({
            product_id: row.product_id,
            quantity: row.quantity,
            unit_price: row.unit_price,
            total_price: row.total_price,
            product_name: row.product_name,
            product_description: row.product_description,
            product_category: row.product_category,
            product_image_url: row.product_image_url,
          })),
        },
      };

      // Validate response data
      const validatedResponse = saleCreationResponseSchema.parse(responseData);
      return c.json(validatedResponse, 201);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get user's sales
sales.get("/", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "20");
    const status = c.req.query("status");

    // Get user from database
    const existingUser = await pool.query<{ id: number }>(
      "SELECT id FROM users WHERE cognito_sub = $1",
      [user.sub],
    );

    if (existingUser.rows.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }

    const userId = existingUser.rows[0].id;

    let whereClause = "WHERE s.user_id = $1";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [userId];
    let paramCount = 2;

    if (status) {
      whereClause += ` AND s.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    const offset = (page - 1) * limit;
    values.push(limit, offset);

    // Get sales with products
    const result = await pool.query(
      `SELECT 
        s.id, s.user_id, s.date, s.total_amount, s.status, 
        s.note, s.invoice_id, s.address,
        sp.product_id, sp.quantity, sp.unit_price, sp.total_price,
        p.name as product_name, p.description as product_description,
        p.category as product_category, p.image_url as product_image_url
       FROM sales s
       JOIN sale_products sp ON s.id = sp.sale_id
       JOIN products p ON sp.product_id = p.id
       ${whereClause}
       ORDER BY s.date DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values,
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM sales s ${whereClause}`,
      values.slice(0, -2),
    );

    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // Group sales by sale id
    const salesMap = new Map();

    result.rows.forEach((row) => {
      if (!salesMap.has(row.id)) {
        salesMap.set(row.id, {
          id: row.id,
          user_id: row.user_id,
          date: row.date.toISOString(),
          total_amount: row.total_amount,
          status: row.status,
          note: row.note,
          invoice_id: row.invoice_id,
          address: row.address,
          products: [],
        });
      }

      salesMap.get(row.id).products.push({
        product_id: row.product_id,
        quantity: row.quantity,
        unit_price: row.unit_price,
        total_price: row.total_price,
        product_name: row.product_name,
        product_description: row.product_description,
        product_category: row.product_category,
        product_image_url: row.product_image_url,
      });
    });

    const sales = Array.from(salesMap.values());

    const responseData = {
      sales,
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
    const validatedResponse = salesListResponseSchema.parse(responseData);
    return c.json(validatedResponse);
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get sale by ID
sales.get("/:id", authMiddleware, async (c) => {
  try {
    const saleId = parseInt(c.req.param("id"));
    const user = c.get("user");

    if (isNaN(saleId)) {
      return c.json({ error: "Invalid sale ID" }, 400);
    }

    // Get user from database
    const existingUser = await pool.query<{ id: number }>(
      "SELECT id FROM users WHERE cognito_sub = $1",
      [user.sub],
    );

    if (existingUser.rows.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }

    const userId = existingUser.rows[0].id;

    // Get sale with products
    const result = await pool.query(
      `SELECT 
        s.id, s.user_id, s.date, s.total_amount, s.status, 
        s.note, s.invoice_id, s.address,
        sp.product_id, sp.quantity, sp.unit_price, sp.total_price,
        p.name as product_name, p.description as product_description,
        p.category as product_category, p.image_url as product_image_url
       FROM sales s
       JOIN sale_products sp ON s.id = sp.sale_id
       JOIN products p ON sp.product_id = p.id
       WHERE s.id = $1 AND s.user_id = $2`,
      [saleId, userId],
    );

    if (result.rows.length === 0) {
      return c.json({ error: "Sale not found" }, 404);
    }

    const firstRow = result.rows[0];

    const saleData = {
      id: firstRow.id,
      user_id: firstRow.user_id,
      date: firstRow.date.toISOString(),
      total_amount: firstRow.total_amount,
      status: firstRow.status,
      note: firstRow.note,
      invoice_id: firstRow.invoice_id,
      address: firstRow.address,
      products: result.rows.map((row) => ({
        product_id: row.product_id,
        quantity: row.quantity,
        unit_price: row.unit_price,
        total_price: row.total_price,
        product_name: row.product_name,
        product_description: row.product_description,
        product_category: row.product_category,
        product_image_url: row.product_image_url,
      })),
    };

    // Validate response data
    const validatedResponse = saleWithProductsResponseSchema.parse(saleData);
    return c.json({ sale: validatedResponse });
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default sales;
