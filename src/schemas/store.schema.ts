import { z } from "zod";
import { paginationSchema } from "./pagination.schema.js";

// Store response schema matching the database structure
export const storeResponseSchema = z.object({
  store_id: z.number(),
  store_name: z.string(),
  description: z.string().nullable(),
  store_image_url: z.string().nullable(),
  cover_image_url: z.string().nullable(),
});

// Store update schema
export const storeUpdateSchema = z.object({
  store_name: z.string().min(1).optional(),
  description: z.string().optional(),
  store_image_url: z.string().optional(),
  cover_image_url: z.string().optional(),
});

// Store list response schema
export const storesListResponseSchema = z.object({
  stores: z.array(storeResponseSchema),
  pagination: paginationSchema,
});

// Single store response schema
export const singleStoreResponseSchema = z.object({
  store: storeResponseSchema,
});

// Store update response schema
export const storeUpdateResponseSchema = z.object({
  message: z.string(),
  store: storeResponseSchema,
});
