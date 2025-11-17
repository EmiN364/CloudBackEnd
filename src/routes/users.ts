import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import pool from "../config/database.js";
import { userProfileResponseSchema, userProfileUpdateSchema } from "../schemas/user.schema.js";
import { ZodError } from "zod";

const users = new Hono();

users.get("/profile", authMiddleware, async (c) => {
  const cognitoUser = c.get("user");

  let user = await pool.query(
    `
    SELECT *
    FROM users
    WHERE cognito_sub = $1
    AND deleted = false
  `,
    [cognitoUser.sub],
  );

  if (user.rows.length === 0) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Authorization header missing" }, 401);
    }

    user = await pool.query(
      `
      INSERT INTO users (cognito_sub, email, email_verified, phone_number, given_name, family_name, username, cognito_username, is_seller, profile_picture)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
      [
        cognitoUser.sub,
        cognitoUser.email,
        cognitoUser.email_verified,
        cognitoUser.phone_number,
        cognitoUser.given_name,
        cognitoUser.family_name,
        cognitoUser.username,
        cognitoUser["cognito:username"],
        false,
        null, // Default profile_picture to null
      ],
    );
  }

  const responseData = { user: user.rows[0] };

  // Validate response data
  const validatedResponse = userProfileResponseSchema.parse(responseData);
  return c.json(validatedResponse);
});

// Update user profile
users.put("/profile", authMiddleware, async (c) => {
  try {
    const cognitoUser = c.get("user");
    const body = await c.req.json();
    
    // Validate request body
    const validatedData = userProfileUpdateSchema.parse(body);
    
    // Check if user exists
    const existingUser = await pool.query(
      `SELECT id FROM users WHERE cognito_sub = $1 AND deleted = false`,
      [cognitoUser.sub]
    );
    
    if (existingUser.rows.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;
    
    if (validatedData.address !== undefined) {
      updateFields.push(`address = $${paramCount}`);
      updateValues.push(validatedData.address);
      paramCount++;
    }
    
    if (validatedData.profile_picture !== undefined) {
      updateFields.push(`profile_picture = $${paramCount}`);
      updateValues.push(validatedData.profile_picture);
      paramCount++;
    }
    
    // If no fields to update, return error
    if (updateFields.length === 0) {
      return c.json({ error: "No valid fields provided for update" }, 400);
    }
    
    // Add cognito_sub to values for WHERE clause
    updateValues.push(cognitoUser.sub);
    
    // Execute update query
    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')} 
      WHERE cognito_sub = $${paramCount} AND deleted = false
      RETURNING *
    `;
    
    const updatedUser = await pool.query(updateQuery, updateValues);
    
    if (updatedUser.rows.length === 0) {
      return c.json({ error: "Failed to update user profile" }, 500);
    }
    
    const responseData = { user: updatedUser.rows[0] };
    
    // Validate response data
    const validatedResponse = userProfileResponseSchema.parse(responseData);
    return c.json(validatedResponse);
    
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json({ error: "Invalid request data", details: error.errors }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default users;
