import { Hono } from "hono";
import pool from "../config/database.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";
import {
  cartUpdateSchema,
  cartResponseSchema,
  cartUpdateResponseSchema,
  cartValidationResponseSchema,
} from "../schemas/cart.schema.js";

const cart = new Hono();

/**
 * Helper function to get or create a cart for a user
 */
async function getOrCreateCart(userId: number): Promise<number> {
  // Try to get existing cart
  const cartResult = await pool.query(
    "SELECT id FROM carts WHERE user_id = $1",
    [userId],
  );

  if (cartResult.rows.length > 0) {
    return cartResult.rows[0].id;
  }

  // Create new cart if it doesn't exist
  const newCartResult = await pool.query(
    "INSERT INTO carts (user_id) VALUES ($1) RETURNING id",
    [userId],
  );

  return newCartResult.rows[0].id;
}

/**
 * Helper function to get cart items with full product details
 */
async function getCartItemsWithProducts(cartId: number, userId: number) {
  const result = await pool.query(
    `SELECT 
      ci.product_id,
      ci.quantity,
      ci.created_at,
      p.id,
      p.name,
      p.description,
      p.category,
      p.price,
      p.stock,
      p.paused,
      p.image_url,
      p.seller_id,
      COALESCE(AVG(r.rating), 0) as rating,
      COUNT(r.id) as ratingCount,
      s.store_id,
      s.store_name,
      s.store_image_url,
      CASE WHEN f.user_id IS NOT NULL THEN true ELSE false END as is_favorite
    FROM cart_items ci
    INNER JOIN products p ON ci.product_id = p.id
    LEFT JOIN reviews r ON p.id = r.product_id
    LEFT JOIN stores s ON p.seller_id = s.store_id
    LEFT JOIN favorites f ON p.id = f.product_id AND f.user_id = $2
    WHERE ci.cart_id = $1 AND p.deleted = false
    GROUP BY ci.product_id, ci.quantity, ci.created_at, p.id, p.name, p.description, p.category, 
             p.price, p.stock, p.paused, p.image_url, p.seller_id, 
             s.store_id, s.store_name, s.store_image_url, f.user_id
    ORDER BY ci.created_at ASC`,
    [cartId, userId],
  );

  return result.rows.map((row) => ({
    product_id: parseInt(row.product_id),
    quantity: parseInt(row.quantity),
    product: {
      id: parseInt(row.id),
      name: row.name,
      description: row.description,
      category: row.category,
      price: parseFloat(row.price),
      stock: parseInt(row.stock),
      paused: row.paused,
      image_url: row.image_url,
      seller_id: parseInt(row.seller_id),
      rating: parseFloat(row.rating) || 0,
      ratingCount: parseInt(row.ratingcount) || 0,
      is_favorite: row.is_favorite || false,
      store_id: parseInt(row.store_id),
      store_name: row.store_name,
      store_image_url: row.store_image_url,
    },
  }));
}

/**
 * GET /api/cart
 * Fetch the user's cart
 */
