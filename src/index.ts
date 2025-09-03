import { serve } from '@hono/node-server'
import { swaggerUI } from '@hono/swagger-ui'
import dotenv from 'dotenv'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { openApiApp } from './openapi/routes.js'
import { openApiConfig } from './openapi/spec.js'

// Import routes
import cart from './routes/cart.js'
import images from './routes/images.js'
import likes from './routes/likes.js'
import notifications from './routes/notifications.js'
import products from './routes/products.js'
import reviews from './routes/reviews.js'
import sales from './routes/sales.js'
import stores from './routes/stores.js'
import users from './routes/users.js'

// Load environment variables
dotenv.config()

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

// Health check
app.get('/', (c) => {
  return c.json({
    message: 'E-commerce API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

// Swagger UI
app.get('/docs', swaggerUI({ url: '/api/openapi.json' }))

// OpenAPI JSON specification
app.get('/api/openapi.json', (c) => {
  return c.json(openApiApp.getOpenAPIDocument(openApiConfig))
})

// API routes
app.route('/api/users', users)
app.route('/api/products', products)
app.route('/api/stores', stores)
app.route('/api/cart', cart)
app.route('/api/sales', sales)
app.route('/api/reviews', reviews)
app.route('/api/notifications', notifications)
app.route('/api/likes', likes)
app.route('/api/images', images)

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Route not found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

// Start server
const port = parseInt(process.env.PORT || '3000')

serve({
  fetch: app.fetch,
  port: port
}, (info) => {
  console.log(`🚀 Server is running on http://localhost:${info.port}`)
  console.log(`🔍 Health check at http://localhost:${info.port}/`)
})
