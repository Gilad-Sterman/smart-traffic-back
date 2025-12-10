// ocrService.js - Enhanced with preprocessing and AI extraction
import vision from '@google-cloud/vision'
import dotenv from 'dotenv'
import { preprocessOCRText } from './textPreprocessingService.js'
import { extractFieldsWithAI, validateRequiredFields } from './aiFieldExtractionService.js'

// Load environment variables (same as supabase.js does)
dotenv.config()

// Create client with credentials from environment variable
let client
try {  
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    // Use JSON credentials from environment variable (for production)
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS)
    client = new vision.ImageAnnotatorClient({ credentials })
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('{')) {
    // Use file path (for development) - only if it doesn't start with '{'
    client = new vision.ImageAnnotatorClient()
  } else {
    // Fallback to default authentication
    client = new vision.ImageAnnotatorClient()
  }
} catch (error) {
  console.error('❌ Error initializing Google Vision client:', error)
  // Fallback to default authentication
  console.log('🔄 Falling back to default authentication')
  client = new vision.ImageAnnotatorClient()
}

// Helper function: parse text and extract fields with confidence
function parseOCRTextWithConfidence(text, ocrResponse) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const fields = {}
  const confidences = {}

  // Flatten all symbols for approximate confidence per line
  const symbols = ocrResponse?.fullTextAnnotation?.pages.flatMap(p =>
    p.blocks.flatMap(b =>
      b.paragraphs.flatMap(par =>
        par.words.flatMap(w =>
          w.symbols.map(s => s)
        )
      )
    )
  ) || []

  function getLineConfidence(line) {
    const matchingSymbols = symbols.filter(s => line.includes(s.text))
    if (matchingSymbols.length === 0) return 0
    return matchingSymbols.reduce((sum, s) => sum + (s.confidence || 0), 0) / matchingSymbols.length
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = lines[i + 1] || ''
    const lineConfidence = getLineConfidence(line)

    // Report Number
    if (/מספר דוח|פרטי דוח מספר/i.test(line)) {
      const match = line.match(/\d{6,}/) || nextLine.match(/\d{6,}/)
      if (match) {
        fields.reportNumber = match[0]
        confidences.reportNumber = lineConfidence
      }
    }

    // Violation Date and Time
    if (/תאריך עבירה/i.test(line)) {
      const match = line.match(/(\d{2}\/\d{2}\/\d{4})/)
      const timeMatch = line.match(/(\d{2}:\d{2})/)
      if (match) {
        fields.violationDate = match[1]
        confidences.violationDate = lineConfidence
      }
      if (timeMatch) {
        fields.violationTime = timeMatch[1]
        confidences.violationTime = lineConfidence
      }
    }

    // Location
    if (/רחוב/i.test(line) || /מיקום/i.test(line)) {
      const loc = line.replace(/רחוב:|מיקום יחסי:/i, '').trim() + (nextLine && !nextLine.match(/\d{2}\/\d{2}\/\d{4}/) ? ' ' + nextLine : '')
      fields.location = loc.trim()
      confidences.location = lineConfidence
    }

    // Violation Type / Legal Section
    if (/סעיף העבירה/i.test(line) || /מס' עבירה/i.test(line)) {
      const match = line.match(/(\d+\s*\(?.*?\)?)/)
      if (match) {
        fields.violationType = match[1].trim()
        confidences.violationType = lineConfidence
      }
    }

    // Fine Amount
    if (/סכום לתשלום/i.test(line)) {
      const match = line.match(/(\d+)/)
      if (match) {
        fields.fineAmount = match[1]
        confidences.fineAmount = lineConfidence
      }
    }

    // Driver Name
    if (/אל הנהג/i.test(line)) {
      fields.driverName = line.replace('אל הנהג', '').trim()
      confidences.driverName = lineConfidence
    }

    // License Number
    if (/מספר רישוי/i.test(line)) {
      fields.licenseNumber = nextLine || ''
      confidences.licenseNumber = lineConfidence
    }

    // Points (if present)
    if (/נקודות/i.test(line)) {
      const match = line.match(/(\d+)/)
      if (match) {
        fields.points = match[1]
        confidences.points = lineConfidence
      }
    }
  }

  return { extractedFields: fields, confidenceScores: confidences }
}


