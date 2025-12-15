// Hebrew Text Preprocessing Service
// Normalizes and cleans OCR output before AI processing

/**
 * Common Hebrew OCR letter confusions and their corrections
 */
const HEBREW_OCR_CORRECTIONS = {
  // Common letter confusions
  'ר': ['ד', 'ך'], // resh confused with dalet or final kaf
  'ד': ['ר'], // dalet confused with resh
  'ח': ['ה'], // chet confused with he
  'ה': ['ח'], // he confused with chet
  'ב': ['כ'], // bet confused with kaf
  'כ': ['ב'], // kaf confused with bet
  'מ': ['ס'], // mem confused with samech
  'ס': ['מ'], // samech confused with mem
  'ו': ['ן'], // vav confused with final nun
  'ן': ['ו'], // final nun confused with vav
  'ל': ['ך'], // lamed confused with final kaf
  'ך': ['ל'], // final kaf confused with lamed
  'נ': ['נ'], // nun variations
  'צ': ['ץ'], // tzadi variations
  'פ': ['ף'], // pe variations
  'ק': ['ק'], // qof variations
}

/**
 * Keywords we're looking for in traffic tickets with fuzzy matching
 */
const TRAFFIC_KEYWORDS = {
  reportNumber: [
    'מספר דוח',
    'פרטי דוח מספר',
    'דוח מספר',
    'מס דוח',
    'מס\'',
    'מספר'
  ],
  violationDate: [
    'תאריך עבירה',
    'תאריך',
    'יום',
    'עבירה ביום'
  ],
  violationType: [
    'סעיף העבירה',
    'מס עבירה',
    'סעיף',
    'עבירה',
    'חוק'
  ],
  fineAmount: [
    'סכום לתשלום',
    'קנס',
    'סכום',
    'לתשלום',
    'שקלים',
    'ש"ח'
  ],
  location: [
    'מיקום',
    'רחוב',
    'כביש',
    'דרך',
    'שדרות',
    'מקום'
  ],
  time: [
    'שעה',
    'זמן',
    'בשעה'
  ],
  points: [
    'נקודות',
    'נק',
    'נקודה'
  ],
  driverName: [
    'אל הנהג',
    'נהג',
    'שם',
    'מר',
    'גב'
  ],
  licenseNumber: [
    'מספר רישוי',
    'רישיון',
    'רישוי'
  ]
}

/**
 * Normalize Unicode characters and clean text
 */
