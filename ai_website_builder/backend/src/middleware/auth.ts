import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../database';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      logger.debug('认证失败: 缺少Authorization头');
      return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
    }

    if (!authHeader.startsWith('Bearer ')) {
      logger.debug('认证失败: 错误的Authorization头格式');
      return res.status(401).json({ success: false, error: 'Invalid authorization header format.' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token || token.length === 0) {
      logger.debug('认证失败: 空的token');
      return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
    }

    // 检查token基本格式 (JWT应该有三部分，由.分隔)
    if (token.split('.').length !== 3) {
      logger.warn('认证失败: 错误的JWT格式', { tokenPrefix: token.substring(0, 20) });
      return res.status(401).json({ success: false, error: 'Invalid token format.' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        logger.debug('JWT token已过期');
        return res.status(401).json({ success: false, error: 'Token expired.' });
      } else if (jwtError.name === 'JsonWebTokenError') {
        logger.warn('JWT格式错误:', jwtError.message, { tokenPrefix: token.substring(0, 20) });
        return res.status(401).json({ success: false, error: 'Invalid token format.' });
      } else {
        logger.error('JWT验证异常:', jwtError);
        return res.status(401).json({ success: false, error: 'Token verification failed.' });
      }
    }
    
    // 检查decoded token的必要字段
    if (!decoded.id) {
      logger.warn('认证失败: token中缺少用户ID');
      return res.status(401).json({ success: false, error: 'Invalid token payload.' });
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      logger.warn('认证失败: 用户不存在', { userId: decoded.id });
      return res.status(401).json({ success: false, error: 'User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({ success: false, error: 'Authentication service error.' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

// 别名为 authenticateToken，保持向后兼容
export const authenticateToken = authenticate;

// 权限检查中间件
export const requireOwnership = (resourceType: 'website' | 'deployment') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }

      const userId = req.user.id;
      let resourceId: string;

      if (resourceType === 'website') {
        resourceId = req.params.websiteId;
        const website = await prisma.website.findFirst({
          where: {
            id: resourceId,
            userId: userId,
          },
        });

        if (!website) {
          return res.status(404).json({ success: false, error: 'Website not found or access denied.' });
        }
      } else if (resourceType === 'deployment') {
        resourceId = req.params.deploymentId;
        const deployment = await prisma.deployment.findFirst({
          where: {
            id: resourceId,
            website: {
              userId: userId,
            },
          },
        });

        if (!deployment) {
          return res.status(404).json({ success: false, error: 'Deployment not found or access denied.' });
        }
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  };
};

export type { AuthRequest };