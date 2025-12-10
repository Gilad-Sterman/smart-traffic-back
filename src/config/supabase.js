import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

// Create Supabase client with service role key for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Create Supabase client with anon key for frontend-like operations
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)

// Default guest user configuration
export const GUEST_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'guest@smarttraffic.local',
  role: 'guest',
  firstName: 'Guest',
  lastName: 'User'
}

// Environment flags
export const AUTH_CONFIG = {
  requireAuth: process.env.REQUIRE_AUTH === 'true',
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  fallbackMode: process.env.SUPABASE_FALLBACK === 'true' // Use in-memory storage if Supabase fails
}

console.log(`🔐 Auth mode: ${AUTH_CONFIG.requireAuth ? 'ENABLED' : 'DISABLED (PoC mode)'}`)
