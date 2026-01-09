// AI-Based Field Extraction Service
// Uses OpenAI to extract structured fields from preprocessed OCR text

import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config()

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Field definitions for traffic violation tickets
 */
const FIELD_DEFINITIONS = {
  required: {
    reportNumber: {
      description: "מספר הדוח - רצף של 6 ספרות או יותר",
      examples: ["123456", "7891011", "456789123"],
      validation: "6+ digits"
    },
    violationDate: {
      description: "תאריך העבירה בפורמט DD/MM/YYYY או DD.MM.YYYY",
      examples: ["15/03/2024", "07.12.2023", "22/08/2024"],
      validation: "valid date format"
    },
    violationType: {
      description: "סוג העבירה, סעיף חוקי, מהירות בפועל ומהירות מותרת אם רלוונטי",
      examples: ["תקנה 54(א) - עבירת מהירות 76/50 קמ״ש", "סעיף 68א - חניה אסורה", "6536 - מהירות עירונית"],
      validation: "detailed violation description with speeds if applicable"
    },
    fineAmount: {
      description: "סכום הקנס בשקלים (מספר בלבד)",
      examples: ["1000", "500", "250", "1500"],
      validation: "numeric value"
    }
  },
  optional: {
    violationTime: {
      description: "שעת העבירה בפורמט HH:MM",
      examples: ["14:30", "09:15", "22:45"],
      validation: "time format HH:MM"
    },
    location: {
      description: "מיקום העבירה - רחוב, כביש או כתובת",
      examples: ["רחוב הרצל 15", "כביש 1", "שדרות רוטשילד"],
      validation: "text description"
    },
    driverName: {
      description: "שם הנהג",
      examples: ["יוסי כהן", "מרים לוי", "אברהם ישראלי"],
      validation: "Hebrew name"
    },
    licenseNumber: {
      description: "מספר רישיון הנהיגה",
      examples: ["12345678", "87654321"],
      validation: "8-digit number"
    },
    points: {
      description: "מספר הנקודות (אם מצוין)",
      examples: ["6", "4", "8", "2"],
      validation: "1-2 digit number"
    },
    vehiclePlate: {
      description: "מספר רכב",
      examples: ["123-45-678", "987-65-432"],
      validation: "license plate format"
    },
    appealDeadline: {
      description: "מועד אחרון לערעור בפורמט DD/MM/YYYY",
      examples: ["15/03/2024", "30/12/2023", "07/08/2024"],
      validation: "valid date format"
    }
  }
}

/**
 * Create the system prompt for field extraction
 */
function createFieldExtractionPrompt() {
  const requiredFields = Object.entries(FIELD_DEFINITIONS.required)
    .map(([key, def]) => `- ${key}: ${def.description} (דוגמאות: ${def.examples.join(', ')})`)
    .join('\n')
  
  const optionalFields = Object.entries(FIELD_DEFINITIONS.optional)
    .map(([key, def]) => `- ${key}: ${def.description} (דוגמאות: ${def.examples.join(', ')})`)
    .join('\n')

  return `אתה מומחה לחילוץ מידע מדוחות תנועה ישראליים. המשימה שלך היא לחלץ שדות מובנים מטקסט OCR רועש ולא מושלם.

שדות חובה (REQUIRED):
${requiredFields}

שדות אופציונליים (OPTIONAL):
${optionalFields}

הוראות חשובות:
1. חלץ רק מידע שאתה בטוח בו - אל תמציא ערכים
2. התעלם מטקסט רועש או לא רלוונטי
3. אם שדה לא נמצא או לא ברור, החזר null
4. עבור כל שדה, ספק ציון ביטחון בין 0.0 ל-1.0
5. נסה לתקן שגיאות OCR נפוצות בעברית (ר/ד, ח/ה, ב/כ וכו')
6. חפש מידע גם בשורות סמוכות - לפעמים הערך נמצא בשורה הבאה
7. עבור תאריכים - וודא שהפורמט תקין ומתאים לישראל
8. עבור סכומים - החזר רק את המספר ללא סמלי מטבע
9. עבור violationType - חלץ מידע מפורט כולל: סעיף חוקי, סמל עבירה, מהירות בפועל ומותרת אם רלוונטי
10. חפש ביטויים כמו "במהירות של X קמ״ש", "מהירות מירבית Y קמ״ש", "סמל עבירה: XXXX"

החזר תשובה בפורמט JSON בלבד עם המבנה הבא:
{
  "extractedFields": {
    "reportNumber": "value או null",
    "violationDate": "value או null",
    "violationType": "value או null", 
    "fineAmount": "value או null",
    "violationTime": "value או null",
    "location": "value או null",
    "driverName": "value או null",
    "licenseNumber": "value או null",
    "points": "value או null",
    "vehiclePlate": "value או null"
  },
  "confidenceScores": {
    "reportNumber": 0.0-1.0,
    "violationDate": 0.0-1.0,
    // ... עבור כל שדה
  },
  "processingNotes": [
    "הערות על התהליך, תיקונים שבוצעו, או בעיות שנמצאו"
  ]
}`
}

