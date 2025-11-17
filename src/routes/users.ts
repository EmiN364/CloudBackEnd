import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import pool from "../config/database.js";
import { userProfileResponseSchema } from "../schemas/user.schema.js";

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
      INSERT INTO users (cognito_sub, email, email_verified, phone_number, given_name, family_name, username, cognito_username, is_seller)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      ],
    );
  }

  const responseData = { user: user.rows[0] };

  // Validate response data
  const validatedResponse = userProfileResponseSchema.parse(responseData);
  return c.json(validatedResponse);
});

export default users;
