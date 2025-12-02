// AI Service - For PoC, we'll simulate AI analysis
// In production, integrate with OpenAI, Claude, or custom ML models

export const analyzeTrafficViolation = async (ocrResults) => {
  
  // Simulate AI processing time
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  const { extractedFields, confidenceScores } = ocrResults
  
  // Mock AI analysis based on extracted data
  const analysisResults = {
    // Legal Analysis
    legalAnalysis: {
      section: extractedFields.legalSection || 'סעיף 68א',
      violationType: extractedFields.violationType || 'עבירת מהירות',
      severity: calculateSeverity(extractedFields),
      points: parseInt(extractedFields.points) || 6,
      fineAmount: parseInt(extractedFields.fineAmount) || 1000
    },
    
    // Technical Issues Found
    technicalIssues: [
      {
        type: 'date_inconsistency',
        severity: 'medium',
        description: 'תאריך בדוח אינו תואם לתאריך בחתימה הדיגיטלית',
        impact: 'עלול להשפיע על תקפות הדוח'
      },
      {
        type: 'missing_calibration',
        severity: 'high',
        description: 'חסר תעודת כיול של מכשיר המדידה',
        impact: 'עלול לפסול את המדידה'
      }
    ],
    
    // Appeal Assessment
    appealAssessment: {
      recommendation: 'appeal', // 'appeal' | 'pay' | 'uncertain'
      probability: 'high', // 'high' | 'medium' | 'low'
      confidence: 0.78,
      reasoning: 'נמצאו כשלים טכניים משמעותיים בדוח שעלולים להשפיע על תקפותו. מומלץ להגיש ערעור.',
      estimatedCost: 500,
      estimatedTime: '2-4 חודשים'
    },
    
    // Detailed Breakdown
    detailedAnalysis: {
      strengths: [
        'מדידת מהירות ברורה ומדויקת',
        'פרטי הנהג מלאים וברורים'
      ],
      weaknesses: [
        'חסרים פרטי כיול המכשיר',
        'אי התאמה בתאריכים',
        'חסר חתימת השוטר המדווח'
      ],
      recommendations: [
        'בקש את תעודת הכיול של מכשיר המדידה',
        'בדוק את רישומי המשמרת של השוטר',
        'אסוף עדויות על תנאי הדרך באותו יום'
      ]
    },
    
    // Processing Metadata
    processingInfo: {
      aiModel: 'SmartTraffic Legal AI v1.0',
      processingTime: '3.2s',
      rulesApplied: ['traffic_law_2023', 'appeal_precedents', 'technical_validation'],
      processedAt: new Date().toISOString()
    }
  }
  
  console.log('✅ AI analysis complete')
  return analysisResults
}

// Helper function to calculate violation severity
const calculateSeverity = (fields) => {
  const speedDiff = parseInt(fields.measuredSpeed) - parseInt(fields.speedLimit)
  const points = parseInt(fields.points) || 0
  
  if (speedDiff > 30 || points >= 8) return 'high'
  if (speedDiff > 15 || points >= 4) return 'medium'
  return 'low'
}

// Helper function to assess appeal probability
export const assessAppealProbability = (technicalIssues, legalAnalysis) => {
  const highSeverityIssues = technicalIssues.filter(issue => issue.severity === 'high').length
  const mediumSeverityIssues = technicalIssues.filter(issue => issue.severity === 'medium').length
  
  if (highSeverityIssues >= 2) return 'high'
  if (highSeverityIssues >= 1 || mediumSeverityIssues >= 3) return 'medium'
  return 'low'
}

// Helper function to generate legal recommendations
export const generateLegalRecommendations = (analysisResults) => {
  const recommendations = []
  
  analysisResults.technicalIssues.forEach(issue => {
    switch (issue.type) {
      case 'missing_calibration':
        recommendations.push('בקש תעודת כיול של מכשיר המדידה')
        break
      case 'date_inconsistency':
        recommendations.push('בדוק התאמת תאריכים ברישומים השונים')
        break
      default:
        recommendations.push('בדוק את הנושא עם עורך דין מתמחה')
    }
  })
  
  return recommendations
}
