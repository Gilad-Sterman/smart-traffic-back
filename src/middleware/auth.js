import { verifyToken, getUserById, getGuestUser } from '../services/userService.js'
import { AUTH_CONFIG } from '../config/supabase.js'

/**
 * Authentication Middleware
 * Supports both PoC mode (guest user) and MVP mode (full authentication)
 */

export const authenticateUser = async (req, res, next) => {
  try {
    // PoC Mode: Always use guest user
    if (!AUTH_CONFIG.requireAuth) {
      const { user } = getGuestUser()
      req.user = user
      return next()
    }

    // MVP Mode: Require authentication
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    const { success, decoded, error } = verifyToken(token)

    if (!success) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: error
      })
    }

    // Get user details
    const { success: userSuccess, user, error: userError } = await getUserById(decoded.userId)
    
    if (!userSuccess) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      })
    }

    req.user = user
    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    })
  }
}

// Optional authentication - for endpoints that work with or without auth
export const optionalAuth = async (req, res, next) => {
  try {
    // Always try to authenticate, but don't fail if no token
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, use guest user
      const { user } = getGuestUser()
      req.user = user
      return next()
    }

    const token = authHeader.substring(7)
    const { success, decoded } = verifyToken(token)

    if (success) {
      const { success: userSuccess, user } = await getUserById(decoded.userId)
      if (userSuccess) {
        req.user = user
        return next()
      }
    }

    // If token is invalid or user not found, fall back to guest
    const { user } = getGuestUser()
    req.user = user
    next()
  } catch (error) {
    console.error('Optional auth middleware error:', error)
    // On error, use guest user
    const { user } = getGuestUser()
    req.user = user
    next()
  }
}

// Role-based authorization middleware
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No user context'
      })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      })
    }

    next()
  }
}

// Admin only middleware
export const requireAdmin = requireRole(['system_admin'])

// Fleet admin or system admin
export const requireFleetAdmin = requireRole(['fleet_admin', 'system_admin'])
