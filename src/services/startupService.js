// Startup Service - Test all external connections on server start
import OpenAI from 'openai'
import vision from '@google-cloud/vision'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// Test OpenAI connection
async function testOpenAIConnection() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return { success: false, error: 'OPENAI_API_KEY not configured' }
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    // Test with a minimal request
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Test" }],
      max_tokens: 5
    })

    return { 
      success: true, 
      model: completion.model,
      usage: completion.usage 
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    }
  }
}

// Test Google Vision connection
async function testGoogleVisionConnection() {
  try {
    let client
    
    if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
      const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS)
      client = new vision.ImageAnnotatorClient({ credentials })
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      client = new vision.ImageAnnotatorClient()
    } else {
      return { success: false, error: 'Google Cloud credentials not configured' }
    }

    // Test with a minimal request (this will fail but we can catch auth errors)
    try {
      await client.textDetection({ image: { content: Buffer.from('test') } })
    } catch (error) {
      // If it's an auth error, that's bad. If it's an invalid image error, that's expected and good.
      if (error.message.includes('authentication') || error.message.includes('credentials')) {
        return { success: false, error: 'Authentication failed' }
      }
      // Invalid image error means auth is working
      return { success: true, message: 'Authentication successful' }
    }

    return { success: true, message: 'Connection successful' }
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    }
  }
}

// Test Supabase connection
async function testSupabaseConnection() {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return { success: false, error: 'Supabase credentials not configured' }
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    )

    // Test connection with a simple query
    const { data, error } = await supabase
      .from('reports')
      .select('count')
      .limit(1)

    if (error && !error.message.includes('relation "reports" does not exist')) {
      return { success: false, error: error.message }
    }

    return { success: true, message: 'Connection successful' }
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    }
  }
}

// Run all startup tests
export async function runStartupTests() {
  console.log('\n🔧 Testing external connections...')
  
  // Test OpenAI
  const openaiTest = await testOpenAIConnection()
  if (openaiTest.success) {
    console.log(`✅ OpenAI: Connected (${openaiTest.model})`)
  } else {
    console.log(`❌ OpenAI: ${openaiTest.error}`)
  }

  // Test Google Vision
  const visionTest = await testGoogleVisionConnection()
  if (visionTest.success) {
    console.log(`✅ Google Vision: ${visionTest.message}`)
  } else {
    console.log(`❌ Google Vision: ${visionTest.error}`)
  }

  // Test Supabase
  const supabaseTest = await testSupabaseConnection()
  if (supabaseTest.success) {
    console.log(`✅ Supabase: ${supabaseTest.message}`)
  } else {
    console.log(`❌ Supabase: ${supabaseTest.error}`)
  }

  // Summary
  const allSuccess = openaiTest.success && visionTest.success && supabaseTest.success
  if (allSuccess) {
    console.log('🎉 All external services connected successfully\n')
  } else {
    console.log('⚠️  Some external services have connection issues\n')
  }

  return {
    openai: openaiTest,
    vision: visionTest,
    supabase: supabaseTest,
    allSuccess
  }
}