export function normalizeHebrewText(text) {
  if (!text) return ''
  
  return text
    // Normalize Unicode (NFD -> NFC)
    .normalize('NFC')
    // Remove non-printable characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Collapse multiple whitespace into single space
    .replace(/\s+/g, ' ')
    // Remove leading/trailing whitespace from each line
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    // Remove common OCR artifacts
    .replace(/[|]/g, 'ו') // vertical bars often misread as vav
    .replace(/[`']/g, '') // remove stray quotes
    .replace(/[_]/g, '') // remove underscores
    .trim()
}

/**
 * Calculate edit distance between two strings (Levenshtein distance)
 */
function editDistance(str1, str2) {
  const matrix = []
  const len1 = str1.length
  const len2 = str2.length

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return matrix[len1][len2]
}

/**
 * Check if a word is similar to any keyword using edit distance
 */
function isFuzzyMatch(word, keywords, threshold = 2) {
  const cleanWord = word.replace(/[^\u0590-\u05FF\u0020-\u007F]/g, '').trim()
  
  for (const keyword of keywords) {
    const distance = editDistance(cleanWord, keyword)
    const similarity = 1 - (distance / Math.max(cleanWord.length, keyword.length))
    
    // Match if edit distance is small or similarity is high
    if (distance <= threshold || similarity >= 0.7) {
      return { match: true, keyword, similarity, distance }
    }
  }
  
  return { match: false }
}

/**
 * Apply Hebrew OCR error corrections
 */
export function correctHebrewOCRErrors(text) {
  if (!text) return ''
  
  // DISABLED: The global character replacement is corrupting valid Hebrew text
  // Instead, return the normalized text as-is since Google Vision OCR is already quite accurate
  // TODO: Implement context-aware corrections that only fix actual OCR errors
  
  return text
}

/**
 * Detect field types in text lines using fuzzy keyword matching
 */
export function detectFieldTypes(lines) {
  const detectedFields = {}
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = lines[i + 1] || ''
    
    // Check each field type
    for (const [fieldType, keywords] of Object.entries(TRAFFIC_KEYWORDS)) {
      const fuzzyMatch = isFuzzyMatch(line, keywords)
      
      if (fuzzyMatch.match) {
        detectedFields[fieldType] = {
          lineIndex: i,
          line: line,
          nextLine: nextLine,
          matchedKeyword: fuzzyMatch.keyword,
          similarity: fuzzyMatch.similarity,
          confidence: Math.min(0.95, fuzzyMatch.similarity + 0.1)
        }
      }
    }
  }
  
  return detectedFields
}

/**
 * Extract values using pattern matching
 */
export function extractValuePatterns(text, fieldType) {
  const patterns = {
    reportNumber: [
      /\d{6,}/g, // 6+ digit sequences
      /\d{3,}-\d{3,}/g // hyphenated numbers
    ],
    violationDate: [
      /\d{1,2}\/\d{1,2}\/\d{4}/g, // DD/MM/YYYY
      /\d{1,2}\.\d{1,2}\.\d{4}/g, // DD.MM.YYYY
      /\d{4}-\d{1,2}-\d{1,2}/g   // YYYY-MM-DD
    ],
    time: [
      /\d{1,2}:\d{2}/g, // HH:MM
      /\d{1,2}\.\d{2}/g // HH.MM
    ],
    fineAmount: [
      /\d{2,4}(?:\.\d{2})?/g, // 2-4 digits with optional decimals
      /\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g // formatted numbers with commas
    ],
    points: [
      /\d{1,2}(?=\s*נקוד)/g, // digits before "נקוד"
      /(?:נקוד[ות]*\s*)\d{1,2}/g // digits after "נקוד"
    ],
    violationType: [
      /\d+\s*\([^)]+\)/g, // number with description in parentheses
      /סעיף\s*\d+[א-ת]*/g // section numbers
    ]
  }
  
  const fieldPatterns = patterns[fieldType] || []
  const matches = []
  
  for (const pattern of fieldPatterns) {
    const found = text.match(pattern)
    if (found) {
      matches.push(...found)
    }
  }
  
  return matches
}

/**
 * Main preprocessing function
 */
export function preprocessOCRText(rawText) {
  // Step 1: Normalize text
  const normalizedText = normalizeHebrewText(rawText)
  
  // Step 2: Apply OCR error corrections
  const correctedText = correctHebrewOCRErrors(normalizedText)
  
  // Step 3: Split into lines for analysis
  const lines = correctedText.split('\n').filter(line => line.trim().length > 0)
  
  // Step 4: Detect field types using fuzzy matching
  const detectedFields = detectFieldTypes(lines)
  
  // Step 5: Extract values using patterns
  const extractedValues = {}
  for (const [fieldType, fieldInfo] of Object.entries(detectedFields)) {
    const lineText = fieldInfo.line + ' ' + fieldInfo.nextLine
    const values = extractValuePatterns(lineText, fieldType)
    
    if (values.length > 0) {
      extractedValues[fieldType] = {
        values: values,
        confidence: fieldInfo.confidence,
        source: fieldInfo.line,
        matchedKeyword: fieldInfo.matchedKeyword
      }
    }
  }
  
  return {
    originalText: rawText,
    normalizedText: normalizedText,
    correctedText: correctedText,
    lines: lines,
    detectedFields: detectedFields,
    extractedValues: extractedValues,
    processingInfo: {
      linesProcessed: lines.length,
      fieldsDetected: Object.keys(detectedFields).length,
      valuesExtracted: Object.keys(extractedValues).length,
      processedAt: new Date().toISOString()
    }
  }
}
