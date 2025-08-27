import { Request, Response, NextFunction } from 'express'

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    const timestamp = new Date().toISOString()
    const { method, url, ip } = req
    const { statusCode } = res
    
    console.log(`[${timestamp}] ${method} ${url} - ${statusCode} - ${duration}ms - ${ip}`)
  })
  
  next()
}