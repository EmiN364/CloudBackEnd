import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import {
  createProductSchema,
  productsListResponseSchema,
  productResponseSchema,
  productCreationResponseSchema,
} from "../schemas/product.schema.js";
import {
  toggleFavoriteSchema,
  toggleFavoriteResponseSchema,
} from "../schemas/favorite.schema.js";
import {
  createReviewSchema,
  paginatedReviewsResponseSchema,
  reviewsQuerySchema,
} from "../schemas/review.schema.js";
import {
  createSaleSchema,
  saleCreationResponseSchema,
  salesListResponseSchema,
  saleWithProductsResponseSchema,
} from "../schemas/sale.schema.js";
import {
  userProfileResponseSchema,
  userProfileUpdateSchema,
} from "../schemas/user.schema.js";
import {
  storesListResponseSchema,
  singleStoreResponseSchema,
  storeUpdateSchema,
  storeUpdateResponseSchema,
} from "../schemas/store.schema.js";

// Create OpenAPI app
export const openApiApp = new OpenAPIHono();

// Error schema for responses
const ErrorSchema = z.object({
  error: z.string(),
});

// Health check
openApiApp.openapi(
  {
    method: "get",
    path: "/",
    tags: ["Health"],
    summary: "Health Check",
    description: "Check if the API is running",
    responses: {
      200: {
        description: "API is running",
        content: {
          "application/json": {
            schema: z.object({
              message: z.string(),
              version: z.string(),
              timestamp: z.string(),
            }),
          },
        },
      },
    },
  },
  (c) => {
    return c.json({
      message: "E-commerce API is running",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  },
);

// Users routes
openApiApp.openapi(
  {
    method: "get",
    path: "/api/users/profile",
    tags: ["Users"],
    summary: "Get User Profile",
    description: "Get the current user profile information",
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "User profile retrieved successfully",
        content: {
          "application/json": {
            schema: userProfileResponseSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      user: {
        id: 1,
        cognito_sub: "sample-cognito-sub",
        email: "user@example.com",
        email_verified: true,
        phone_number: "+1234567890",
        given_name: "John",
        family_name: "Doe",
        username: "johndoe",
        cognito_username: "johndoe",
        is_seller: false,
        deleted: false,
        address: "123 Main St",
        profile_picture: null,
      },
    }),
);

// Update user profile
openApiApp.openapi(
  {
    method: "put",
    path: "/api/users/profile",
    tags: ["Users"],
    summary: "Update User Profile",
    description:
      "Update user profile information (address and profile picture)",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: userProfileUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "User profile updated successfully",
        content: {
          "application/json": {
            schema: userProfileResponseSchema,
          },
        },
      },
      400: {
        description: "Bad request - Invalid data or no fields to update",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "User not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      user: {
        id: 1,
        cognito_sub: "sample-cognito-sub",
        email: "user@example.com",
        email_verified: true,
        phone_number: "+1234567890",
        given_name: "John",
        family_name: "Doe",
        username: "johndoe",
        cognito_username: "johndoe",
        is_seller: false,
        deleted: false,
        address: "456 Updated St",
        profile_picture: "https://example.com/profile.jpg",
      },
    }),
);

// Products routes
openApiApp.openapi(
  {
    method: "get",
    path: "/api/products",
    tags: ["Products"],
    summary: "Get Products",
    description: "Get paginated list of products with optional filtering",
    request: {
      query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        category: z.string().optional(),
        search: z.string().optional(),
        seller_id: z.string().optional(),
        liked: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "Products retrieved successfully",
        content: {
          "application/json": {
            schema: productsListResponseSchema,
          },
        },
      },
      401: {
        description:
          "Unauthorized (when liked filter is used without authentication)",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      products: [
        {
          id: 1,
          name: "Sample Product",
          description: "A sample product description",
          category: "Electronics",
          price: 29.99,
          stock: 10,
          paused: false,
          image_url: "https://example.com/image.jpg",
          seller_id: 1,
          rating: 4.5,
          ratingCount: 10,
          is_favorite: false,
          store_id: 1,
          store_name: "Sample Store",
          store_image_url: "https://example.com/store-image.jpg",
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    }),
);

openApiApp.openapi(
  {
    method: "get",
    path: "/api/products/{id}",
    tags: ["Products"],
    summary: "Get Product by ID",
    description: "Get a specific product by its ID",
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Product retrieved successfully",
        content: {
          "application/json": {
            schema: z.object({
              product: productResponseSchema,
            }),
          },
        },
      },
      400: {
        description: "Invalid product ID",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Product not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      product: {
        id: 1,
        name: "Sample Product",
        description: "A sample product description",
        category: "Electronics",
        price: 29.99,
        stock: 10,
        paused: false,
        image_url: "https://example.com/image.jpg",
        seller_id: 1,
        rating: 4.5,
        ratingCount: 10,
        is_favorite: false,
        store_id: 1,
        store_name: "Sample Store",
        store_image_url: "https://example.com/store-image.jpg",
      },
    }),
);

openApiApp.openapi(
  {
    method: "post",
    path: "/api/products",
    tags: ["Products"],
    summary: "Create Product",
    description: "Create a new product (requires authentication)",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: createProductSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Product created successfully",
        content: {
          "application/json": {
            schema: productCreationResponseSchema,
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "User not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      message: "Product created successfully",
      product: {
        id: 1,
        name: "Sample Product",
        description: "A sample product description",
        category: "Electronics",
        price: 29.99,
        stock: 10,
        seller_id: 1,
        image_url: "https://example.com/image.jpg",
        store_id: 1,
        store_name: "Sample Store",
        store_image_url: "https://example.com/store-image.jpg",
      },
    }),
);

// Favorites routes
openApiApp.openapi(
  {
    method: "post",
    path: "/api/favorites/toggle",
    tags: ["Favorites"],
    summary: "Toggle Product Favorite",
    description: "Add or remove a product from user favorites",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: toggleFavoriteSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Favorite status toggled successfully",
        content: {
          "application/json": {
            schema: toggleFavoriteResponseSchema,
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "User or product not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      message: "Product added to favorites",
      is_favorite: true,
    }),
);

// Reviews routes
openApiApp.openapi(
  {
    method: "get",
    path: "/api/reviews",
    tags: ["Reviews"],
    summary: "Get Product Reviews",
    description: "Get paginated reviews for a specific product",
    request: {
      query: reviewsQuerySchema.omit({ product_id: true }).extend({
        product_id: z.string(),
        page: z.string().optional(),
        limit: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "Reviews retrieved successfully",
        content: {
          "application/json": {
            schema: paginatedReviewsResponseSchema,
          },
        },
      },
      400: {
        description: "Invalid query parameters",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Product not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      reviews: [
        {
          id: 1,
          description: "Great product!",
          rating: 5,
          timestamp: new Date().toISOString(),
          given_name: "John",
          family_name: "Doe",
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    }),
);

openApiApp.openapi(
  {
    method: "post",
    path: "/api/reviews",
    tags: ["Reviews"],
    summary: "Create Review",
    description: "Create a product review (requires authentication)",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: createReviewSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Review created successfully",
        content: {
          "application/json": {
            schema: z.object({
              message: z.string(),
              review: z.object({
                id: z.number(),
                description: z.string().nullable(),
                rating: z.number(),
                product_id: z.number(),
                user_id: z.number(),
                timestamp: z.string(),
              }),
            }),
          },
        },
      },
      400: {
        description: "Bad request or user already reviewed this product",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "User or product not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      message: "Review created successfully",
      review: {
        id: 1,
        description: "Great product!",
        rating: 5,
        product_id: 1,
        user_id: 1,
        timestamp: new Date().toISOString(),
      },
    }),
);

// Sales routes
openApiApp.openapi(
  {
    method: "post",
    path: "/api/sales",
    tags: ["Sales"],
    summary: "Create Sale",
    description: "Create a new sale with products (requires authentication)",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: createSaleSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Sale created successfully",
        content: {
          "application/json": {
            schema: saleCreationResponseSchema,
          },
        },
      },
      400: {
        description: "Bad request or products not available",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "User or products not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      message: "Sale created successfully",
      sale: {
        id: 1,
        user_id: 1,
        date: new Date().toISOString(),
        total_amount: 59.98,
        status: "completed",
        note: "Sample sale",
        invoice_id: 1732012345678123,
        address: "123 Main St",
        products: [
          {
            product_id: 1,
            quantity: 2,
            unit_price: 29.99,
            total_price: 59.98,
            product_name: "Sample Product",
            product_description: "A sample product description",
            product_category: "Electronics",
            product_image_url: "https://example.com/image.jpg",
          },
        ],
      },
    }),
);

openApiApp.openapi(
  {
    method: "get",
    path: "/api/sales",
    tags: ["Sales"],
    summary: "Get User Sales",
    description: "Get paginated list of user sales (requires authentication)",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        status: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "Sales retrieved successfully",
        content: {
          "application/json": {
            schema: salesListResponseSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "User not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      sales: [
        {
          id: 1,
          user_id: 1,
          date: new Date().toISOString(),
          total_amount: 59.98,
          status: "completed",
          note: "Sample sale",
          invoice_id: 1732012345678123,
          address: "123 Main St",
          products: [
            {
              product_id: 1,
              quantity: 2,
              unit_price: 29.99,
              total_price: 59.98,
              product_name: "Sample Product",
              product_description: "A sample product description",
              product_category: "Electronics",
              product_image_url: "https://example.com/image.jpg",
            },
          ],
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    }),
);

openApiApp.openapi(
  {
    method: "get",
    path: "/api/sales/{id}",
    tags: ["Sales"],
    summary: "Get Sale by ID",
    description: "Get a specific sale by its ID (requires authentication)",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Sale retrieved successfully",
        content: {
          "application/json": {
            schema: z.object({
              sale: saleWithProductsResponseSchema,
            }),
          },
        },
      },
      400: {
        description: "Invalid sale ID",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Sale or user not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      sale: {
        id: 1,
        user_id: 1,
        date: new Date().toISOString(),
        total_amount: 59.98,
        status: "completed",
        note: "Sample sale",
        invoice_id: 1732012345678123,
        address: "123 Main St",
        products: [
          {
            product_id: 1,
            quantity: 2,
            unit_price: 29.99,
            total_price: 59.98,
            product_name: "Sample Product",
            product_description: "A sample product description",
            product_category: "Electronics",
            product_image_url: "https://example.com/image.jpg",
          },
        ],
      },
    }),
);
// Stores routes
openApiApp.openapi(
  {
    method: "get",
    path: "/api/stores",
    tags: ["Stores"],
    summary: "Get Stores",
    description: "Get paginated list of all stores",
    request: {
      query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "Stores retrieved successfully",
        content: {
          "application/json": {
            schema: storesListResponseSchema,
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      stores: [
        {
          store_id: 1,
          store_name: "Sample Store",
          description: "A sample store description",
          store_image_url: "https://example.com/store-image.jpg",
          cover_image_url: "https://example.com/cover-image.jpg",
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    }),
);

openApiApp.openapi(
  {
    method: "get",
    path: "/api/stores/{id}",
    tags: ["Stores"],
    summary: "Get Store by ID",
    description: "Get a specific store by its ID",
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Store retrieved successfully",
        content: {
          "application/json": {
            schema: singleStoreResponseSchema,
          },
        },
      },
      400: {
        description: "Invalid store ID",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Store not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      store: {
        store_id: 1,
        store_name: "Sample Store",
        description: "A sample store description",
        store_image_url: "https://example.com/store-image.jpg",
        cover_image_url: "https://example.com/cover-image.jpg",
      },
    }),
);

openApiApp.openapi(
  {
    method: "put",
    path: "/api/stores/{id}",
    tags: ["Stores"],
    summary: "Update Store",
    description: "Update store information (requires authentication and store ownership)",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string(),
      }),
      body: {
        content: {
          "application/json": {
            schema: storeUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Store updated successfully",
        content: {
          "application/json": {
            schema: storeUpdateResponseSchema,
          },
        },
      },
      400: {
        description: "Invalid store ID or no fields to update",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      403: {
        description: "Forbidden - You can only update your own store",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      404: {
        description: "Store or user not found",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
      },
    },
  },
  (c) =>
    c.json({
      message: "Store updated successfully",
      store: {
        store_id: 1,
        store_name: "Updated Store Name",
        description: "Updated store description",
        store_image_url: "https://example.com/updated-store-image.jpg",
        cover_image_url: "https://example.com/updated-cover-image.jpg",
      },
    }),
);