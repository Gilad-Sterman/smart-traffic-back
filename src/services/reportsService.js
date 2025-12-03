import { supabase } from '../config/supabase.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Reports Service - Handles all report-related database operations
 * Replaces the in-memory sessions with Supabase storage
 */

// Create new report session
export const createReport = async (userId, fileInfo) => {
  try {
    const reportId = uuidv4()
    
    console.log('🔄 Creating report with data:', {
      id: reportId,
      user_id: userId,
      status: 'uploaded',
      original_file: {
        filename: fileInfo.originalName,
        size: fileInfo.size,
        mimetype: fileInfo.mimetype,
        uploaded_at: fileInfo.uploadedAt
      }
    })
    
    const { data: report, error } = await supabase
      .from('reports')
      .insert([
        {
          id: reportId,
          user_id: userId,
          status: 'uploaded',
          original_file: {
            filename: fileInfo.originalName,
            size: fileInfo.size,
            mimetype: fileInfo.mimetype,
            uploaded_at: fileInfo.uploadedAt
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase insert error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return { success: false, error: error.message }
    }

    console.log('✅ Report created successfully:', report.id)
    return { success: true, report }
  } catch (error) {
    console.error('❌ Unexpected error in createReport:', error)
    return { success: false, error: error.message }
  }
}

// Update report with OCR results
export const updateReportOCR = async (reportId, ocrResults) => {
  try {
    const { data: report, error } = await supabase
      .from('reports')
      .update({
        ocr_results: ocrResults,
        status: 'ocr_complete',
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, report }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Update report with AI analysis results
export const updateReportAnalysis = async (reportId, analysisResults) => {
  try {
    const { data: report, error } = await supabase
      .from('reports')
      .update({
        analysis_results: analysisResults,
        status: 'complete',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, report }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get report by ID
export const getReportById = async (reportId) => {
  try {
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, report }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get reports by user ID
export const getReportsByUserId = async (userId, limit = 50, offset = 0) => {
  try {
    const { data: reports, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, reports }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Update report status
export const updateReportStatus = async (reportId, status, errorMessage = null) => {
  try {
    const updateData = {
      status,
      updated_at: new Date().toISOString()
    }

    if (errorMessage) {
      updateData.error_message = errorMessage
    }

    const { data: report, error } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', reportId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, report }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Check if user owns report (authorization helper)
export const verifyReportOwnership = async (reportId, userId) => {
  try {
    const { data: report, error } = await supabase
      .from('reports')
      .select('user_id')
      .eq('id', reportId)
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    const isOwner = report.user_id === userId
    return { success: true, isOwner }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Get report statistics for admin/analytics
export const getReportStats = async (startDate = null, endDate = null) => {
  try {
    let query = supabase
      .from('reports')
      .select('status, created_at')

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: reports, error } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    // Calculate statistics
    const stats = {
      total: reports.length,
      byStatus: {},
      byDate: {}
    }

    reports.forEach(report => {
      // Count by status
      stats.byStatus[report.status] = (stats.byStatus[report.status] || 0) + 1
      
      // Count by date
      const date = report.created_at.split('T')[0]
      stats.byDate[date] = (stats.byDate[date] || 0) + 1
    })

    return { success: true, stats }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
