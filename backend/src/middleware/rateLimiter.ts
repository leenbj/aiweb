import { Request, Response, NextFunction } from 'express'
import { RateLimiterMemory } from 'rate-limiter-flexible'

const rateLimiter = new RateLimiterMemory({
  keyPrefix: 'middleware',
  points: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60, // minutes to seconds
})

const aiRateLimiter = new RateLimiterMemory({
  keyPrefix: 'ai',
  points: 20, // 20 AI requests
  duration: 60 * 60, // per hour
})

export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const key = req.ip || 'unknown'
    await rateLimiter.consume(key)
    next()
  } catch (rejRes: any) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1
    res.set('Retry-After', String(secs))
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: secs
    })
  }
}

export const aiRateLimiterMiddleware = async (
  req: Request & { user?: { id: string } },
  res: Response,
  next: NextFunction
) => {
  try {
    const key = req.user?.id || req.ip || 'unknown'
    await aiRateLimiter.consume(key)
    next()
  } catch (rejRes: any) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1
    res.set('Retry-After', String(secs))
    res.status(429).json({
      error: 'AI rate limit exceeded',
      retryAfter: secs
    })
  }
}