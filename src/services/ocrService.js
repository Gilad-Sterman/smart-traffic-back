// ocrService.js
import vision from '@google-cloud/vision'
import dotenv from 'dotenv'

// Load environment variables (same as supabase.js does)
dotenv.config()

// Create client with credentials from environment variable
let client
try {  
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    // Use JSON credentials from environment variable (for production)
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS)
    console.log('✅ Successfully parsed credentials JSON')
    client = new vision.ImageAnnotatorClient({ credentials })
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('{')) {
    // Use file path (for development) - only if it doesn't start with '{'
    console.log('📁 Using GOOGLE_APPLICATION_CREDENTIALS file path for Vision API')
    client = new vision.ImageAnnotatorClient()
  } else {
    // Fallback to default authentication
    console.log('⚠️ Using default Google Cloud authentication for Vision API')
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('GOOGLE_APPLICATION_CREDENTIALS starts with {:', process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('{'))
    }
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


// Main function
export async function extractTextFromDocument(fileInfo) {
  const { buffer, originalName, mimetype } = fileInfo

  // Call Google Vision API
  const [result] = await client.documentTextDetection({ image: { content: buffer } })
  const extractedText = result.fullTextAnnotation?.text || ''

  // Parse text and get structured fields with confidence
  const { extractedFields, confidenceScores } = parseOCRTextWithConfidence(extractedText, result)

  // Return structured OCR results
  return {
    extractedText,
    extractedFields,
    confidenceScores,
    processingInfo: {
      fileType: mimetype,
      fileSize: buffer.length,
      processedAt: new Date().toISOString(),
      ocrEngine: 'Google Vision',
      isPDF: false
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

// Helper function to improve field extraction confidence
export const enhanceFieldExtraction = (extractedText) => {
  // This would contain regex patterns and NLP logic to improve field extraction
  // For now, return the mock data
  return {
    enhanced: true,
    improvements: ['Date format standardized', 'Currency symbols normalized']
  }
}
