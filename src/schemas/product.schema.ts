import { z } from "zod";
import { paginationSchema } from "./pagination.schema.js";

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  price: z.number().positive(),
  stock: z.number().int().nonnegative().optional(),
  image_url: z.string().optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().nonnegative().optional(),
  image_url: z.string().optional(),
  paused: z.boolean().optional(),
});

// Product response schemas
export const productResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  price: z.number(),
  stock: z.number(),
  paused: z.boolean().nullable(),
  image_url: z.string().nullable(),
  seller_id: z.number(),
  rating: z.number(),
  ratingCount: z.number(),
  is_favorite: z.boolean().optional(),
  // Store information
  store_id: z.number(),
  store_name: z.string(),
  store_image_url: z.string().nullable(),
});

// Products list response schema
export const productsListResponseSchema = z.object({
  products: z.array(productResponseSchema),
  pagination: paginationSchema,
});

// Product creation response schema
export const productCreationResponseSchema = z.object({
  message: z.string(),
  product: z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    category: z.string(),
      price: z.number(),
      stock: z.number(),
    seller_id: z.number(),
    image_url: z.string().nullable(),
    // Store information
    store_id: z.number(),
    store_name: z.string(),
    store_image_url: z.string().nullable(),
  }),
});

// Related products response schema
export const relatedProductsResponseSchema = z.object({
  products: z.array(productResponseSchema),
});