import { z } from "zod";
import { paginationSchema } from "./pagination.schema.js";

export const createReviewSchema = z.object({
  description: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  product_id: z.number().int().positive(),
});

export const updateReviewSchema = z.object({
  description: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export const reviewSchema = z.object({
  id: z.number().int(),
  description: z.string().nullable(),
  rating: z.number().int().min(1).max(5),
  product_id: z.number().int(),
  user_id: z.number().int(),
  timestamp: z.string().datetime(),
});

export const reviewResponseSchema = z.object({
  id: z.number(),
  description: z.string().nullable(),
  rating: z.number(),
  timestamp: z.string(),
  given_name: z.string().nullable(),
  family_name: z.string().nullable(),
});

// Schema for paginated reviews response
export const paginatedReviewsResponseSchema = z.object({
  reviews: z.array(reviewResponseSchema),
  pagination: paginationSchema,
});

// Query parameters schema for pagination
export const reviewsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => Math.max(1, parseInt(val) || 1)),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => Math.min(50, Math.max(1, parseInt(val) || 10))),
  product_id: z.string().transform((val) => parseInt(val)),
});
