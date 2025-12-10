import { extractTextFromDocument } from '../services/ocrService.js'
import { analyzeTrafficViolation } from '../services/aiService.js'
import {
  createReport,
  updateReportOCR,
  updateReportAnalysis,
  getReportById,
  verifyReportOwnership,
  updateReportStatus
} from '../services/reportsService.js'

export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload a document'
      })
    }

    // Get user from middleware (guest or authenticated user)
    const userId = req.user.id

    // Store file info
    const fileInfo = {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer,
      uploadedAt: new Date().toISOString()
    }

    console.log(`📄 Document uploaded by user ${userId}: ${req.file.originalname} (${req.file.size} bytes)`)

    // Create report in database
    const createResult = await createReport(userId, fileInfo)
    if (!createResult.success) {
      console.error('❌ Database error creating report:', createResult.error)
      console.error('User ID:', userId)
      console.error('File info:', fileInfo)
      return res.status(500).json({
        error: 'Database error',
        message: createResult.error
      })
    }

    const report = createResult.report

    try {
      // Process OCR immediately upon upload
      const ocrResults = await extractTextFromDocument(fileInfo)
      // Update report with OCR results
      const ocrUpdateResult = await updateReportOCR(report.id, ocrResults)
      if (!ocrUpdateResult.success) {
        console.error('Failed to update OCR results:', ocrUpdateResult.error)
      }

      res.status(200).json({
        success: true,
        reportId: report.id,
        file: {
          name: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype
        },
        ocrResults,
        message: 'Document uploaded and OCR processed successfully'
      })

    } catch (ocrError) {
      console.error('OCR processing error:', ocrError)

      // Update report status to error
      await updateReportStatus(report.id, 'error', ocrError.message)

      res.status(500).json({
        error: 'OCR processing failed',
        message: ocrError.message,
        reportId: report.id
      })
    }

  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    })
  }
}

export const analyzeDocument = async (req, res) => {
  try {
    const { reportId } = req.params
    const userId = req.user.id
    
    // Get user-corrected fields from request body (if provided)
    const { correctedFields } = req.body || {}

    // Get report from database
    const reportResult = await getReportById(reportId)
    if (!reportResult.success) {
      return res.status(404).json({
        error: 'Report not found',
        message: 'Invalid report ID'
      })
    }

    const report = reportResult.report

    // Verify ownership (unless it's guest user)
    if (userId !== report.user_id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only analyze your own reports'
      })
    }

    // Check if OCR was completed
    if (!report.ocr_results) {
      return res.status(400).json({
        error: 'OCR not completed',
        message: 'Document must be processed first'
      })
    }

    // Update status to processing
    await updateReportStatus(reportId, 'ai_processing')

    try {
      // Prepare data for AI analysis
      let analysisData = { ...report.ocr_results }
      
      // Use user-corrected fields if provided, otherwise use original OCR results
      if (correctedFields) {
        console.log('📝 AI analysis using user-corrected fields')
        analysisData.extractedFields = { 
          ...analysisData.extractedFields, 
          ...correctedFields 
        }
        
        // Update confidence scores for corrected fields (set to high confidence)
        Object.keys(correctedFields).forEach(fieldName => {
          if (correctedFields[fieldName] && correctedFields[fieldName].trim()) {
            analysisData.confidenceScores[fieldName] = 0.95 // High confidence for user-corrected data
          }
        })
        
        // Update validation completeness
        if (analysisData.validation) {
          const requiredFields = ['reportNumber', 'violationDate', 'violationType', 'fineAmount']
          const correctedRequiredFields = requiredFields.filter(field => 
            analysisData.extractedFields[field] && analysisData.extractedFields[field].toString().trim()
          )
          analysisData.validation.completeness = (correctedRequiredFields.length / requiredFields.length) * 100
          analysisData.validation.isValid = correctedRequiredFields.length === requiredFields.length
        }
      }

      // AI Analysis using corrected or original OCR results
      const analysisResults = await analyzeTrafficViolation(analysisData)

      // Update report with analysis results
      const analysisUpdateResult = await updateReportAnalysis(reportId, analysisResults)
      if (!analysisUpdateResult.success) {
        console.error('Failed to update analysis results:', analysisUpdateResult.error)
      }

      res.status(200).json({
        success: true,
        reportId,
        status: 'complete',
        analysisResults,
        message: 'AI analysis completed successfully'
      })

    } catch (analysisError) {
      console.error('AI analysis error:', analysisError)

      // Update report status to error
      await updateReportStatus(reportId, 'error', analysisError.message)

      res.status(500).json({
        error: 'Analysis failed',
        message: analysisError.message
      })
    }

  } catch (error) {
    console.error('Analysis error:', error)
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    })
  }
}

export const getAnalysisResults = async (req, res) => {
  try {
    const { reportId } = req.params
    const userId = req.user.id

    // Get report from database
    const reportResult = await getReportById(reportId)
    if (!reportResult.success) {
      return res.status(404).json({
        error: 'Report not found',
        message: 'Invalid report ID'
      })
    }

    const report = reportResult.report

    // Verify ownership
    if (userId !== report.user_id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view your own reports'
      })
    }

    res.status(200).json({
      success: true,
      reportId: report.id,
      status: report.status,
      ocrResults: report.ocr_results,
      analysisResults: report.analysis_results,
      createdAt: report.created_at,
      completedAt: report.completed_at,
      originalFile: report.original_file
    })

  } catch (error) {
    console.error('Get results error:', error)
    res.status(500).json({
      error: 'Failed to get results',
      message: error.message
    })
  }
}

// New function to get user's reports list
export const getUserReports = async (req, res) => {
  try {
    const userId = req.user.id
    const { limit = 50, offset = 0 } = req.query

    const reportsResult = await getReportsByUserId(userId, parseInt(limit), parseInt(offset))
    if (!reportsResult.success) {
      return res.status(500).json({
        error: 'Database error',
        message: reportsResult.error
      })
    }

    res.status(200).json({
      success: true,
      reports: reportsResult.reports,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    })

  } catch (error) {
    console.error('Get user reports error:', error)
    res.status(500).json({
      error: 'Failed to get reports',
      message: error.message
    })
  }
}
