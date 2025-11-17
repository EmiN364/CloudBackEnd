import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { COGNITO_REGION, COGNITO_USER_POOL_ID } from "../config/cognito.js";
import pool from "../config/database.js";

// The 'issuer' is the non-negotiable URL of your User Pool
const COGNITO_ISSUER = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;

// The URL where your Hono API can find Cognito's public keys to verify the token
const JWKS_URL = new URL(
  `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
);

// It will fetch the keys from the URL and cache them.
const jwks = createRemoteJWKSet(JWKS_URL);

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json(
      { error: "Unauthorized", message: "No Authorization header" },
      401,
    );
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return c.json(
      { error: "Unauthorized", message: "Invalid token format" },
      401,
    );
  }

  try {
    // 'jwtVerify' checks:
    //   a) The signature (using the keys from 'jwks')
    //   b) The expiration ('exp')
    //   c) The issuer ('iss') - to make sure it's *your* user pool
    const { payload } = await jwtVerify(token, jwks, {
      issuer: COGNITO_ISSUER,
    });

    // Attach the user data to the Hono context
    // The 'payload' is the decoded token. 'payload.sub' is the user's
    // unique Cognito ID (the one you store in your DB).
    c.set("user", payload);

    await next();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return c.json({ error: "Unauthorized", message: err.message }, 401);
  }
};

// Optional auth middleware - sets user context if available, but doesn't require authentication
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    if (token) {
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: COGNITO_ISSUER,
        });

        // Attach the user data to the Hono context if token is valid
        c.set("user", payload);
      } catch {
        // Token is invalid, but we continue without setting user context
        // This is expected behavior for optional auth
      }
    }
  }

  // Always continue to next middleware/handler regardless of auth status
  await next();
};

// Helper function to get user ID from context (returns null if user not authenticated)
export const getUserId = async (c: Context): Promise<number | null> => {
  try {
    const user = c.get("user");
    if (!user) return null;

    const userResult = await pool.query(
      "SELECT id FROM users WHERE cognito_sub = $1",
      [user.sub],
    );

    return userResult.rows.length > 0 ? userResult.rows[0].id : null;
  } catch {
    // Database error or invalid user context, return null
    return null;
  }
};

export const sellerMiddleware = async (c: Context, next: Next) => {
  /* const user = c.get('user');
  
  if (!user.is_seller) {
    return c.json({ error: 'Seller access required' }, 403);
  } */

  await next();
};