// Main function - Enhanced with preprocessing and AI extraction
export async function extractTextFromDocument(fileInfo) {
  const { buffer, originalName, mimetype } = fileInfo
  const startTime = Date.now()

  try {
    // Step 1: Google Vision OCR
    const [result] = await client.documentTextDetection({ image: { content: buffer } })
    const rawText = result.fullTextAnnotation?.text || ''
    
    if (!rawText.trim()) {
      throw new Error('No text detected in document')
    }

    // Calculate overall OCR confidence from Vision API
    const ocrConfidence = calculateVisionConfidence(result)

    // Step 2: Text preprocessing and normalization
    const preprocessedText = preprocessOCRText(rawText)

    // Step 3: AI-based field extraction
    const aiExtractionResult = await extractFieldsWithAI(preprocessedText, ocrConfidence)

    if (!aiExtractionResult.success) {
      console.warn('⚠️ AI extraction failed, falling back to legacy parsing')
      // Fallback to legacy parsing
      const { extractedFields, confidenceScores } = parseOCRTextWithConfidence(rawText, result)
      return createLegacyResult(rawText, extractedFields, confidenceScores, fileInfo)
    }

    // Step 4: Validate required fields
    const validation = validateRequiredFields(aiExtractionResult, 0.6)

    const processingTime = Date.now() - startTime
    console.log(`✅ Enhanced OCR complete: ${processingTime}ms, confidence: ${(ocrConfidence * 100).toFixed(1)}%, fields: ${Object.keys(aiExtractionResult.extractedFields).length}`)

    // Return enhanced OCR results
    return {
      // Original data
      extractedText: rawText,
      
      // Enhanced extraction results
      extractedFields: aiExtractionResult.extractedFields,
      confidenceScores: aiExtractionResult.confidenceScores,
      
      // Processing pipeline results
      preprocessing: {
        normalizedText: preprocessedText.normalizedText,
        correctedText: preprocessedText.correctedText,
        detectedFields: preprocessedText.detectedFields,
        processingInfo: preprocessedText.processingInfo
      },
      
      // AI extraction details
      aiExtraction: {
        processingNotes: aiExtractionResult.processingNotes,
        aiUsage: aiExtractionResult.aiUsage
      },
      
      // Validation results
      validation: validation,
      
      // Processing metadata
      processingInfo: {
        fileType: mimetype,
        fileSize: buffer.length,
        processedAt: new Date().toISOString(),
        ocrEngine: 'Google Vision + AI Enhancement',
        processingTime: `${processingTime}ms`,
        ocrConfidence: ocrConfidence,
        pipeline: 'enhanced',
        isPDF: mimetype === 'application/pdf'
      }
    }

  } catch (error) {
    console.error('❌ Enhanced OCR processing failed:', error)
    
    // Fallback to legacy processing
    console.log('🔄 Falling back to legacy OCR processing...')
    try {
      const [result] = await client.documentTextDetection({ image: { content: buffer } })
      const extractedText = result.fullTextAnnotation?.text || ''
      const { extractedFields, confidenceScores } = parseOCRTextWithConfidence(extractedText, result)
      
      return createLegacyResult(extractedText, extractedFields, confidenceScores, fileInfo, error.message)
    } catch (fallbackError) {
      throw new Error(`Both enhanced and legacy OCR failed: ${error.message}, ${fallbackError.message}`)
    }
  }
}



// Helper function to validate extracted fields
export const validateExtractedFields = (fields) => {
  const required = ['reportNumber', 'violationDate', 'violationType', 'fineAmount']
  const missing = required.filter(field => !fields[field])

  return {
    isValid: missing.length === 0,
    missingFields: missing,
    completeness: ((required.length - missing.length) / required.length) * 100
  }
}

// Helper function to calculate overall confidence from Google Vision API
function calculateVisionConfidence(visionResult) {
  try {
    const pages = visionResult.fullTextAnnotation?.pages || []
    if (pages.length === 0) return 0
    
    let totalConfidence = 0
    let symbolCount = 0
    
    for (const page of pages) {
      for (const block of page.blocks || []) {
        for (const paragraph of block.paragraphs || []) {
          for (const word of paragraph.words || []) {
            for (const symbol of word.symbols || []) {
              if (symbol.confidence !== undefined) {
                totalConfidence += symbol.confidence
                symbolCount++
              }
            }
          }
        }
      }
    }
    
    return symbolCount > 0 ? totalConfidence / symbolCount : 0.5
  } catch (error) {
    console.warn('Failed to calculate Vision confidence:', error)
    return 0.5 // Default confidence
  }
}

// Helper function to create legacy result format
function createLegacyResult(extractedText, extractedFields, confidenceScores, fileInfo, errorMessage = null) {
  return {
    extractedText,
    extractedFields,
    confidenceScores,
    processingInfo: {
      fileType: fileInfo.mimetype,
      fileSize: fileInfo.buffer.length,
      processedAt: new Date().toISOString(),
      ocrEngine: 'Google Vision (Legacy)',
      pipeline: 'legacy',
      isPDF: fileInfo.mimetype === 'application/pdf',
      fallbackReason: errorMessage
    },
    validation: {
      isValid: Object.keys(extractedFields).length > 0,
      missingFields: [],
      lowConfidenceFields: [],
      completeness: 50 // Estimate for legacy
    }
  }
}

// Helper function to improve field extraction confidence
export const enhanceFieldExtraction = (extractedText) => {
  // This would contain regex patterns and NLP logic to improve field extraction
  // For now, return the mock data
  return {
    enhanced: true,
    improvements: ['Date format standardized', 'Currency symbols normalized']
  }
}
