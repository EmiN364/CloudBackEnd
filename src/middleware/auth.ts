import type { Context, Next } from "hono";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import pool from "../config/database.js";

export interface AuthenticatedUser {
  id: number;
  email: string;
  is_seller: boolean;
  is_active: boolean;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthenticatedUser;
  }
}

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID!,
});

// Helper function to get or create user from Cognito data
async function getUserFromCognito(cognitoPayload: any): Promise<AuthenticatedUser> {
  const email = cognitoPayload.email || cognitoPayload.username;
  
  if (!email) {
    throw new Error('No email found in Cognito token');
  }

  // Try to find existing user
  const existingUser = await pool.query(
    'SELECT id, email, is_seller, is_active FROM users WHERE email = $1 AND deleted = false',
    [email]
  );

  if (existingUser.rows.length > 0) {
    return existingUser.rows[0];
  }

  // Create new user if doesn't exist
  const newUser = await pool.query(
    `INSERT INTO users (email, first_name, last_name, is_seller, is_active, phone, locale, address) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
     RETURNING id, email, is_seller, is_active`,
    [
      email,
      cognitoPayload.given_name || '',
      cognitoPayload.family_name || '',
      false, // Default to non-seller
      true,  // Default to active
      cognitoPayload.phone_number || null,
      cognitoPayload.locale || 'en',
      cognitoPayload.address || ''
    ]
  );

  return newUser.rows[0];
}

export const authMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Access token required" }, 401);
    }

    const token = authHeader.substring(7);
    
    // Verify token with Cognito
    const payload = await verifier.verify(token);

    // Get or create user from Cognito data
    const user = await getUserFromCognito(payload);
    
    // Check if user is active
    if (!user.is_active) {
      return c.json({ error: "Account is not active" }, 401);
    }
    
    // Set user in context
    c.set('user', user);

    await next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        return c.json({ error: "Token has expired" }, 401);
      }
      if (error.message.includes('invalid')) {
        return c.json({ error: "Invalid token" }, 401);
      }
    }
    
    return c.json({ error: "Authentication failed" }, 401);
  }
};

// Optional auth middleware - sets user if token is present but doesn't require it
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header("Authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const payload = await verifier.verify(token);
      const user = await getUserFromCognito(payload);
      
      // Only set user if account is active
      if (user.is_active) {
        c.set('user', user);
      }
    }
    // Continue regardless of auth status
    await next();
  } catch (error) {
    // Log error but continue without auth
    console.warn("Optional auth failed:", error);
    await next();
  }
};

export const sellerMiddleware = async (c: Context, next: Next) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  if (!user.is_active) {
    return c.json({ error: 'Account is not active' }, 401);
  }
  
  if (!user.is_seller) {
    return c.json({ error: 'Seller access required' }, 403);
  }

  await next();
};

// Utility function to get current user (for use in route handlers)
export const getCurrentUser = (c: Context): AuthenticatedUser => {
  const user = c.get('user');
  if (!user) {
    throw new Error('User not found in context');
  }
  return user;
};

// Utility function to check if user exists and is active
export const isUserActive = async (userId: number): Promise<boolean> => {
  try {
    const result = await pool.query(
      'SELECT is_active FROM users WHERE id = $1 AND deleted = false',
      [userId]
    );
    return result.rows.length > 0 && result.rows[0].is_active;
  } catch (error) {
    console.error('Error checking user status:', error);
    return false;
  }
};