cart.get("/", authMiddleware, async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get or create cart
    const cartId = await getOrCreateCart(userId);

    // Get cart items with full product details
    const items = await getCartItemsWithProducts(cartId, userId);

    const responseData = {
      items,
    };

    const validatedResponse = cartResponseSchema.parse(responseData);
    return c.json(validatedResponse);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error fetching cart:", error);
    if (error instanceof Error) {
      return c.json({ error: error.message }, 500);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * PUT /api/cart
 * Update the user's cart
 */
cart.put("/", authMiddleware, async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const validatedData = cartUpdateSchema.parse(body);

    // Get or create cart
    const cartId = await getOrCreateCart(userId);

    // Start transaction-like behavior by clearing existing items
    await pool.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);

    // Validate and insert new items
    const errors: string[] = [];
    const validItems: Array<{ product_id: number; quantity: number }> = [];

    for (const item of validatedData.items) {
      // Check if product exists and is not deleted
      const productResult = await pool.query(
        `SELECT id, name, price, stock, paused, deleted 
         FROM products 
         WHERE id = $1 AND deleted = false`,
        [item.product_id],
      );

      if (productResult.rows.length === 0) {
        errors.push(`Product with ID ${item.product_id} not found`);
        continue;
      }

      const product = productResult.rows[0];

      // Check if product is paused
      if (product.paused) {
        errors.push(`Product '${product.name}' is currently unavailable`);
        continue;
      }

      // Check stock availability and adjust quantity if needed
      const availableStock = parseInt(product.stock);
      let finalQuantity = item.quantity;

      if (item.quantity > availableStock) {
        if (availableStock === 0) {
          errors.push(`Product '${product.name}' is out of stock`);
          continue;
        }
        // Adjust to max available stock
        finalQuantity = availableStock;
        errors.push(
          `Product '${product.name}' quantity adjusted from ${item.quantity} to ${availableStock} (max available)`,
        );
      }

      validItems.push({
        product_id: item.product_id,
        quantity: finalQuantity,
      });
    }

    // Insert valid items
    for (const item of validItems) {
      await pool.query(
        `INSERT INTO cart_items (cart_id, product_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (cart_id, product_id) 
         DO UPDATE SET quantity = $3, updated_at = CURRENT_TIMESTAMP`,
        [cartId, item.product_id, item.quantity],
      );
    }

    // Update cart updated_at timestamp
    await pool.query(
      "UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [cartId],
    );

    // Get updated cart items with full product details
    const items = await getCartItemsWithProducts(cartId, userId);

    const responseData = {
      message: "Cart updated successfully",
      items,
    };

    // If there were errors, include them in the response (but still return 200)
    if (errors.length > 0) {
      // eslint-disable-next-line no-console
      console.warn("Cart update warnings:", errors);
    }

    const validatedResponse = cartUpdateResponseSchema.parse(responseData);
    return c.json(validatedResponse);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error updating cart:", error);
    if (error instanceof Error) {
      // Handle validation errors
      if (error.message.includes("product_id")) {
        return c.json(
          { error: "Invalid request: product_id is required" },
          400,
        );
      }
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * DELETE /api/cart
 * Clear the user's cart
 */
cart.delete("/", authMiddleware, async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get cart ID
    const cartResult = await pool.query(
      "SELECT id FROM carts WHERE user_id = $1",
      [userId],
    );

    if (cartResult.rows.length === 0) {
      // Cart doesn't exist, return success anyway
      return c.json({ message: "Cart cleared successfully" });
    }

    const cartId = cartResult.rows[0].id;

    // Delete all cart items
    await pool.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);

    return c.json({ message: "Cart cleared successfully" });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error clearing cart:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /api/cart/validate
 * Validate cart items before checkout
 */
cart.get("/validate", authMiddleware, async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get cart
    const cartResult = await pool.query(
      "SELECT id FROM carts WHERE user_id = $1",
      [userId],
    );

    if (cartResult.rows.length === 0) {
      // Empty cart is valid
      return c.json({ valid: true, errors: [] });
    }

    const cartId = cartResult.rows[0].id;

    // Get cart items with current product data
    const items = await getCartItemsWithProducts(cartId, userId);

    const errors: string[] = [];

    for (const item of items) {
      const product = item.product;

      // Check if product still exists and is not deleted
      const productResult = await pool.query(
        `SELECT id, name, price, stock, paused, deleted 
         FROM products 
         WHERE id = $1`,
        [item.product_id],
      );

      if (productResult.rows.length === 0 || productResult.rows[0].deleted) {
        errors.push(`Product '${product.name}' no longer exists`);
        continue;
      }

      const currentProduct = productResult.rows[0];

      // Check stock availability
      const currentStock = parseInt(currentProduct.stock);
      if (item.quantity > currentStock) {
        if (currentStock === 0) {
          errors.push(`Product '${product.name}' is out of stock`);
        } else {
          errors.push(
            `Product '${product.name}' only has ${currentStock} units available (cart has ${item.quantity})`,
          );
        }
      }

      // Check if product is paused
      if (currentProduct.paused) {
        errors.push(`Product '${product.name}' is currently unavailable`);
      }

      // Check price consistency (allow small floating point differences)
      const currentPrice = parseFloat(currentProduct.price);
      const cartPrice = product.price;
      const priceDifference = Math.abs(currentPrice - cartPrice);

      if (priceDifference > 0.01) {
        // Price changed by more than 1 cent
        errors.push(
          `Product '${product.name}' price has changed from $${cartPrice.toFixed(2)} to $${currentPrice.toFixed(2)}`,
        );
      }
    }

    const responseData = {
      valid: errors.length === 0,
      errors,
    };

    const validatedResponse = cartValidationResponseSchema.parse(responseData);
    return c.json(validatedResponse);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error validating cart:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default cart;

