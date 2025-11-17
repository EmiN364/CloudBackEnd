// OpenAPI configuration for the e-commerce API
export const openApiConfig = {
  openapi: "3.0.0",
  info: {
    title: "E-commerce API",
    version: "1.0.0",
    description:
      "A comprehensive REST API for e-commerce operations including user management, product catalog, sales, reviews, and favorites.",
    contact: {
      name: "API Support",
      email: "support@example.com",
    },
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development server",
    },
    {
      url: "http://localhost:3001",
      description: "Development server 2",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  tags: [
    { name: "Health", description: "API health check" },
    { name: "Users", description: "User management operations" },
    { name: "Products", description: "Product catalog management" },
    { name: "Favorites", description: "Product favorites management" },
    { name: "Sales", description: "Order and sales management" },
    { name: "Reviews", description: "Product review management" },
  ],
};
