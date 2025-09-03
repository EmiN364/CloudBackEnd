import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
// Base schemas
const ErrorSchema = z.object({
    error: z.string()
});
const PaginationSchema = z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean()
});
// User schemas
const UserSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    first_name: z.string(),
    last_name: z.string(),
    is_seller: z.boolean(),
    is_active: z.boolean(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
});
const CreateUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    is_seller: z.boolean().optional()
});
const UpdateUserSchema = z.object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    is_seller: z.boolean().optional()
});
const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});
// Product schemas
const ProductSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    price: z.number().positive(),
    stock: z.number().nonnegative(),
    store_id: z.number(),
    is_active: z.boolean(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
});
const CreateProductSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    price: z.number().positive(),
    stock: z.number().nonnegative(),
    store_id: z.number()
});
const UpdateProductSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    price: z.number().positive().optional(),
    stock: z.number().nonnegative().optional()
});
// Store schemas
const StoreSchema = z.object({
    id: z.number(),
    name: z.string(),
    description: z.string(),
    user_id: z.number(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
});
const CreateStoreSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1)
});
const UpdateStoreSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional()
});
// Cart schemas
const CartProductSchema = z.object({
    id: z.number(),
    user_id: z.number(),
    product_id: z.number(),
    amount: z.number().positive(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
});
const CreateCartProductSchema = z.object({
    product_id: z.number(),
    amount: z.number().positive()
});
const UpdateCartProductSchema = z.object({
    amount: z.number().positive()
});
// Sales schemas
const SaleSchema = z.object({
    id: z.number(),
    user_id: z.number(),
    total: z.number().positive(),
    status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
});
const CreateSaleSchema = z.object({
    cart_product_ids: z.array(z.number())
});
const UpdateSaleSchema = z.object({
    status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
});
// Review schemas
const ReviewSchema = z.object({
    id: z.number(),
    user_id: z.number(),
    product_id: z.number(),
    rating: z.number().min(1).max(5),
    comment: z.string(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
});
const CreateReviewSchema = z.object({
    product_id: z.number(),
    rating: z.number().min(1).max(5),
    comment: z.string().min(1)
});
const UpdateReviewSchema = z.object({
    rating: z.number().min(1).max(5).optional(),
    comment: z.string().min(1).optional()
});
// Notification schemas
const NotificationSchema = z.object({
    id: z.number(),
    user_id: z.number(),
    title: z.string(),
    message: z.string(),
    is_read: z.boolean(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
});
const CreateNotificationSchema = z.object({
    title: z.string().min(1),
    message: z.string().min(1)
});
const UpdateNotificationSchema = z.object({
    title: z.string().min(1).optional(),
    message: z.string().min(1).optional(),
    is_read: z.boolean().optional()
});
// Image schemas
const ImageSchema = z.object({
    id: z.number(),
    image: z.string().url()
});
const UploadedImageSchema = z.object({
    id: z.number(),
    key: z.string(),
    url: z.string().url(),
    size: z.number(),
    mimetype: z.string()
});
// Product Like schemas
const ProductLikeSchema = z.object({
    product_id: z.number()
});
// OpenAPI specification
export const openApiConfig = {
    openapi: '3.0.0',
    info: {
        title: 'E-commerce API',
        version: '1.0.0',
        description: 'A comprehensive REST API for e-commerce operations including user management, product catalog, shopping cart, sales, reviews, and image management with S3 integration.',
        contact: {
            name: 'API Support',
            email: 'support@example.com'
        }
    },
    servers: [
        {
            url: 'http://localhost:3000',
            description: 'Development server'
        }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT'
            }
        },
        schemas: {
            Error: ErrorSchema,
            Pagination: PaginationSchema,
            User: UserSchema,
            CreateUser: CreateUserSchema,
            UpdateUser: UpdateUserSchema,
            Login: LoginSchema,
            Product: ProductSchema,
            CreateProduct: CreateProductSchema,
            UpdateProduct: UpdateProductSchema,
            Store: StoreSchema,
            CreateStore: CreateStoreSchema,
            UpdateStore: UpdateStoreSchema,
            CartProduct: CartProductSchema,
            CreateCartProduct: CreateCartProductSchema,
            UpdateCartProduct: UpdateCartProductSchema,
            Sale: SaleSchema,
            CreateSale: CreateSaleSchema,
            UpdateSale: UpdateSaleSchema,
            Review: ReviewSchema,
            CreateReview: CreateReviewSchema,
            UpdateReview: UpdateReviewSchema,
            Notification: NotificationSchema,
            CreateNotification: CreateNotificationSchema,
            UpdateNotification: UpdateNotificationSchema,
            Image: ImageSchema,
            UploadedImage: UploadedImageSchema,
            ProductLike: ProductLikeSchema
        }
    },
    tags: [
        { name: 'Authentication', description: 'User authentication and registration' },
        { name: 'Users', description: 'User management operations' },
        { name: 'Products', description: 'Product catalog management' },
        { name: 'Stores', description: 'Store management for sellers' },
        { name: 'Cart', description: 'Shopping cart operations' },
        { name: 'Sales', description: 'Order and sales management' },
        { name: 'Reviews', description: 'Product review management' },
        { name: 'Notifications', description: 'User notification system' },
        { name: 'Images', description: 'Image upload and management with S3' },
        { name: 'Likes', description: 'Product like/unlike functionality' }
    ]
};