/**
 * Extract fields using OpenAI with structured output
 */
export async function extractFieldsWithAI(preprocessedText, ocrConfidence = 0.8) {
  try {
    const { correctedText, extractedValues, detectedFields } = preprocessedText
    
    // Prepare context for AI
    const context = `
טקסט OCR מעובד:
${correctedText}

שדות שזוהו בעיבוד מקדים:
${JSON.stringify(detectedFields, null, 2)}

ערכים שחולצו בעיבוד מקדים:
${JSON.stringify(extractedValues, null, 2)}
`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: createFieldExtractionPrompt()
        },
        {
          role: "user", 
          content: context
        }
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 1500,
      response_format: { type: "json_object" }
    })

    const aiResponse = JSON.parse(completion.choices[0].message.content)
    
    // Validate and enhance the response
    const validatedFields = validateAIExtraction(aiResponse)
    
    // Combine with preprocessing results for final confidence scores
    const finalResult = combineExtractionResults(validatedFields, extractedValues, ocrConfidence)
    
    return {
      success: true,
      extractedFields: finalResult.extractedFields,
      confidenceScores: finalResult.confidenceScores,
      processingNotes: finalResult.processingNotes,
      aiUsage: {
        model: "gpt-4o-mini",
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens
      },
      processingTime: new Date().toISOString()
    }

  } catch (error) {
    console.error('❌ AI field extraction error:', error)
    
    return {
      success: false,
      error: error.message,
      extractedFields: {},
      confidenceScores: {},
      processingNotes: [`AI extraction failed: ${error.message}`]
    }
  }
}

/**
 * Validate AI extraction results
 */
function validateAIExtraction(aiResponse) {
  const validated = {
    extractedFields: {},
    confidenceScores: {},
    processingNotes: aiResponse.processingNotes || []
  }

  // Validate each field
  for (const [fieldName, fieldDef] of Object.entries({...FIELD_DEFINITIONS.required, ...FIELD_DEFINITIONS.optional})) {
    const value = aiResponse.extractedFields?.[fieldName]
    const confidence = aiResponse.confidenceScores?.[fieldName] || 0

    if (value && value !== null && value !== 'null') {
      // Apply field-specific validation
      const validationResult = validateFieldValue(fieldName, value, fieldDef)
      
      if (validationResult.isValid) {
        validated.extractedFields[fieldName] = validationResult.normalizedValue
        validated.confidenceScores[fieldName] = Math.min(confidence, validationResult.confidence)
      } else {
        validated.processingNotes.push(`Field ${fieldName} failed validation: ${validationResult.reason}`)
        validated.confidenceScores[fieldName] = 0
      }
    } else {
      validated.extractedFields[fieldName] = null
      validated.confidenceScores[fieldName] = 0
    }
  }

  return validated
}

/**
 * Validate individual field values
 */
