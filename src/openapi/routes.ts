import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import {
  CartProductSchema,
  CreateCartProductSchema,
  CreateNotificationSchema,
  CreateProductLikeSchema,
  CreateProductSchema,
  CreateReviewSchema,
  CreateSaleSchema,
  CreateStoreSchema,
  CreateUserSchema,
  ErrorSchema,
  LoginSchema,
  NotificationSchema,
  PaginationSchema,
  ProductSchema,
  ReviewSchema,
  SaleSchema,
  StoreSchema,
  UploadedImageSchema,
  UserSchema
} from '../schemas/unified.js';
import { openApiConfig } from './spec.js';

// Create OpenAPI app
export const openApiApp = new OpenAPIHono();

// Health check
openApiApp.openapi(
  {
    method: 'get',
    path: '/',
    tags: ['Health'],
    summary: 'Health Check',
    description: 'Check if the API is running',
    responses: {
      200: {
        description: 'API is running',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              version: z.string(),
              timestamp: z.string()
            })
          }
        }
      }
    }
  },
  (c) => {
    return c.json({
      message: 'E-commerce API is running',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  }
);

// Users routes
// Note: Registration and login are handled by AWS Cognito Hosted UI

openApiApp.openapi(
  {
    method: 'post',
    path: '/api/users/promote-to-seller',
    tags: ['Users'],
    summary: 'Promote to Seller',
    description: 'Promote authenticated user to seller status',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'User promoted to seller successfully',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              user: UserSchema.omit({ created_at: true, updated_at: true })
            })
          }
        }
      },
      400: {
        description: 'User is already a seller',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      }
    }
  },
  (c) => c.json({
    message: 'User promoted to seller successfully',
    user: {
      id: 1,
      email: 'user@example.com',
      phone: '+1234567890',
      first_name: 'John',
      last_name: 'Doe',
      is_seller: true,
      is_active: true,
      locale: 'en',
      address: '123 Main St'
    }
  })
);


// Products routes
openApiApp.openapi(
  {
    method: 'get',
    path: '/api/products',
    tags: ['Products'],
    summary: 'Get Products',
    description: 'Get paginated list of products with optional filtering',
    request: {
      query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        search: z.string().optional(),
        min_price: z.string().optional(),
        max_price: z.string().optional(),
        store_id: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Products retrieved successfully',
        content: {
          'application/json': {
            schema: z.object({
              products: z.array(ProductSchema.omit({ created_at: true, updated_at: true })),
              pagination: PaginationSchema
            })
          }
        }
      }
    }
  },
  (c) => c.json({
    products: [
      {
        id: 1,
        name: 'Sample Product',
        description: 'A sample product description',
        category: 'Electronics',
        price: 29.99,
        stock: 100,
        store_id: 1,
        image_url: 'https://example.com/image.jpg',
        paused: false,
        is_active: true
      }
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    }
  })
);

openApiApp.openapi(
  {
    method: 'post',
    path: '/api/products',
    tags: ['Products'],
    summary: 'Create Product',
    description: 'Create a new product (seller only)',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateProductSchema
          }
        }
      }
    },
    responses: {
      201: {
        description: 'Product created successfully',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              product: ProductSchema.omit({ created_at: true, updated_at: true })
            })
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      },
      403: {
        description: 'Forbidden - Seller access required',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      }
    }
  },
  (c) => c.json({
    message: 'Product created successfully',
    product: {
      id: 1,
      name: 'Sample Product',
      description: 'A sample product description',
      category: 'Electronics',
      price: 29.99,
      stock: 100,
      store_id: 1,
      image_url: 'https://example.com/image.jpg',
      paused: false,
      is_active: true
    }
  })
);

// Cart routes
openApiApp.openapi(
  {
    method: 'get',
    path: '/api/cart',
    tags: ['Cart'],
    summary: 'Get User Cart',
    description: 'Get the current user\'s shopping cart',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Cart retrieved successfully',
        content: {
          'application/json': {
            schema: z.object({
              cart: z.array(z.object({
                id: z.number(),
                product_id: z.number(),
                amount: z.number(),
                product: z.object({
                  name: z.string(),
                  price: z.number(),
                  stock: z.number()
                })
              })),
              total: z.number()
            })
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      }
    }
  },
  (c) => c.json({
    cart: [
      {
        id: 1,
        product_id: 1,
        amount: 2,
        product: {
          name: 'Sample Product',
          price: 29.99,
          stock: 100
        }
      }
    ],
    total: 59.98
  })
);

