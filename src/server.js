import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Import routes
import uploadRoutes from './routes/uploadRoutes.js'
import authRoutes from './routes/authRoutes.js'

// Load environment variables
dotenv.config()

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// Security middleware
app.use(helmet())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
})
app.use(limiter)

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Logging middleware
app.use(morgan('combined'))

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'SmartTraffic Backend is running',
    timestamp: new Date().toISOString()
  })
})

// API routes
app.use('/api/upload', uploadRoutes)
app.use('/api/auth', authRoutes)

// Serve static files from the public directory (frontend build)
app.use(express.static(path.join(__dirname, '../public')))

// Serve React app for all non-API routes (SPA fallback)
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'API route not found',
      message: `Cannot ${req.method} ${req.originalUrl}`
    })
  }
  
  // Serve the React app
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

// This 404 handler should not be reached due to the catch-all above
// But keeping it as a safety net for any edge cases
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack)
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SmartTraffic Backend running on port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app