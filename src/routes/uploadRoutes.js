import express from 'express'
import multer from 'multer'
import { uploadDocument, analyzeDocument, getAnalysisResults } from '../controllers/uploadController.js'

const router = express.Router()

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false)
    }
  }
})

// Upload Routes
router.post('/document', upload.single('document'), uploadDocument)
router.post('/analyze/:sessionId', analyzeDocument)
router.get('/results/:sessionId', getAnalysisResults)

// Test route
router.get('/test', (req, res) => {
  res.json({
    message: 'Upload routes are working!',
    timestamp: new Date().toISOString()
  })
})

export default router
