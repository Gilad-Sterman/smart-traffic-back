import OpenAI from 'openai'
import dotenv from 'dotenv'
import { supabase } from '../config/supabase.js'

dotenv.config()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Create a search query from extracted violation fields
 */
function buildViolationSearchQuery(extractedFields) {
  const parts = []
  
  // Always start with general traffic violation context
  parts.push('עבירת תנועה')
  
  // Add severity context based on fine amount
  if (extractedFields.fineAmount) {
    const amount = parseInt(extractedFields.fineAmount)
    if (amount > 1000) {
      parts.push('עבירה חמורה ערעור')
    } else if (amount > 500) {
      parts.push('עבירה בינונית ערעור')
    } else {
      parts.push('עבירה קלה')
    }
  }
  
  // Add points context for severity
  if (extractedFields.points) {
    const points = parseInt(extractedFields.points)
    if (points >= 6) {
      parts.push('נקודות רבות ערעור')
    } else if (points >= 2) {
      parts.push('נקודות ערעור')
    }
  }
  
  // Add general legal concepts that might match our chunks
  parts.push('הליך משפטי')
  parts.push('בית משפט')
  
  // Add violation type but make it more general
  if (extractedFields.violationType) {
    if (extractedFields.violationType.includes('מהירות')) {
      parts.push('עבירת מהירות')
    } else if (extractedFields.violationType.includes('חניה')) {
      parts.push('עבירת חניה')
    } else {
      parts.push('עבירה')
    }
  }
  
  return parts.join(' ')
}

/**
 * Get embedding for violation context using OpenAI
 */
async function getViolationEmbedding(searchQuery) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: searchQuery
    })
    
    return {
      success: true,
      embedding: response.data[0].embedding,
      usage: response.usage
    }
  } catch (error) {
    console.error('❌ Failed to create violation embedding:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Query similar legal chunks from Supabase using vector similarity
 */
async function querySimilarChunks(embedding, limit = 3) {
  try {
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: embedding,
      match_threshold: 0.3, // Lowered threshold for broader matches
      match_count: limit
    })
    
    if (error) {
      // Fallback to direct vector query if RPC function doesn't exist
      console.warn('RPC function not found, using direct vector query')
      return await directVectorQuery(embedding, limit)
    }
    
    return {
      success: true,
      chunks: data || [],
      count: data?.length || 0
    }
  } catch (error) {
    console.error('❌ Failed to query similar chunks:', error)
    return {
      success: false,
      error: error.message,
      chunks: []
    }
  }
}

/**
 * Direct vector similarity query (fallback)
 */
async function directVectorQuery(embedding, limit) {
  try {
    // Use RPC call for vector similarity since direct ordering with vectors can be problematic
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: embedding,
      match_threshold: 0.1, // Very low threshold to get any results
      match_count: limit
    })
    
    // If RPC still fails, return empty results gracefully
    if (error) {
      console.warn('⚠️ Both RPC and direct query failed, returning empty results')
      return {
        success: true,
        chunks: [],
        count: 0
      }
    }
    
    return {
      success: true,
      chunks: data || [],
      count: data?.length || 0
    }
  } catch (error) {
    console.error('❌ Direct vector query failed:', error)
    return {
      success: false,
      error: error.message,
      chunks: []
    }
  }
}

/**
 * Format chunks for inclusion in AI analysis prompt
 */
function formatChunksForPrompt(chunks) {
  if (!chunks || chunks.length === 0) {
    return 'אין מידע משפטי רלוונטי זמין.'
  }
  
  return chunks.map((chunk, index) => {
    const parts = [
      `${index + 1}. ${chunk.title}`,
      `קטגוריה: ${chunk.category}`,
      `תוכן: ${chunk.content}`
    ]
    
    if (chunk.legal_reference) {
      parts.push(`סעיף חוקי: ${chunk.legal_reference}`)
    }
    
    if (chunk.source) {
      parts.push(`מקור: ${chunk.source}`)
    }
    
    return parts.join('\n')
  }).join('\n\n---\n\n')
}

/**
 * Main function: Search for similar legal cases/precedents
 */
export async function searchSimilarLegalCases(extractedFields) {
  try {
    console.log('🔍 Searching for similar legal cases...')
    
    // Step 1: Build search query from violation context
    const searchQuery = buildViolationSearchQuery(extractedFields)
    console.log(`📝 Search query: "${searchQuery}"`)
    
    // Step 2: Get embedding for the violation context
    const embeddingResult = await getViolationEmbedding(searchQuery)
    if (!embeddingResult.success) {
      console.warn('⚠️ Failed to create embedding, proceeding without legal context')
      return {
        success: false,
        error: embeddingResult.error,
        legalContext: 'לא ניתן היה לאחזר מידע משפטי רלוונטי.',
        searchQuery,
        chunks: []
      }
    }
    
    // Step 3: Query similar chunks from database
    const queryResult = await querySimilarChunks(embeddingResult.embedding, 3)
    if (!queryResult.success) {
      console.warn('⚠️ Failed to query chunks, proceeding without legal context')
      return {
        success: false,
        error: queryResult.error,
        legalContext: 'לא ניתן היה לאחזר מידע משפטי רלוונטי.',
        searchQuery,
        chunks: []
      }
    }
    
    // Step 4: Format chunks for AI prompt
    const legalContext = formatChunksForPrompt(queryResult.chunks)
    
    console.log(`✅ Found ${queryResult.count} relevant legal chunks`)
    
    // Debug logging for troubleshooting
    if (queryResult.count === 0) {
      console.log('🔍 Debug: No chunks found, trying fallback query...')
      // Try a simple fallback query to see if any chunks exist
      const fallbackResult = await directVectorQuery(embeddingResult.embedding, 3)
      console.log(`🔍 Debug: Fallback found ${fallbackResult.count} chunks`)
    }
    
    return {
      success: true,
      legalContext,
      searchQuery,
      chunks: queryResult.chunks,
      embeddingUsage: embeddingResult.usage,
      metadata: {
        searchQuery,
        chunksFound: queryResult.count,
        processedAt: new Date().toISOString()
      }
    }
    
  } catch (error) {
    console.error('❌ Semantic search failed:', error)
    return {
      success: false,
      error: error.message,
      legalContext: 'לא ניתן היה לאחזר מידע משפטי רלוונטי.',
      searchQuery: '',
      chunks: []
    }
  }
}

/**
 * Helper function to create the Supabase RPC function for vector similarity
 * This should be run once in Supabase SQL editor
 */
export function getMatchChunksSQL() {
  return `
-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION match_chunks (
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  category text,
  source text,
  legal_reference text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    data_chunks.id,
    data_chunks.title,
    data_chunks.content,
    data_chunks.category,
    data_chunks.source,
    data_chunks.legal_reference,
    1 - (data_chunks.embedding <=> query_embedding) AS similarity
  FROM data_chunks
  WHERE 1 - (data_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY data_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
`
}
