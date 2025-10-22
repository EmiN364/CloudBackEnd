# E-commerce REST API

A comprehensive REST API for an e-commerce platform built with Hono.js, TypeScript, and PostgreSQL.

## Features

- **User Management**: Registration, authentication, profile management
- **Product Management**: CRUD operations for products with seller controls
- **Store Management**: Store creation and management for sellers
- **Shopping Cart**: Add, remove, and manage cart items
- **Order Management**: Purchase history and order tracking
- **Reviews & Ratings**: Product reviews with validation
- **Notifications**: User notification system
- **Product Likes**: Like/unlike products functionality
- **Authentication**: AWS Cognito authentication with role-based access control

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Hono.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **Authentication**: AWS Cognito Hosted UI
- **Validation**: Zod
- **Package Manager**: pnpm

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- pnpm (recommended) or npm

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd backend-cloud
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp env.example .env
   ```

   Edit `.env` with your database credentials:

   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=your_database_name
   DB_USER=your_username
   DB_PASSWORD=your_password
   COGNITO_USER_POOL_ID=your_cognito_user_pool_id
   COGNITO_CLIENT_ID=your_cognito_client_id
   PORT=3000
   NODE_ENV=development
   ```

4. **Set up the database**

   ```bash
   # Create database
   createdb your_database_name

   # Run schema
   psql -d your_database_name -f schema.sql
   ```

5. **Start the development server**

   ```bash
   pnpm dev
   ```

The API will be available at `http://localhost:3000`

## API Endpoints

### Authentication

#### POST `/api/users/register`

Register a new user

```json
{
  "email": "user@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe",
  "is_seller": false
}
```

#### POST `/api/users/login`

Login user

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Users

#### GET `/api/users/profile`

Get current user profile (requires authentication)

#### PUT `/api/users/profile`

Update user profile (requires authentication)

#### GET `/api/users/:id`

Get public user information

### Products

#### GET `/api/products`

Get all products with pagination and filters

```plaintext
Query parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 20)
- category: Filter by category
- search: Search in name/description
- seller_id: Filter by seller
```

#### GET `/api/products/:id`

Get product by ID with reviews

#### POST `/api/products`

Create new product (seller only)

```json
{
  "name": "Product Name",
  "description": "Product description",
  "category": "Electronics",
  "price": 99.99
}
```

#### PUT `/api/products/:id`

Update product (seller only, own products)

#### DELETE `/api/products/:id`

Delete product (seller only, own products)

#### PATCH `/api/products/:id/pause`

Pause/unpause product (seller only)

### Stores

#### GET `/api/stores`

Get all stores with pagination

#### GET `/api/stores/:id`

Get store by ID

#### POST `/api/stores`

Create store (seller only)

#### PUT `/api/stores/:id`

Update store (seller only, own store)

### Cart

#### GET `/api/cart`

Get user's cart (requires authentication)

#### POST `/api/cart`

Add product to cart

```json
{
  "product_id": 1,
  "amount": 2
}
```

#### PUT `/api/cart/:productId`

Update cart item amount

#### DELETE `/api/cart/:productId`

Remove product from cart

#### DELETE `/api/cart`

Clear entire cart

### Sales

#### GET `/api/sales`

Get user's purchase history (requires authentication)

#### POST `/api/sales`

Create new sale (checkout from cart)

```json
{
  "total": 199.98,
  "status": "pending",
  "address": "123 Main St"
}
```

#### GET `/api/sales/:id`

Get sale details

#### PATCH `/api/sales/:id/cancel`

Cancel sale (if status allows)

### Reviews

#### GET `/api/reviews/product/:productId`

Get reviews for a product

#### POST `/api/reviews`

Create review (requires authentication)

```json
{
  "product_id": 1,
  "rating": 5,
  "description": "Great product!"
}
```

#### PUT `/api/reviews/:id`

Update review (requires authentication)

#### DELETE `/api/reviews/:id`

Delete review (requires authentication)

### Notifications

#### GET `/api/notifications`

Get user's notifications (requires authentication)

#### PATCH `/api/notifications/:id/read`

Mark notification as read

#### PATCH `/api/notifications/read-all`

Mark all notifications as read

### Product Likes

#### GET `/api/likes/user/me`

Get user's liked products (requires authentication)

#### POST `/api/likes`

Like a product

```json
{
  "product_id": 1
}
```

#### DELETE `/api/likes/:productId`

Unlike a product

#### POST `/api/likes/toggle/:productId`

Toggle like status

### Image Management

#### POST `/api/images/upload`

Upload single image to S3 (requires authentication)

```plaintext
Form data:
- image: file (max 5MB, image files only)
- folder: string (optional, defaults to 'products')
```

#### POST `/api/images/upload-multiple`

Upload multiple images to S3 (requires authentication)

```plaintext
Form data:
- images: files[] (max 10 images, 5MB each)
- folder: string (optional, defaults to 'products')
```

#### GET `/api/images/:id`

Get image by ID

#### DELETE `/api/images/:id`

Delete image from S3 and database (requires authentication)

#### POST `/api/images/presigned-url`

Generate presigned URL for direct S3 upload (requires authentication)

```json
{
  "filename": "image.jpg",
  "folder": "products",
  "expiresIn": 3600
}
```

#### GET `/api/images/folder/:folder`

Get images by folder with pagination

## Authentication

The API uses AWS Cognito for authentication. Include the Cognito Access Token in the Authorization header:

```plaintext
Authorization: Bearer <cognito_access_token>
```

Authentication is handled via Cognito Hosted UI - no local registration/login endpoints.

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

HTTP Status Codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

## Development

### Scripts

```bash
# Development with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Database Schema

The database schema is defined in `schema.sql` and includes:

- Users (with seller roles)
- Products
- Stores
- Sales and sales_products
- Cart products
- Reviews
- Notifications
- Product likes
- Images
- Tokens (for email confirmation/password reset)

### Project Structure

```plaintext
src/
├── config/
│   └── database.ts      # Database configuration
├── middleware/
│   └── auth.ts          # Authentication middleware
├── routes/
│   ├── users.ts         # User routes
│   ├── products.ts      # Product routes
│   ├── stores.ts        # Store routes
│   ├── cart.ts          # Cart routes
│   ├── sales.ts         # Sales routes
│   ├── reviews.ts       # Review routes
│   ├── notifications.ts # Notification routes
│   └── likes.ts         # Product likes routes
├── schemas/
│   └── validation.ts    # Zod validation schemas
└── index.ts             # Main application file
```

## Security Features

- AWS Cognito authentication
- Cognito Access Token validation
- Role-based access control
- Input validation with Zod
- SQL injection prevention with parameterized queries
- CORS configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
