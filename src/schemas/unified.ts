import { z } from 'zod';

// Base schemas
export const ErrorSchema = z.object({
  error: z.string()
});

export const PaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
});

// User schemas
export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  phone: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  is_seller: z.boolean(),
  is_active: z.boolean(),
  locale: z.string().default('en'),
  address: z.string().default(''),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateUserSchema = z.object({
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

export const UpdateUserSchema = z.object({
  phone: z.string().optional(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  is_seller: z.boolean().optional(),
  is_active: z.boolean().optional(),
  locale: z.string().optional(),
  address: z.string().optional()
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// Product schemas
export const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string(),
  price: z.number().positive(),
  stock: z.number().nonnegative().optional(),
  store_id: z.number().optional(),
  image_url: z.string().optional(),
  paused: z.boolean().optional(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  price: z.number().positive(),
  stock: z.number().nonnegative().optional(),
  store_name: z.string().optional(),
  image_url: z.string().optional(),
  email: z.string().email()
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  stock: z.number().nonnegative().optional(),
  image_url: z.string().optional(),
  paused: z.boolean().optional()
});

// Store schemas
export const StoreSchema = z.object({
  id: z.number(),
  store_name: z.string(),
  description: z.string().optional(),
  user_id: z.number(),
  store_image_url: z.string().optional(),
  cover_image_url: z.string().optional(),
  cbu: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateStoreSchema = z.object({
  store_name: z.string().min(1),
  description: z.string().optional(),
  store_image_url: z.string().optional(),
  cover_image_url: z.string().optional(),
  cbu: z.string().optional()
});

export const UpdateStoreSchema = z.object({
  store_name: z.string().min(1).optional(),
  description: z.string().optional(),
  store_image_url: z.string().optional(),
  cover_image_url: z.string().optional(),
  cbu: z.string().optional()
});

// Cart schemas
export const CartProductSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  product_id: z.number(),
  amount: z.number().positive(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateCartProductSchema = z.object({
  product_id: z.number().positive(),
  amount: z.number().positive().default(1)
});

export const UpdateCartProductSchema = z.object({
  amount: z.number().positive()
});

// Sales schemas
export const SaleSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  total: z.number().positive(),
  status: z.enum(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
  note: z.string().optional(),
  invoice_id: z.number().optional(),
  address: z.string().default(''),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateSaleSchema = z.object({
  total: z.number().positive(),
  status: z.string().optional(),
  note: z.string().optional(),
  invoice_id: z.number().optional(),
  address: z.string().default(''),
  cart_product_ids: z.array(z.number()).optional()
});

export const UpdateSaleSchema = z.object({
  total: z.number().positive().optional(),
  status: z.string().optional(),
  note: z.string().optional(),
  invoice_id: z.number().optional(),
  address: z.string().optional()
});

// Sale Product schemas
export const SaleProductSchema = z.object({
  id: z.number(),
  sale_id: z.number(),
  product_id: z.number(),
  price: z.number().positive(),
  amount: z.number().positive(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateSaleProductSchema = z.object({
  product_id: z.number().positive(),
  price: z.number().positive(),
  amount: z.number().positive().default(1)
});

// Review schemas
export const ReviewSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  product_id: z.number(),
  rating: z.number().min(1).max(5),
  description: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateReviewSchema = z.object({
  product_id: z.number().positive(),
  rating: z.number().min(1).max(5),
  description: z.string().optional()
});

export const UpdateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  description: z.string().optional()
});

// Notification schemas
export const NotificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string().optional(),
  message: z.string(),
  type: z.string().default('OTHER'),
  product_id: z.number().optional(),
  read: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateNotificationSchema = z.object({
  title: z.string().min(1).optional(),
  message: z.string().min(1),
  type: z.string().default('OTHER'),
  product_id: z.number().optional()
});

export const UpdateNotificationSchema = z.object({
  title: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  type: z.string().optional(),
  read: z.boolean().optional()
});

// Image schemas
export const ImageSchema = z.object({
  id: z.number(),
  image: z.string().url()
});

export const UploadedImageSchema = z.object({
  id: z.number(),
  key: z.string(),
  url: z.string().url(),
  size: z.number(),
  mimetype: z.string()
});

// Product Like schemas
export const ProductLikeSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  product_id: z.number(),
  created_at: z.string().datetime()
});

export const CreateProductLikeSchema = z.object({
  product_id: z.number().positive()
});

// Token schemas
export const CreateTokenSchema = z.object({
  email: z.string().email(),
  type: z.enum(['confirm', 'reset'])
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
    },
    {
      url: 'http://localhost:3001',
      description: 'Development server 2'
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
      SaleProduct: SaleProductSchema,
      CreateSaleProduct: CreateSaleProductSchema,
      Review: ReviewSchema,
      CreateReview: CreateReviewSchema,
      UpdateReview: UpdateReviewSchema,
      Notification: NotificationSchema,
      CreateNotification: CreateNotificationSchema,
      UpdateNotification: UpdateNotificationSchema,
      UploadedImage: UploadedImageSchema,
      ProductLike: ProductLikeSchema,
      CreateProductLike: CreateProductLikeSchema,
      CreateToken: CreateTokenSchema
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
