import { supabase, GUEST_USER, AUTH_CONFIG } from '../config/supabase.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

/**
 * User Service - Handles all user-related database operations
 * Supports both PoC (guest user) and MVP (full auth) modes
 */

// Get user by ID (supports both real users and guest user)
export const getUserById = async (userId) => {
  try {
    // Return guest user if it's the guest ID
    if (userId === GUEST_USER.id) {
      return { success: true, user: GUEST_USER }
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, user }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get user by email
export const getUserByEmail = async (email) => {
  try {
    // Return guest user if it's the guest email
    if (email === GUEST_USER.email) {
      return { success: true, user: GUEST_USER }
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, user }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Create new user
export const createUser = async (userData) => {
  try {
    const { email, password, firstName, lastName, role = 'driver' } = userData

    // Hash password
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    const { data: user, error } = await supabase
      .from('users')
      .insert([
        {
          email,
          password_hash: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user
    return { success: true, user: userWithoutPassword }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Authenticate user
export const authenticateUser = async (email, password) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (error || !user) {
      return { success: false, error: 'Invalid credentials' }
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' }
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      AUTH_CONFIG.jwtSecret,
      { expiresIn: AUTH_CONFIG.jwtExpiresIn }
    )

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user
    return { 
      success: true, 
      user: userWithoutPassword, 
      token 
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get or create guest user for PoC mode
export const getGuestUser = () => {
  return { success: true, user: GUEST_USER }
}

// Verify JWT token
export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, AUTH_CONFIG.jwtSecret)
    return { success: true, decoded }
  } catch (error) {
    return { success: false, error: 'Invalid token' }
  }
}

// Update user profile
export const updateUser = async (userId, updateData) => {
  try {
    // Don't allow updating guest user
    if (userId === GUEST_USER.id) {
      return { success: false, error: 'Cannot update guest user' }
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user
    return { success: true, user: userWithoutPassword }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
