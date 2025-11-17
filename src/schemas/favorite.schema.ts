import { z } from "zod";

export const toggleFavoriteSchema = z.object({
  product_id: z.number().positive(),
});

export const toggleFavoriteResponseSchema = z.object({
  message: z.string(),
  is_favorite: z.boolean(),
});
