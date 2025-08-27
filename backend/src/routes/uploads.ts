import express, { Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import * as fs from 'fs/promises'

const router = express.Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req: AuthRequest, file, cb) => {
    const uploadPath = path.join(process.env.UPLOAD_PATH || './uploads', req.user!.id)
    await fs.mkdir(uploadPath, { recursive: true })
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow images, CSS, JS, and HTML files
  const allowedTypes = /jpeg|jpg|png|gif|svg|css|js|html|txt|json|xml/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if (mimetype && extname) {
    return cb(null, true)
  } else {
    cb(new Error('Invalid file type'))
  }
}

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  },
  fileFilter
})

// Upload single file
router.post('/file', authenticateToken, upload.single('file'), asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  const fileUrl = `/uploads/${req.user!.id}/${req.file.filename}`
  
  res.json({
    file: {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: fileUrl,
      path: req.file.path
    }
  })
}))

// Upload multiple files
router.post('/files', authenticateToken, upload.array('files', 10), asyncHandler(async (req: AuthRequest, res: Response) => {
  const files = req.files as Express.Multer.File[]
  
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' })
  }

  const uploadedFiles = files.map(file => ({
    originalName: file.originalname,
    filename: file.filename,
    size: file.size,
    mimetype: file.mimetype,
    url: `/uploads/${req.user!.id}/${file.filename}`,
    path: file.path
  }))

  res.json({ files: uploadedFiles })
}))

// Get user's uploaded files
router.get('/files', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userUploadPath = path.join(process.env.UPLOAD_PATH || './uploads', req.user!.id)
  
  try {
    const files = await fs.readdir(userUploadPath)
    
    const fileDetails = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(userUploadPath, filename)
        const stats = await fs.stat(filePath)
        
        return {
          filename,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          url: `/uploads/${req.user!.id}/${filename}`
        }
      })
    )

    res.json({ files: fileDetails })
  } catch (error) {
    // Directory doesn't exist or is empty
    res.json({ files: [] })
  }
}))

// Delete uploaded file
router.delete('/file/:filename', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { filename } = req.params
  const filePath = path.join(process.env.UPLOAD_PATH || './uploads', req.user!.id, filename)

  try {
    await fs.unlink(filePath)
    res.json({ message: 'File deleted successfully' })
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' })
    }
    throw error
  }
}))

// Serve uploaded files
router.get('/:userId/:filename', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId, filename } = req.params
  const filePath = path.join(process.env.UPLOAD_PATH || './uploads', userId, filename)

  try {
    await fs.access(filePath)
    res.sendFile(path.resolve(filePath))
  } catch (error) {
    res.status(404).json({ error: 'File not found' })
  }
}))

// Image optimization endpoint
router.post('/optimize-image', authenticateToken, upload.single('image'), asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' })
  }

  const { quality = 80, width, height } = req.body

  try {
    // This would typically use a library like sharp for image optimization
    // For now, we'll just return the original file info
    const optimizedUrl = `/uploads/${req.user!.id}/${req.file.filename}`
    
    res.json({
      original: {
        size: req.file.size,
        filename: req.file.originalname
      },
      optimized: {
        url: optimizedUrl,
        filename: req.file.filename,
        size: req.file.size, // Would be smaller after optimization
        quality: parseInt(quality),
        dimensions: width && height ? { width: parseInt(width), height: parseInt(height) } : null
      }
    })
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Image optimization failed', 
      message: error.message 
    })
  }
}))

// Get upload statistics for user
router.get('/stats', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userUploadPath = path.join(process.env.UPLOAD_PATH || './uploads', req.user!.id)
  
  try {
    const files = await fs.readdir(userUploadPath)
    
    let totalSize = 0
    let fileTypes: Record<string, number> = {}
    
    for (const filename of files) {
      const filePath = path.join(userUploadPath, filename)
      const stats = await fs.stat(filePath)
      
      totalSize += stats.size
      
      const ext = path.extname(filename).toLowerCase()
      fileTypes[ext] = (fileTypes[ext] || 0) + 1
    }

    res.json({
      totalFiles: files.length,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      fileTypes,
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
      maxFileSizeMB: (parseInt(process.env.MAX_FILE_SIZE || '10485760') / (1024 * 1024)).toFixed(2)
    })
  } catch (error) {
    res.json({
      totalFiles: 0,
      totalSize: 0,
      totalSizeMB: '0.00',
      fileTypes: {},
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
      maxFileSizeMB: (parseInt(process.env.MAX_FILE_SIZE || '10485760') / (1024 * 1024)).toFixed(2)
    })
  }
}))

export { router as uploadsRouter }