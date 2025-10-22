# Cognito Authentication Implementation Guide

## Overview

Your project now has a complete Cognito authentication system with three types of middleware:

1. **`authMiddleware`** - Requires valid authentication
2. **`sellerMiddleware`** - Requires authentication + seller role
3. **`optionalAuthMiddleware`** - Sets user if authenticated, but allows unauthenticated access

## Environment Variables

Add these to your `.env` file:

```env
# AWS Cognito Configuration
COGNITO_USER_POOL_ID=your_cognito_user_pool_id
COGNITO_CLIENT_ID=your_cognito_client_id
```

## Authentication Flow

With Cognito Hosted UI, the authentication flow works as follows:

1. **User accesses frontend** (hosted on S3)
2. **Frontend redirects to Cognito Hosted UI** for authentication
3. **Cognito redirects to `/callback`** (API Gateway endpoint that invokes a Lambda)
4. **Lambda function**:
   - Exchanges the authorization code for tokens
   - Redirects to frontend with tokens (e.g., `https://mi-app.com/#token=...`)
5. **Frontend**:
   - Reads tokens from URL and saves them (localStorage, etc.)
   - Uses Access Token for API calls

## How It Works

### 1. Token Verification

- Uses AWS Cognito JWT Verifier to validate Cognito Access Tokens
- Extracts user information from Cognito token payload
- Automatically creates local user records if they don't exist
- No local JWT generation - all tokens come from Cognito

### 2. User Mapping

- Maps Cognito attributes to your local user schema:
  - `email` or `username` → `email`
  - `given_name` → `first_name`
  - `family_name` → `last_name`
  - New users default to `is_seller: false`, `is_active: true`

### 3. Context Setting

- Authenticated user data is available via `c.get('user')` in route handlers
- User object includes: `id`, `email`, `is_seller`, `is_active`

## Route Classification

### Public Routes (No Authentication Required)

```typescript
// Products
GET /api/products              // Browse all products
GET /api/products/:id          // View product details

// Stores
GET /api/stores                // Browse all stores
GET /api/stores/:id            // View store details

// Users
GET /api/users/:id             // View public user info
// Note: Registration and login are handled by Cognito Hosted UI

// Reviews
GET /api/reviews/product/:productId  // View product reviews
GET /api/reviews/:id                 // View specific review

// Likes
GET /api/likes/product/:productId/count  // Get like count
GET /api/likes/product/:productId/users  // Get users who liked

// Images
GET /api/images/:id                      // View image
GET /api/images/folder/:folder           // Browse images by folder
```

### Authenticated User Routes (authMiddleware)

```typescript
// User Profile
GET /api/users/profile         // Get own profile
PUT /api/users/profile         // Update own profile
POST /api/users/promote-to-seller // Promote self to seller
DELETE /api/users/profile      // Delete own account

// Cart Management
GET /api/cart                  // View cart
POST /api/cart                 // Add to cart
PUT /api/cart/:productId       // Update cart item
DELETE /api/cart/:productId    // Remove from cart
DELETE /api/cart               // Clear cart
GET /api/cart/summary          // Cart summary

// Sales/Orders
GET /api/sales                 // View purchase history
GET /api/sales/:id             // View specific order
POST /api/sales                // Create new order
PUT /api/sales/:id/status      // Update order status
GET /api/sales/stats/summary   // Sales statistics

// Reviews
GET /api/reviews/user/me       // Get own reviews
POST /api/reviews              // Create review
PUT /api/reviews/:id           // Update own review
DELETE /api/reviews/:id        // Delete own review

// Notifications
GET /api/notifications         // Get notifications
GET /api/notifications/:id     // Get specific notification
POST /api/notifications        // Create notification
PUT /api/notifications/:id     // Update notification
DELETE /api/notifications/:id  // Delete notification
DELETE /api/notifications/read // Delete read notifications

// Likes
GET /api/likes/user/me         // Get own likes
GET /api/likes/check/:productId // Check if liked
POST /api/likes                // Like product
DELETE /api/likes/:productId   // Unlike product
POST /api/likes/toggle/:productId // Toggle like

// Images
POST /api/images/upload        // Upload single image
POST /api/images/upload-multiple // Upload multiple images
DELETE /api/images/:id         // Delete image
POST /api/images/presigned-url // Get presigned URL
```

### Seller-Only Routes (authMiddleware + sellerMiddleware)

```typescript
// Product Management
POST /api/products             // Create product
PUT /api/products/:id          // Update own product
DELETE /api/products/:id       // Delete own product
GET /api/products/seller/me    // Get own products

// Store Management
POST /api/stores               // Create store
PUT /api/stores/:id            // Update own store
DELETE /api/stores/:id         // Delete own store
GET /api/stores/me/store       // Get own store
```

## Usage Examples

### 1. Public Endpoint (No Auth Required)

```typescript
// No middleware needed
products.get("/", async (c) => {
  // Anyone can access this
});
```

### 2. Authenticated User Endpoint

```typescript
import { authMiddleware } from "../middleware/auth.js";

// Requires valid JWT token
cart.get("/", authMiddleware, async (c) => {
  const user = c.get("user"); // User is guaranteed to exist
  // User-specific logic here
});
```

### 3. Seller-Only Endpoint

```typescript
import { authMiddleware, sellerMiddleware } from "../middleware/auth.js";

// Requires valid JWT token AND seller role
products.post("/", authMiddleware, sellerMiddleware, async (c) => {
  const user = c.get("user"); // User exists and is_seller = true
  // Seller-specific logic here
});
```

### 4. Optional Authentication

```typescript
import { optionalAuthMiddleware } from "../middleware/auth.js";

// Works with or without authentication
products.get("/", optionalAuthMiddleware, async (c) => {
  const user = c.get("user"); // May be undefined
  if (user) {
    // Personalized response for authenticated users
  } else {
    // Generic response for anonymous users
  }
});
```

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Access token required"
}
```

or

```json
{
  "error": "Invalid token"
}
```

### 403 Forbidden

```json
{
  "error": "Seller access required"
}
```

## Implementation Notes

1. **Automatic User Creation**: When a user authenticates with Cognito for the first time, a local user record is automatically created in your PostgreSQL database.

2. **Role Management**: Users default to non-seller status. Users can promote themselves to sellers via the `/api/users/promote-to-seller` endpoint.

3. **Token Format**: Expects `Authorization: Bearer <cognito_access_token>` header.

4. **Database Sync**: The middleware ensures Cognito users exist in your local database, maintaining consistency between Cognito and your application data.

5. **Error Handling**: Failed authentication attempts are logged but don't expose sensitive information to clients.

6. **No Local JWT**: This system does not generate JWT tokens locally - all authentication is handled by AWS Cognito.

## Next Steps

1. **Set up your Cognito User Pool** and get the User Pool ID and Client ID
2. **Update your .env file** with the Cognito configuration
3. **Test the authentication flow** with your frontend application
4. **Implement user role management** if you need to promote users to sellers
5. **Consider implementing refresh token handling** for long-lived sessions

## Security Considerations

- JWT tokens are verified against AWS Cognito
- User data is automatically synced between Cognito and local database
- Seller permissions are enforced at the middleware level
- All authentication errors are logged for monitoring
- No sensitive user data is exposed in error messages
