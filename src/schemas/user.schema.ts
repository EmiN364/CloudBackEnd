import { z } from "zod";

// User response schema matching the database structure
export const userResponseSchema = z.object({
  id: z.number(),
  cognito_sub: z.string(),
  email: z.string().email(),
  email_verified: z.boolean().nullable(),
  phone_number: z.string().nullable(),
  given_name: z.string().nullable(),
  family_name: z.string().nullable(),
  username: z.string().nullable(),
  cognito_username: z.string().nullable(),
  is_seller: z.boolean(),
  deleted: z.boolean().nullable(),
  address: z.string().nullable(),
  profile_picture: z.string().nullable(),
});

// User profile update schema
export const userProfileUpdateSchema = z.object({
  address: z.string().optional(),
  profile_picture: z.string().optional(),
});

// User profile response schema
export const userProfileResponseSchema = z.object({
  user: userResponseSchema,
});
