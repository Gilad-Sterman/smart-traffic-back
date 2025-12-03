import express from 'express'
import { createUser, authenticateUser, getUserById } from '../services/userService.js'
import { authenticateUser as authMiddleware } from '../middleware/auth.js'
import { AUTH_CONFIG } from '../config/supabase.js'

const router = express.Router()

// Register new user (MVP only)
router.post('/register', async (req, res) => {
  try {
    // Check if auth is enabled
    if (!AUTH_CONFIG.requireAuth) {
      return res.status(400).json({
        error: 'Registration disabled',
        message: 'Authentication is disabled in PoC mode'
      })
    }

    const { email, password, firstName, lastName } = req.body

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email, password, firstName, and lastName are required'
      })
    }

    // Create user
    const result = await createUser({
      email,
      password,
      firstName,
      lastName,
      role: 'driver' // Default role
    })

    if (!result.success) {
      return res.status(400).json({
        error: 'Registration failed',
        message: result.error
      })
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: result.user
    })

  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Registration failed'
    })
  }
})

// Login user (MVP only)
router.post('/login', async (req, res) => {
  try {
    // Check if auth is enabled
    if (!AUTH_CONFIG.requireAuth) {
      return res.status(400).json({
        error: 'Login disabled',
        message: 'Authentication is disabled in PoC mode'
      })
    }

    const { email, password } = req.body

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required'
      })
    }

    // Authenticate user
    const result = await authenticateUser(email, password)

    if (!result.success) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: result.error
      })
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: result.user,
      token: result.token
    })

  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed'
    })
  }
})

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user
    })
  } catch (error) {
    console.error('Profile error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get profile'
    })
  }
})

// Check authentication status
router.get('/status', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      authEnabled: AUTH_CONFIG.requireAuth,
      mode: AUTH_CONFIG.requireAuth ? 'MVP' : 'PoC'
    })
  } catch (error) {
    console.error('Auth status error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get auth status'
    })
  }
})

// Logout (client-side token removal, but endpoint for consistency)
router.post('/logout', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  })
})

export default router
