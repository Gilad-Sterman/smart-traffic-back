import { v4 as uuidv4 } from 'uuid'
import { extractTextFromDocument } from '../services/ocrService.js'
import { analyzeTrafficViolation } from '../services/aiService.js'

// In-memory storage for PoC (replace with database later)
const sessions = new Map()

export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload a document'
      })
    }

    // Generate session ID
    const sessionId = uuidv4()
    
    // Store file info
    const fileInfo = {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer,
      uploadedAt: new Date().toISOString()
    }

    console.log(`📄 Document uploaded: ${req.file.originalname} (${req.file.size} bytes)`)

    // Process OCR immediately upon upload
    const ocrResults = await extractTextFromDocument(fileInfo)

    // Initialize session with OCR results
    sessions.set(sessionId, {
      sessionId,
      file: fileInfo,
      status: 'ocr_complete',
      ocrResults,
      analysisResults: null,
      createdAt: new Date().toISOString()
    })

    res.status(200).json({
      success: true,
      sessionId,
      file: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      },
      ocrResults,
      message: 'Document uploaded and OCR processed successfully'
    })

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
    const { sessionId } = req.params
    
    if (!sessions.has(sessionId)) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Invalid session ID'
      })
    }

    const session = sessions.get(sessionId)
    
    // Check if OCR was completed
    if (!session.ocrResults) {
      return res.status(400).json({
        error: 'OCR not completed',
        message: 'Document must be processed first'
      })
    }

    // Update status
    session.status = 'ai_processing'
    sessions.set(sessionId, session)

    // AI Analysis using existing OCR results
    const analysisResults = await analyzeTrafficViolation(session.ocrResults)
    session.analysisResults = analysisResults
    session.status = 'complete'
    session.completedAt = new Date().toISOString()
    sessions.set(sessionId, session)

    res.status(200).json({
      success: true,
      sessionId,
      status: 'complete',
      analysisResults,
      message: 'AI analysis completed successfully'
    })

  } catch (error) {
    console.error('Analysis error:', error)
    
    // Update session status
    if (sessions.has(req.params.sessionId)) {
      const session = sessions.get(req.params.sessionId)
      session.status = 'error'
      session.error = error.message
      sessions.set(req.params.sessionId, session)
    }

    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    })
  }
}

export const getAnalysisResults = async (req, res) => {
  try {
    const { sessionId } = req.params
    
    if (!sessions.has(sessionId)) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Invalid session ID'
      })
    }

    const session = sessions.get(sessionId)

    res.status(200).json({
      success: true,
      sessionId,
      status: session.status,
      ocrResults: session.ocrResults,
      analysisResults: session.analysisResults,
      createdAt: session.createdAt,
      completedAt: session.completedAt
    })

  } catch (error) {
    console.error('Get results error:', error)
    res.status(500).json({
      error: 'Failed to get results',
      message: error.message
    })
  }
}
