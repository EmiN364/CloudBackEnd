/* eslint-disable no-console */
import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
import dotenv from "dotenv";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  initializeDatabase,
  testDatabaseConnection,
} from "./config/init-db.js";
import { openApiApp } from "./openapi/routes.js";
import { openApiConfig } from "./openapi/spec.js";

// Import routes
import users from "./routes/users.js";
import products from "./routes/products.js";
import reviews from "./routes/reviews.js";
import sales from "./routes/sales.js";
import favorites from "./routes/favorites.js";
import stores from "./routes/stores.js";
import cart from "./routes/cart.js";
import notifications from "./routes/notifications.js";
import images from "./routes/images.js";

// Load environment variables
dotenv.config();

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Health check
app.get("/", (c) => {
  return c.json({
    message: "E-commerce API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Swagger UI
app.get("/docs", swaggerUI({ url: "/api/openapi.json" }));

// OpenAPI JSON specification
app.get("/api/openapi.json", (c) => {
  return c.json(openApiApp.getOpenAPIDocument(openApiConfig));
});

// API routes
app.route("/api/users", users);
app.route("/api/products", products);
app.route("/api/reviews", reviews);
app.route("/api/sales", sales);
app.route("/api/favorites", favorites);
app.route("/api/stores", stores);
app.route("/api/cart", cart);
app.route("/api/notifications", notifications);
app.route("/api/images", images);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Route not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  return c.json({ error: "Internal server error" }, 500);
});

// Start server
const port = parseInt(process.env.PORT || "3000");

// Initialize database before starting server
async function startServer() {
  try {
    console.log("🔄 Starting server initialization...");

    // Test database connection
    await testDatabaseConnection();

    // Initialize database schema if needed
    await initializeDatabase();

    // Start the server
    serve(
      {
        fetch: app.fetch,
        port: port,
      },
      (info) => {
        console.log(
          `🚀 Server is running on http://localhost:${info.port}/api`,
        );
        console.log(`🔍 Health check at http://localhost:${info.port}/`);
        console.log(
          `📚 API documentation at http://localhost:${info.port}/docs`,
        );
      },
    );
  } catch (error) {
    console.error("💥 Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
