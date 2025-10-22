# E-commerce API Documentation

## Overview

This is a comprehensive REST API for e-commerce operations built with Hono.js, TypeScript, and PostgreSQL. The API provides endpoints for user management, product catalog, shopping cart, sales, reviews, notifications, image management with S3 integration, and product likes.

## Base URL

```text
Development: http://localhost:3000
Production: [Your Production URL]
```

## Authentication

The API uses AWS Cognito for authentication. Include the Cognito Access Token in the Authorization header:

```text
Authorization: Bearer <cognito_access_token>
```

Authentication is handled via Cognito Hosted UI. No local registration/login endpoints are provided.

## API Endpoints

### 🔐 Authentication

#### POST `/api/users/register`

Register a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe",
  "is_seller": false
}
```

**Response (201):**

```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_seller": false,
    "is_active": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Authentication via Cognito

Authentication is handled by AWS Cognito Hosted UI. No local login endpoint.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**

```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_seller": false,
    "is_active": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 👤 Users

#### GET `/api/users/me`

Get current user profile (requires authentication).

**Response (200):**

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_seller": false,
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### PUT `/api/users/me`

Update current user profile (requires authentication).

**Request Body:**

```json
{
  "first_name": "Jane",
  "last_name": "Smith"
}
```

#### DELETE `/api/users/me`

Delete current user account (requires authentication).

#### GET `/api/users/:id`

Get public user information by ID.

### 🏪 Stores

#### GET `/api/stores`

Get paginated list of stores.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search term for store name/description

**Response (200):**

```json
{
  "stores": [
    {
      "id": 1,
      "name": "Tech Store",
      "description": "Electronics and gadgets",
      "user_id": 1,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### POST `/api/stores`

Create a new store (requires seller authentication).

**Request Body:**

```json
{
  "name": "My Store",
  "description": "Store description"
}
```

#### GET `/api/stores/me`

Get current user's store with statistics (requires seller authentication).

#### PUT `/api/stores/:id`

Update store (requires seller authentication).

#### DELETE `/api/stores/:id`

Delete store (requires seller authentication).

### 📦 Products

#### GET `/api/products`

Get paginated list of products with filtering.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search term for product name/description
- `min_price` (optional): Minimum price filter
- `max_price` (optional): Maximum price filter
- `store_id` (optional): Filter by store ID

**Response (200):**

```json
{
  "products": [
    {
      "id": 1,
      "name": "Smartphone",
      "description": "Latest smartphone model",
      "price": 599.99,
      "stock": 50,
      "store_id": 1,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### GET `/api/products/:id`

Get product details with reviews.

#### POST `/api/products`

Create a new product (requires seller authentication).

**Request Body:**

```json
{
  "name": "Product Name",
  "description": "Product description",
  "price": 99.99,
  "stock": 100,
  "store_id": 1
}
```

#### PUT `/api/products/:id`

Update product (requires seller authentication).

#### DELETE `/api/products/:id`

Soft delete product (requires seller authentication).

#### PATCH `/api/products/:id/pause`

Pause/unpause product (requires seller authentication).

#### GET `/api/products/seller/me`

Get seller's own products (requires seller authentication).

### 🛒 Shopping Cart

#### GET `/api/cart`

Get user's shopping cart (requires authentication).

**Response (200):**

```json
{
  "cart": [
    {
      "id": 1,
      "product_id": 1,
      "amount": 2,
      "product": {
        "name": "Smartphone",
        "price": 599.99,
        "stock": 50
      }
    }
  ],
  "total": 1199.98
}
```

#### POST `/api/cart`

Add product to cart (requires authentication).

**Request Body:**

```json
{
  "product_id": 1,
  "amount": 2
}
```

#### PUT `/api/cart/:productId`

Update product amount in cart (requires authentication).

**Request Body:**

```json
{
  "amount": 3
}
```

#### DELETE `/api/cart/:productId`

Remove product from cart (requires authentication).

#### DELETE `/api/cart`

Clear entire cart (requires authentication).

#### GET `/api/cart/summary`

Get cart summary (requires authentication).

### 💰 Sales & Orders

#### GET `/api/sales`

Get user's sales history (requires authentication).

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by status

**Response (200):**

```json
{
  "sales": [
    {
      "id": 1,
      "total": 1199.98,
      "status": "confirmed",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### POST `/api/sales`

Create a new sale (checkout process, requires authentication).

**Request Body:**

```json
{
  "cart_product_ids": [1, 2, 3]
}
```

#### GET `/api/sales/:id`

Get specific sale details (requires authentication).

#### PUT `/api/sales/:id`

Update sale status (requires authentication).

**Request Body:**

```json
{
  "status": "shipped"
}
```

#### GET `/api/sales/statistics`

Get sales statistics (requires authentication).

#### DELETE `/api/sales/:id`

Cancel sale (requires authentication).

### ⭐ Reviews

#### GET `/api/reviews/product/:productId`

Get reviews for a specific product.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

#### GET `/api/reviews/user/me`

Get user's own reviews (requires authentication).

#### POST `/api/reviews`

Create a product review (requires authentication, must have purchased the product).

**Request Body:**

```json
{
  "product_id": 1,
  "rating": 5,
  "comment": "Great product!"
}
```

#### PUT `/api/reviews/:id`

Update review (requires authentication).

#### DELETE `/api/reviews/:id`

Delete review (requires authentication).

### 🔔 Notifications

#### GET `/api/notifications`

Get user notifications (requires authentication).

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `unread_only` (optional): Filter unread notifications only

**Response (200):**

```json
{
  "notifications": [
    {
      "id": 1,
      "title": "Order Confirmed",
      "message": "Your order #123 has been confirmed",
      "is_read": false,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### GET `/api/notifications/:id`

Get specific notification and mark as read (requires authentication).

#### PUT `/api/notifications/:id`

Update notification (requires authentication).

#### PATCH `/api/notifications/read-all`

Mark all notifications as read (requires authentication).

#### DELETE `/api/notifications/:id`

Delete notification (requires authentication).

#### DELETE `/api/notifications/read`

Delete all read notifications (requires authentication).

### 🖼️ Image Management

#### POST `/api/images/upload`

Upload single image to S3 (requires authentication).

**Form Data:**

- `image`: File (max 5MB, image files only)
- `folder` (optional): Folder name (defaults to 'products')

**Response (201):**

```json
{
  "message": "Image uploaded successfully",
  "image": {
    "id": 1,
    "key": "products/1704067200000-image.jpg",
    "url": "https://bucket.s3.region.amazonaws.com/products/1704067200000-image.jpg",
    "size": 1024000,
    "mimetype": "image/jpeg"
  }
}
```

#### POST `/api/images/upload-multiple`

Upload multiple images to S3 (requires authentication).

**Form Data:**

- `images`: Files[] (max 10 images, 5MB each)
- `folder` (optional): Folder name (defaults to 'products')

#### GET `/api/images/:id`

Get image by ID.

#### DELETE `/api/images/:id`

Delete image from S3 and database (requires authentication).

#### POST `/api/images/presigned-url`

Generate presigned URL for direct S3 upload (requires authentication).

**Request Body:**

```json
{
  "filename": "image.jpg",
  "folder": "products",
  "expiresIn": 3600
}
```

**Response (200):**

```json
{
  "upload_url": "https://bucket.s3.region.amazonaws.com/products/...",
  "key": "products/1704067200000-image.jpg",
  "expires_in": 3600
}
```

#### GET `/api/images/folder/:folder`

Get images by folder with pagination.

### ❤️ Product Likes

#### GET `/api/likes/user/me`

Get user's liked products (requires authentication).

#### POST `/api/likes`

Like a product (requires authentication).

**Request Body:**

```json
{
  "product_id": 1
}
```

#### DELETE `/api/likes/:productId`

Unlike a product (requires authentication).

#### POST `/api/likes/toggle/:productId`

Toggle like status (requires authentication).

#### GET `/api/likes/product/:productId/count`

Get product like count.

#### GET `/api/likes/product/:productId/users`

Get users who liked a product.

## Error Handling

All endpoints return consistent error responses:

### 400 Bad Request

```json
{
  "error": "Validation error message"
}
```

### 401 Unauthorized

```json
{
  "error": "Access token required"
}
```

### 403 Forbidden

```json
{
  "error": "Seller access required"
}
```

### 404 Not Found

```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

## Pagination

Most list endpoints support pagination with the following response structure:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## File Upload

### Image Upload Limits

- **Single upload**: Max 5MB per image
- **Multiple upload**: Max 10 images, 5MB each
- **Supported formats**: All image types (JPEG, PNG, GIF, etc.)

### S3 Integration

- Images are automatically uploaded to AWS S3
- Public read access for uploaded images
- Organized by folders (products, stores, etc.)
- Automatic cleanup when images are deleted

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production use.

## CORS

CORS is enabled for the following origins:

- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:5173`

## Development

### Running the API

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp env.example .env
# Edit .env with your configuration

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Environment Variables

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password

# AWS Cognito Configuration
COGNITO_USER_POOL_ID=your_cognito_user_pool_id
COGNITO_CLIENT_ID=your_cognito_client_id

# Server Configuration
PORT=3000
NODE_ENV=development

# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_S3_BUCKET=your_s3_bucket_name
```

## Testing

### Health Check

```bash
curl http://localhost:3000/
```

### Authentication Example

```bash
# Register
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","first_name":"Test","last_name":"User"}'

# Login
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer <your_token>" \
  http://localhost:3000/api/users/me
```

## Support

For API support and questions, contact:

- Email: support@example.com
- Documentation: Available at `/docs` endpoint when running
- OpenAPI Spec: Available at `/api/openapi.json`

## Version History

- **v1.0.0**: Initial release with full CRUD operations
- Features: User management, products, stores, cart, sales, reviews, notifications, image uploads, likes