// Images routes
openApiApp.openapi(
  {
    method: 'post',
    path: '/api/images/upload',
    tags: ['Images'],
    summary: 'Upload Image',
    description: 'Upload a single image to S3',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              image: z.any(),
              folder: z.string().optional()
            })
          }
        }
      }
    },
    responses: {
      201: {
        description: 'Image uploaded successfully',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              image: UploadedImageSchema
            })
          }
        }
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      }
    }
  },
  (c) => c.json({
    message: 'Image uploaded successfully',
    image: {
      id: 1,
      key: 'products/sample-image.jpg',
      url: 'https://example-bucket.s3.amazonaws.com/products/sample-image.jpg',
      size: 1024,
      mimetype: 'image/jpeg'
    }
  })
);

// Sales routes
openApiApp.openapi(
  {
    method: 'post',
    path: '/api/sales',
    tags: ['Sales'],
    summary: 'Create Sale',
    description: 'Create a new sale from cart items',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateSaleSchema
          }
        }
      }
    },
    responses: {
      201: {
        description: 'Sale created successfully',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              sale: SaleSchema.omit({ created_at: true, updated_at: true, user_id: true })
            })
          }
        }
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      }
    }
  },
  (c) => c.json({
    message: 'Sale created successfully',
    sale: {
      id: 1,
      total: 59.98,
      status: 'pending' as const,
      note: 'Sample sale',
      invoice_id: 1,
      address: '123 Main St'
    }
  })
);

// Reviews routes
openApiApp.openapi(
  {
    method: 'post',
    path: '/api/reviews',
    tags: ['Reviews'],
    summary: 'Create Review',
    description: 'Create a product review',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateReviewSchema
          }
        }
      }
    },
    responses: {
      201: {
        description: 'Review created successfully',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              review: ReviewSchema.omit({ created_at: true, updated_at: true, user_id: true })
            })
          }
        }
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      }
    }
  },
  (c) => c.json({
    message: 'Review created successfully',
    review: {
      id: 1,
      product_id: 1,
      rating: 5,
      description: 'Great product!'
    }
  })
);

// Stores routes
openApiApp.openapi(
  {
    method: 'post',
    path: '/api/stores',
    tags: ['Stores'],
    summary: 'Create Store',
    description: 'Create a new store (seller only)',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateStoreSchema
          }
        }
      }
    },
    responses: {
      201: {
        description: 'Store created successfully',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              store: StoreSchema.omit({ created_at: true, updated_at: true })
            })
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      },
      403: {
        description: 'Forbidden - Seller access required',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      }
    }
  },
  (c) => c.json({
    message: 'Store created successfully',
    store: {
      id: 1,
      store_name: 'Sample Store',
      description: 'A sample store description',
      user_id: 1,
      store_image_url: 'https://example.com/image.jpg',
      cover_image_url: 'https://example.com/image.jpg',
      cbu: '1234567890123456789012'
    }
  })
);

// Notifications routes
openApiApp.openapi(
  {
    method: 'get',
    path: '/api/notifications',
    tags: ['Notifications'],
    summary: 'Get User Notifications',
    description: 'Get user notifications with optional filters',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        page: z.string().optional(),
        limit: z.string().optional(),
        unread_only: z.string().optional()
      })
    },
    responses: {
      200: {
        description: 'Notifications retrieved successfully',
        content: {
          'application/json': {
            schema: z.object({
              notifications: z.array(NotificationSchema.omit({ updated_at: true, user_id: true })),
              pagination: PaginationSchema
            })
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      }
    }
  },
  (c) => c.json({
    notifications: [
      {
        id: 1,
        title: 'Welcome',
        message: 'Welcome to our platform!',
        type: 'WELCOME',
        product_id: undefined,
        read: false,
        created_at: new Date().toISOString()
      }
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    }
  })
);

// Likes routes
openApiApp.openapi(
  {
    method: 'post',
    path: '/api/likes',
    tags: ['Likes'],
    summary: 'Like Product',
    description: 'Like a product',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateProductLikeSchema
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Product liked successfully',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string()
            })
          }
        }
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: ErrorSchema
          }
        }
      }
    }
  },
  (c) => c.json({ message: 'Product liked successfully' })
);
