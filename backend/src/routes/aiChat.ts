import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { aiChatService } from '../services/aiChat';
import { logger } from '../utils/logger';
import rateLimit from 'express-rate-limit';

const router = Router();

// 聊天请求限流（开发环境宽松设置）
const chatRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: process.env.NODE_ENV === 'development' ? 1000 : 30, // 开发环境1000次/分钟，生产环境30次/分钟
  message: {
    success: false,
    error: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * AI实时流式聊天
 * POST /api/ai-chat/stream
 */
router.post('/stream', chatRateLimit, authenticate, async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  const userId = req.user!.id;

  try {
    const { message, conversationHistory = [] } = req.body;

    // 记录请求
    logger.info('AI聊天请求', {
      userId,
      messageLength: message?.length || 0,
      historyLength: conversationHistory.length,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // 验证输入
    const validation = aiChatService.validateChatInput(message, conversationHistory);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // 处理流式聊天
    await aiChatService.handleStreamChat(
      message,
      conversationHistory,
      userId,
      res
    );

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('AI聊天流处理错误:', {
      error: error.message,
      stack: error.stack,
      userId,
      duration,
      ip: req.ip
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: '聊天服务暂时不可用，请稍后重试'
      });
    }
  }
});

/**
 * 获取聊天配置
 * GET /api/ai-chat/config
 */
router.get('/config', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // 这里可以返回用户的聊天相关配置
    res.json({
      success: true,
      data: {
        maxMessageLength: 4000,
        maxHistoryLength: 50,
        supportedFeatures: ['streaming', 'markdown', 'code-highlighting'],
        rateLimit: {
          requests: 30,
          windowMs: 60000
        }
      }
    });

  } catch (error: any) {
    logger.error('获取聊天配置错误:', error);
    res.status(500).json({
      success: false,
      error: '获取配置失败'
    });
  }
});

/**
 * 健康检查
 * GET /api/ai-chat/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    }
  });
});

export default router;