function validateFieldValue(fieldName, value, fieldDef) {
  switch (fieldName) {
    case 'reportNumber':
      if (!/^\d{6,}$/.test(value)) {
        return { isValid: false, reason: 'Report number must be 6+ digits' }
      }
      return { isValid: true, normalizedValue: value, confidence: 0.95 }

    case 'violationDate':
      const dateMatch = value.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})$/)
      if (!dateMatch) {
        return { isValid: false, reason: 'Invalid date format' }
      }
      const [, day, month, year] = dateMatch
      if (parseInt(day) > 31 || parseInt(month) > 12) {
        return { isValid: false, reason: 'Invalid date values' }
      }
      return { isValid: true, normalizedValue: `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`, confidence: 0.9 }

    case 'violationTime':
      if (!/^\d{1,2}:\d{2}$/.test(value)) {
        return { isValid: false, reason: 'Invalid time format' }
      }
      return { isValid: true, normalizedValue: value, confidence: 0.85 }

    case 'fineAmount':
      const amount = parseInt(value.replace(/[^\d]/g, ''))
      if (isNaN(amount) || amount < 50 || amount > 10000) {
        return { isValid: false, reason: 'Invalid fine amount' }
      }
      return { isValid: true, normalizedValue: amount.toString(), confidence: 0.9 }

    case 'points':
      const points = parseInt(value)
      if (isNaN(points) || points < 0 || points > 12) {
        return { isValid: false, reason: 'Invalid points value' }
      }
      return { isValid: true, normalizedValue: points.toString(), confidence: 0.85 }

    default:
      // For text fields, just clean and validate length
      const cleaned = value.trim()
      if (cleaned.length < 2 || cleaned.length > 100) {
        return { isValid: false, reason: 'Text field too short or too long' }
      }
      return { isValid: true, normalizedValue: cleaned, confidence: 0.8 }
  }
}

/**
 * Combine AI extraction with preprocessing results
 */
function combineExtractionResults(aiResults, preprocessingResults, ocrConfidence) {
  const combined = {
    extractedFields: { ...aiResults.extractedFields },
    confidenceScores: { ...aiResults.confidenceScores },
    processingNotes: [...aiResults.processingNotes]
  }

  // Enhance confidence scores based on preprocessing
  for (const [fieldName, preprocessingData] of Object.entries(preprocessingResults)) {
    if (combined.extractedFields[fieldName] && preprocessingData.confidence) {
      // Combine AI confidence with preprocessing confidence
      const aiConfidence = combined.confidenceScores[fieldName] || 0
      const preprocessingConfidence = preprocessingData.confidence
      
      // Weighted average: AI gets 70%, preprocessing gets 30%
      combined.confidenceScores[fieldName] = (aiConfidence * 0.7) + (preprocessingConfidence * 0.3)
      
      combined.processingNotes.push(`Field ${fieldName} enhanced with preprocessing confidence`)
    }
  }

  // Apply overall OCR confidence as a multiplier
  for (const fieldName of Object.keys(combined.confidenceScores)) {
    combined.confidenceScores[fieldName] *= ocrConfidence
  }

  return combined
}

/**
 * Check if required fields are present with sufficient confidence
 */
export function validateRequiredFields(extractionResult, minConfidence = 0.7) {
  const { extractedFields, confidenceScores } = extractionResult
  const requiredFieldNames = Object.keys(FIELD_DEFINITIONS.required)
  
  const validation = {
    isValid: true,
    missingFields: [],
    lowConfidenceFields: [],
    completeness: 0
  }

  let validFields = 0

  for (const fieldName of requiredFieldNames) {
    const value = extractedFields[fieldName]
    const confidence = confidenceScores[fieldName] || 0

    if (!value || value === null) {
      validation.missingFields.push(fieldName)
      validation.isValid = false
    } else if (confidence < minConfidence) {
      validation.lowConfidenceFields.push({ field: fieldName, confidence })
      validation.isValid = false
    } else {
      validFields++
    }
  }

  validation.completeness = (validFields / requiredFieldNames.length) * 100

  return validation
}
