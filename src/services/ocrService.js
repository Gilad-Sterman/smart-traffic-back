// OCR Service - For PoC, we'll simulate OCR results
// In production, integrate with Tesseract.js, Google Vision API, or Azure OCR

export const extractTextFromDocument = async (fileInfo) => {
  
  // Simulate OCR processing time
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Mock OCR results based on file type
  const mockResults = {
    extractedText: `
      דוח תנועה מספר: 123456789
      תאריך עבירה: 15/11/2024
      שעה: 14:30
      מיקום: רחוב הרצל 45, תל אביב
      סוג עבירה: עבירת מהירות
      מהירות נמדדה: 65 קמ"ש
      מהירות מותרת: 50 קמ"ש
      סעיף חוק: 68א
      סכום קנס: 1,000 ₪
      נקודות: 6
      רישיון נהיגה: 12345678
      שם הנהג: ישראל ישראלי
    `,
    
    extractedFields: {
      reportNumber: '123456789',
      violationDate: '15/11/2024',
      violationTime: '14:30',
      location: 'רחוב הרצל 45, תל אביב',
      violationType: 'עבירת מהירות',
      measuredSpeed: '65',
      speedLimit: '50',
      legalSection: '68א',
      fineAmount: '1000',
      points: '6',
      licenseNumber: '12345678',
      driverName: 'ישראל ישראלי'
    },
    
    confidenceScores: {
      reportNumber: 0.95,
      violationDate: 0.88,
      violationTime: 0.92,
      location: 0.85,
      violationType: 0.90,
      measuredSpeed: 0.93,
      speedLimit: 0.96,
      legalSection: 0.87,
      fineAmount: 0.94,
      points: 0.91,
      licenseNumber: 0.89,
      driverName: 0.82
    },
    
    processingInfo: {
      fileType: fileInfo.mimetype,
      fileSize: fileInfo.size,
      processingTime: '2.1s',
      ocrEngine: 'Mock OCR v1.0',
      language: 'Hebrew',
      processedAt: new Date().toISOString()
    }
  }
  
  return mockResults
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
