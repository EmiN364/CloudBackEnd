import { z } from "zod";
import { productResponseSchema } from "./product.schema.js";

// Cart item update schema (for PUT request)
export const cartItemUpdateSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

// Cart update request schema
export const cartUpdateSchema = z.object({
  items: z.array(cartItemUpdateSchema).min(0),
});

// Cart item response schema (includes full product object)
export const cartItemResponseSchema = z.object({
  product_id: z.number(),
  quantity: z.number(),
  product: productResponseSchema,
});

// Cart response schema
export const cartResponseSchema = z.object({
  items: z.array(cartItemResponseSchema),
});

// Cart update response schema
export const cartUpdateResponseSchema = z.object({
  message: z.string(),
  items: z.array(cartItemResponseSchema),
});

// Cart validation response schema
export const cartValidationResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
});

