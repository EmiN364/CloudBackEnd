import { OpenAPIHono } from '@hono/zod-openapi';
import {
  CartProductSchema,
  CreateCartProductSchema,
  CreateNotificationSchema,
  CreateProductLikeSchema,
  CreateProductSchema,
  CreateReviewSchema,
  CreateSaleProductSchema,
  CreateSaleSchema,
  CreateStoreSchema,
  CreateTokenSchema,
  CreateUserSchema,
  ErrorSchema,
  ImageSchema,
  LoginSchema,
  NotificationSchema,
  openApiConfig,
  PaginationSchema,
  ProductLikeSchema,
  ProductSchema,
  ReviewSchema,
  SaleProductSchema,
  SaleSchema,
  StoreSchema,
  UpdateCartProductSchema,
  UpdateNotificationSchema,
  UpdateProductSchema,
  UpdateReviewSchema,
  UpdateSaleSchema,
  UpdateStoreSchema,
  UpdateUserSchema,
  UploadedImageSchema,
  UserSchema
} from '../schemas/unified.js';

// Re-export the unified openApiConfig
export { openApiConfig };

