import { Hono } from "hono";
import pool from "../config/database.js";
import { authMiddleware } from "../middleware/auth.js";
import { salesListResponseSchema } from "../schemas/sale.schema.js";

const mySales = new Hono();

// Get user's sales (as seller - products sold by the user)
mySales.get("/", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "10");
    const status = c.req.query("status");

    // Get user from database
    const existingUser = await pool.query<{ id: number }>(
      "SELECT id FROM users WHERE cognito_sub = $1",
      [user.sub],
    );

    if (existingUser.rows.length === 0) {
      return c.json(
        {
          success: false,
          error: "User not found",
          message: "Error al obtener las ventas",
        },
        404,
      );
    }

    const userId = existingUser.rows[0].id;

    // Build WHERE clause filtering by seller_id (products sold by this user)
    let whereClause = "WHERE p.seller_id = $1";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [userId];
    let paramCount = 2;

    if (status) {
      whereClause += ` AND s.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    // Get total count of unique sales first
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT s.id) as count
       FROM sales s
       JOIN sale_products sp ON s.id = sp.sale_id
       JOIN products p ON sp.product_id = p.id
       ${whereClause}`,
      values.slice(0, paramCount - 1),
    );

    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // If no sales, return empty result
    if (total === 0) {
      return c.json({
        success: true,
        message: "Ventas obtenidas exitosamente",
        sales: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });
    }

    // Get unique sale IDs for the current page
    const offset = (page - 1) * limit;
    const saleIdsResult = await pool.query(
      `SELECT DISTINCT s.id, s.date
       FROM sales s
       JOIN sale_products sp ON s.id = sp.sale_id
       JOIN products p ON sp.product_id = p.id
       ${whereClause}
       ORDER BY s.date DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...values.slice(0, paramCount - 1), limit, offset],
    );

    const saleIds = saleIdsResult.rows.map((row) => row.id);

    if (saleIds.length === 0) {
      return c.json({
        success: true,
        message: "Ventas obtenidas exitosamente",
        sales: [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    }

    // Get all products for these sales
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
       WHERE s.id = ANY($1)
       ORDER BY s.date DESC, s.id, sp.product_id`,
      [saleIds],
    );

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
          invoice_id: row.invoice_id ? parseInt(row.invoice_id) : null,
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
        hasReviewed: false, // Not applicable for seller's sales view
      });
    });

    const sales = Array.from(salesMap.values());

    const responseData = {
      success: true,
      message: "Ventas obtenidas exitosamente",
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
    const validatedResponse = salesListResponseSchema.parse({
      sales,
      pagination: responseData.pagination,
    });
    
    return c.json({
      success: true,
      message: "Ventas obtenidas exitosamente",
      ...validatedResponse,
    });
  } catch (error) {
    if (error instanceof Error) {
      return c.json(
        {
          success: false,
          error: error.message,
          message: "Error al obtener las ventas",
        },
        400,
      );
    }
    return c.json(
      {
        success: false,
        error: "Internal server error",
        message: "Error al obtener las ventas",
      },
      500,
    );
  }
});

export default mySales;

