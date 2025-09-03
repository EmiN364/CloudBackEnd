import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
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
openApiApp.openapi(
  {
    method: 'post',
    path: '/api/users/register',
    tags: ['Authentication'],
    summary: 'User Registration',
    description: 'Register a new user account',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              email: z.string().email(),
              password: z.string().min(6),
              first_name: z.string().min(1),
              last_name: z.string().min(1),
              is_seller: z.boolean().optional()
            })
          }
        }
      }
    },
    responses: {
      201: {
        description: 'User created successfully',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              user: z.object({
                id: z.number(),
                email: z.string(),
                first_name: z.string(),
                last_name: z.string(),
                is_seller: z.boolean(),
                is_active: z.boolean()
              }),
              token: z.string()
            })
          }
        }
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
          }
        }
      }
    }
  },
  (c) => c.json({ 
    message: 'User registered successfully',
    user: {
      id: 1,
      email: 'user@example.com',
      first_name: 'John',
      last_name: 'Doe',
      is_seller: false,
      is_active: true
    },
    token: 'sample_token'
  })
);

openApiApp.openapi(
  {
    method: 'post',
    path: '/api/users/login',
    tags: ['Authentication'],
    summary: 'User Login',
    description: 'Authenticate user and get JWT token',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              email: z.string().email(),
              password: z.string()
            })
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Login successful',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              user: z.object({
                id: z.number(),
                email: z.string(),
                first_name: z.string(),
                last_name: z.string(),
                is_seller: z.boolean(),
                is_active: z.boolean()
              }),
              token: z.string()
            })
          }
        }
      },
      401: {
        description: 'Invalid credentials',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
          }
        }
      }
    }
  },
  (c) => c.json({ 
    message: 'User logged in successfully',
    user: {
      id: 1,
      email: 'user@example.com',
      first_name: 'John',
      last_name: 'Doe',
      is_seller: false,
      is_active: true
    },
    token: 'sample_token'
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
              products: z.array(z.object({
                id: z.number(),
                name: z.string(),
                description: z.string(),
                price: z.number(),
                stock: z.number(),
                store_id: z.number(),
                is_active: z.boolean()
              })),
              pagination: z.object({
                page: z.number(),
                limit: z.number(),
                total: z.number(),
                totalPages: z.number(),
                hasNext: z.boolean(),
                hasPrev: z.boolean()
              })
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
        price: 29.99,
        stock: 100,
        store_id: 1,
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
            schema: z.object({
              name: z.string().min(1),
              description: z.string().min(1),
              price: z.number().positive(),
              stock: z.number().nonnegative(),
              store_id: z.number()
            })
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
              product: z.object({
                id: z.number(),
                name: z.string(),
                description: z.string(),
                price: z.number(),
                stock: z.number(),
                store_id: z.number(),
                is_active: z.boolean()
              })
            })
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
          }
        }
      },
      403: {
        description: 'Forbidden - Seller access required',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
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
      price: 29.99,
      stock: 100,
      store_id: 1,
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
            schema: z.object({ error: z.string() })
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
              image: z.object({
                id: z.number(),
                key: z.string(),
                url: z.string(),
                size: z.number(),
                mimetype: z.string()
              })
            })
          }
        }
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
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
            schema: z.object({
              cart_product_ids: z.array(z.number())
            })
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
              sale: z.object({
                id: z.number(),
                total: z.number(),
                status: z.string()
              })
            })
          }
        }
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
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
      status: 'pending'
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
            schema: z.object({
              product_id: z.number(),
              rating: z.number().min(1).max(5),
              comment: z.string().min(1)
            })
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
              review: z.object({
                id: z.number(),
                product_id: z.number(),
                rating: z.number(),
                comment: z.string()
              })
            })
          }
        }
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
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
      comment: 'Great product!'
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
            schema: z.object({
              name: z.string().min(1),
              description: z.string().min(1)
            })
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
              store: z.object({
                id: z.number(),
                name: z.string(),
                description: z.string(),
                user_id: z.number()
              })
            })
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
          }
        }
      },
      403: {
        description: 'Forbidden - Seller access required',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
          }
        }
      }
    }
  },
  (c) => c.json({
    message: 'Store created successfully',
    store: {
      id: 1,
      name: 'Sample Store',
      description: 'A sample store description',
      user_id: 1
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
              notifications: z.array(z.object({
                id: z.number(),
                title: z.string(),
                message: z.string(),
                is_read: z.boolean(),
                created_at: z.string()
              })),
              pagination: z.object({
                page: z.number(),
                limit: z.number(),
                total: z.number(),
                totalPages: z.number(),
                hasNext: z.boolean(),
                hasPrev: z.boolean()
              })
            })
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
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
        is_read: false,
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
            schema: z.object({
              product_id: z.number()
            })
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
            schema: z.object({ error: z.string() })
          }
        }
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() })
          }
        }
      }
    }
  },
  (c) => c.json({ message: 'Product liked successfully' })
);
