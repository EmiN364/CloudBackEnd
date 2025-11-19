import { z } from "zod";
import { paginationSchema } from "./pagination.schema.js";

// Sale creation request schema
export const createSaleSchema = z.object({
  products: z
    .array(
      z.object({
        product_id: z.number().positive(),
        quantity: z.number().positive().default(1),
      }),
    )
    .min(1, "At least one product is required"),
  note: z.string().optional(),
  address: z.string().optional(),
});

// Sale response schema
export const saleResponseSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  date: z.string(),
  total_amount: z.number(),
  status: z.string(),
  note: z.string().nullable(),
  invoice_id: z.number().nullable(),
  address: z.string(),
});

// Sale with products response schema
export const saleWithProductsResponseSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  date: z.string(),
  total_amount: z.number(),
  status: z.string(),
  note: z.string().nullable(),
  invoice_id: z.number().nullable(),
  address: z.string(),
  products: z.array(
    z.object({
      product_id: z.number(),
      quantity: z.number(),
      unit_price: z.number(),
      total_price: z.number(),
      product_name: z.string(),
      product_description: z.string().nullable(),
      product_category: z.string(),
      product_image_url: z.string().nullable(),
    }),
  ),
});

// Sale creation response schema
export const saleCreationResponseSchema = z.object({
  message: z.string(),
  sale: saleWithProductsResponseSchema,
});

// Sales list response schema
export const salesListResponseSchema = z.object({
  sales: z.array(saleWithProductsResponseSchema),
  pagination: paginationSchema,
});

// Sale update schema
export const updateSaleSchema = z.object({
  status: z
    .enum(["pending", "confirmed", "shipped", "delivered", "cancelled"])
    .optional(),
});
