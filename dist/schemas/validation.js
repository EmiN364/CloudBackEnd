import { z } from 'zod';
// User validation schemas
export const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    phone: z.string().optional(),
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    is_seller: z.boolean().default(false),
    is_active: z.boolean().default(false),
    locale: z.string().default('en'),
    address: z.string().default('')
});
export const updateUserSchema = z.object({
    phone: z.string().optional(),
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    is_seller: z.boolean().optional(),
    is_active: z.boolean().optional(),
    locale: z.string().optional(),
    address: z.string().optional()
});
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});
// Product validation schemas
export const createProductSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.string().min(1),
    price: z.number().positive(),
    image_id: z.number().optional()
});
export const updateProductSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    category: z.string().min(1).optional(),
    price: z.number().positive().optional(),
    image_id: z.number().optional(),
    paused: z.boolean().optional()
});
// Store validation schemas
export const createStoreSchema = z.object({
    store_name: z.string().min(1),
    description: z.string().optional(),
    store_image_id: z.number().optional(),
    cover_image_id: z.number().optional(),
    cbu: z.string().optional()
});
export const updateStoreSchema = z.object({
    store_name: z.string().min(1).optional(),
    description: z.string().optional(),
    store_image_id: z.number().optional(),
    cover_image_id: z.number().optional(),
    cbu: z.string().optional()
});
// Sale validation schemas
export const createSaleSchema = z.object({
    total: z.number().positive(),
    status: z.string().optional(),
    note: z.string().optional(),
    invoice_id: z.number().optional(),
    address: z.string().default('')
});
export const updateSaleSchema = z.object({
    total: z.number().positive().optional(),
    status: z.string().optional(),
    note: z.string().optional(),
    invoice_id: z.number().optional(),
    address: z.string().optional()
});
// Sale Product validation schemas
export const createSaleProductSchema = z.object({
    product_id: z.number().positive(),
    price: z.number().positive(),
    amount: z.number().positive().default(1)
});
// Cart Product validation schemas
export const createCartProductSchema = z.object({
    product_id: z.number().positive(),
    amount: z.number().positive().default(1)
});
// Review validation schemas
export const createReviewSchema = z.object({
    description: z.string().optional(),
    rating: z.number().min(1).max(5),
    product_id: z.number().positive()
});
export const updateReviewSchema = z.object({
    description: z.string().optional(),
    rating: z.number().min(1).max(5).optional()
});
// Notification validation schemas
export const createNotificationSchema = z.object({
    message: z.string().min(1),
    type: z.string().default('OTHER'),
    product_id: z.number().optional()
});
export const updateNotificationSchema = z.object({
    message: z.string().min(1).optional(),
    type: z.string().optional(),
    read: z.boolean().optional()
});
// Token validation schemas
export const createTokenSchema = z.object({
    email: z.string().email(),
    type: z.enum(['confirm', 'reset'])
});
// Product Like validation schemas
export const createProductLikeSchema = z.object({
    product_id: z.number().positive()
});
