import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const dateRangeSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required(),
  provider: Joi.string().valid('deepseek', 'openai', 'anthropic').optional(),
  groupBy: Joi.string().valid('day', 'hour').default('day'),
  dimension: Joi.string().valid('provider', 'model').default('provider'),
});

const singleDateSchema = Joi.object({
  date: Joi.date().required(),
  provider: Joi.string().valid('deepseek', 'openai', 'anthropic').optional(),
});

// 获取用户Token使用统计 - 日期范围查询
router.get('/usage/range', authenticate, async (req: any, res: Response) => {
  try {
    const { error, value } = dateRangeSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { startDate, endDate, provider, groupBy, dimension } = value;
    const userId = req.user!.id;

    // 构建查询条件
    const whereClause: any = {
      userId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (provider) {
      whereClause.provider = provider;
    }

    let groupByClause: any;

    if (groupBy === 'hour') {
      // 按小时分组
      groupByClause = ['date', 'hour', dimension];
    } else {
      // 按天分组
      groupByClause = ['date', dimension];
    }

    const usage = await prisma.tokenUsage.groupBy({
      by: groupByClause,
      where: whereClause,
      _sum: {
        tokensUsed: true,
        costRmb: true,
      },
      orderBy: [
        { date: 'asc' },
        { hour: 'asc' },
      ],
    });

    // 格式化响应数据
    const formattedUsage = usage.map((item: any) => ({
      date: item.date,
      hour: item.hour,
      provider: dimension === 'provider' ? item.provider : undefined,
      model: dimension === 'model' ? item.model : undefined,
      tokensUsed: item._sum.tokensUsed || 0,
      costRmb: parseFloat(item._sum.costRmb?.toString() || '0'),
    }));

    // 计算总计
    const totals = {
      totalTokens: formattedUsage.reduce((sum, item) => sum + item.tokensUsed, 0),
      totalCost: formattedUsage.reduce((sum, item) => sum + item.costRmb, 0),
    };

    res.json({
      success: true,
      data: {
        usage: formattedUsage,
        totals,
        period: { startDate, endDate },
        groupBy,
        dimension,
      },
    });
  } catch (error) {
    logger.error('Error fetching token usage range:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token usage statistics',
    });
  }
});

// 获取特定日期的详细Token使用统计
router.get('/usage/daily', authenticate, async (req: any, res: Response) => {
  try {
    const { error, value } = singleDateSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { date, provider } = value;
    const userId = req.user!.id;

    // 构建查询条件
    const whereClause: any = {
      userId,
      date: new Date(date),
    };

    if (provider) {
      whereClause.provider = provider;
    }

    // 获取该日期的所有记录
    const dailyUsage = await prisma.tokenUsage.findMany({
      where: whereClause,
      orderBy: [
        { hour: 'asc' },
        { provider: 'asc' },
      ],
      select: {
        hour: true,
        provider: true,
        model: true,
        operation: true,
        tokensUsed: true,
        costRmb: true,
        createdAt: true,
      },
    });

    // 按小时分组统计
    const hourlyStats = Array.from({ length: 24 }, (_, hour) => {
      const hourData = dailyUsage.filter(item => item.hour === hour);
      const totalTokens = hourData.reduce((sum, item) => sum + item.tokensUsed, 0);
      const totalCost = hourData.reduce((sum, item) => sum + parseFloat(item.costRmb.toString()), 0);
      
      return {
        hour,
        tokensUsed: totalTokens,
        costRmb: totalCost,
        details: hourData.map(item => ({
          provider: item.provider,
          model: item.model,
          operation: item.operation,
          tokensUsed: item.tokensUsed,
          costRmb: parseFloat(item.costRmb.toString()),
          timestamp: item.createdAt,
        })),
      };
    });

    // 按提供商统计
    const providerStats = dailyUsage.reduce((acc: any, item) => {
      if (!acc[item.provider]) {
        acc[item.provider] = {
          tokensUsed: 0,
          costRmb: 0,
          operations: 0,
        };
      }
      acc[item.provider].tokensUsed += item.tokensUsed;
      acc[item.provider].costRmb += parseFloat(item.costRmb.toString());
      acc[item.provider].operations += 1;
      return acc;
    }, {});

    // 总计
    const totals = {
      totalTokens: dailyUsage.reduce((sum, item) => sum + item.tokensUsed, 0),
      totalCost: dailyUsage.reduce((sum, item) => sum + parseFloat(item.costRmb.toString()), 0),
      totalOperations: dailyUsage.length,
    };

    res.json({
      success: true,
      data: {
        date,
        hourlyStats,
        providerStats,
        totals,
        rawData: dailyUsage,
      },
    });
  } catch (error) {
    logger.error('Error fetching daily token usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch daily token usage statistics',
    });
  }
});

// 获取最近7天的Token使用趋势
router.get('/usage/trend', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    const dimension = req.query.dimension === 'model' ? 'model' : 'provider';

    const usage = await prisma.tokenUsage.groupBy({
      by: ['date', dimension],
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        tokensUsed: true,
        costRmb: true,
      },
      orderBy: [
        { date: 'asc' },
      ],
    });

    // 格式化为前端需要的数据结构
    const trendData = usage.map((item: any) => ({
      date: item.date.toISOString().split('T')[0],
      provider: dimension === 'provider' ? item.provider : undefined,
      model: dimension === 'model' ? item.model : undefined,
      tokensUsed: item._sum.tokensUsed || 0,
      costRmb: parseFloat(item._sum.costRmb?.toString() || '0'),
    }));

    res.json({
      success: true,
      data: {
        trend: trendData,
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
        dimension,
      },
    });
  } catch (error) {
    logger.error('Error fetching token usage trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token usage trend',
    });
  }
});

// 获取Token使用统计概览
router.get('/overview', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 今日统计
    const todayStats = await prisma.tokenUsage.aggregate({
      where: {
        userId,
        date: today,
      },
      _sum: {
        tokensUsed: true,
        costRmb: true,
      },
      _count: true,
    });

    // 昨日统计
    const yesterdayStats = await prisma.tokenUsage.aggregate({
      where: {
        userId,
        date: yesterday,
      },
      _sum: {
        tokensUsed: true,
        costRmb: true,
      },
    });

    // 本月统计
    const monthStats = await prisma.tokenUsage.aggregate({
      where: {
        userId,
        date: {
          gte: startOfMonth,
        },
      },
      _sum: {
        tokensUsed: true,
        costRmb: true,
      },
    });

    // 按提供商统计（本月）
    const providerStats = await prisma.tokenUsage.groupBy({
      by: ['provider'],
      where: {
        userId,
        date: {
          gte: startOfMonth,
        },
      },
      _sum: {
        tokensUsed: true,
        costRmb: true,
      },
    });

    res.json({
      success: true,
      data: {
        today: {
          tokensUsed: todayStats._sum.tokensUsed || 0,
          costRmb: parseFloat(todayStats._sum.costRmb?.toString() || '0'),
          operations: todayStats._count,
        },
        yesterday: {
          tokensUsed: yesterdayStats._sum.tokensUsed || 0,
          costRmb: parseFloat(yesterdayStats._sum.costRmb?.toString() || '0'),
        },
        month: {
          tokensUsed: monthStats._sum.tokensUsed || 0,
          costRmb: parseFloat(monthStats._sum.costRmb?.toString() || '0'),
        },
        providers: providerStats.map((item: any) => ({
          provider: item.provider,
          tokensUsed: item._sum.tokensUsed || 0,
          costRmb: parseFloat(item._sum.costRmb?.toString() || '0'),
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching token usage overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token usage overview',
    });
  }
});

export default router;
