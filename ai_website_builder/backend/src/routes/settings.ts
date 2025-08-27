import { Router } from 'express';
import Joi from 'joi';
import { prisma } from '../database';
import { logger } from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth';
import { aiService } from '../services/ai';
import { getDefaultPrompt, PromptType } from '../constants/prompts';

const router = Router();

// Validation schemas
const updateSettingsSchema = Joi.object({
  deepseekApiKey: Joi.string().allow('').optional(),
  openaiApiKey: Joi.string().allow('').optional(),
  anthropicApiKey: Joi.string().allow('').optional(),
  aiProvider: Joi.string().valid('deepseek', 'openai', 'anthropic').optional(),
  deepseekModel: Joi.string().allow('').optional(),
  openaiModel: Joi.string().allow('').optional(),
  anthropicModel: Joi.string().allow('').optional(),
  systemPrompt: Joi.string().allow('').optional(), // 保留向后兼容性
  chatPrompt: Joi.string().allow('').optional(), // 对话聊天提示词
  generatePrompt: Joi.string().allow('').optional(), // 网站生成提示词
  editPrompt: Joi.string().allow('').optional(), // 网站编辑提示词
});

// Get user settings
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { showFullKeys } = req.query; // 新增参数控制是否显示完整密钥

    let settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: {
        id: true,
        deepseekApiKey: true,
        openaiApiKey: true,
        anthropicApiKey: true,
        aiProvider: true,
        deepseekModel: true,
        openaiModel: true,
        anthropicModel: true,
        systemPrompt: true, // 保留向后兼容性
        chatPrompt: true, // 对话聊天提示词
        generatePrompt: true, // 网站生成提示词
        editPrompt: true, // 网站编辑提示词
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          userId,
          aiProvider: 'deepseek',
          deepseekModel: 'deepseek-chat',
          openaiModel: 'gpt-4o',
          anthropicModel: 'claude-3-5-sonnet-20241022',
        },
        select: {
          id: true,
          deepseekApiKey: true,
          openaiApiKey: true,
          anthropicApiKey: true,
          aiProvider: true,
          deepseekModel: true,
          openaiModel: true,
          anthropicModel: true,
          systemPrompt: true, // 保留向后兼容性
          chatPrompt: true, // 对话聊天提示词
          generatePrompt: true, // 网站生成提示词
          editPrompt: true, // 网站编辑提示词
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    // 根据查询参数决定是否掩码化API密钥
    let responseSettings;
    if (showFullKeys === 'true') {
      // 返回完整的API密钥
      responseSettings = settings;
    } else {
      // Mask API keys for security (show only last 4 chars)
      responseSettings = {
        ...settings,
        deepseekApiKey: settings.deepseekApiKey ? 
          `${'*'.repeat(Math.max(0, settings.deepseekApiKey.length - 4))}${settings.deepseekApiKey.slice(-4)}` : null,
        openaiApiKey: settings.openaiApiKey ? 
          `${'*'.repeat(Math.max(0, settings.openaiApiKey.length - 4))}${settings.openaiApiKey.slice(-4)}` : null,
        anthropicApiKey: settings.anthropicApiKey ? 
          `${'*'.repeat(Math.max(0, settings.anthropicApiKey.length - 4))}${settings.anthropicApiKey.slice(-4)}` : null,
      };
    }

    res.json({
      success: true,
      data: responseSettings,
    });
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get settings',
    });
  }
});

// Update user settings
router.put('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { error } = updateSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const userId = req.user!.id;
    const updateData: any = {};

    // Only update provided fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        let value = req.body[key] === '' ? null : req.body[key];
        
        // 防止掩码化的API密钥被保存到数据库
        if (key.includes('ApiKey') && value && typeof value === 'string' && value.includes('*')) {
          logger.warn(`Ignoring masked API key for ${key}`);
          return; // 跳过掩码化的密钥
        }
        
        updateData[key] = value;
      }
    });

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData,
      },
      select: {
        id: true,
        deepseekApiKey: true,
        openaiApiKey: true,
        anthropicApiKey: true,
        aiProvider: true,
        deepseekModel: true,
        openaiModel: true,
        anthropicModel: true,
        systemPrompt: true, // 保留向后兼容性
        chatPrompt: true, // 对话聊天提示词
        generatePrompt: true, // 网站生成提示词
        editPrompt: true, // 网站编辑提示词
        createdAt: true,
        updatedAt: true,
      },
    });

    // 返回完整密钥，不要掩码化
    const responseSettings = settings;

    // 清除用户的AI提供商缓存，确保使用新的API密钥
    aiService.clearUserProviderCache(userId);
    
    logger.info(`User settings updated: ${req.user!.email}`);

    res.json({
      success: true,
      data: responseSettings,
    });
  } catch (error) {
    logger.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
    });
  }
});

// Get token usage statistics
router.get('/usage', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate, provider } = req.query;

    const whereClause: any = { userId };

    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (provider) {
      whereClause.provider = provider;
    }

    const usage = await prisma.tokenUsage.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
    });

    // Calculate totals
    const totals = usage.reduce(
      (acc, record) => {
        acc.totalTokens += record.tokensUsed;
        acc.totalCost += Number(record.costRmb);
        return acc;
      },
      { totalTokens: 0, totalCost: 0 }
    );

    res.json({
      success: true,
      data: {
        usage,
        totals,
      },
    });
  } catch (error) {
    logger.error('Get usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage data',
    });
  }
});

// Get daily usage summary
router.get('/usage/daily', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { days = '30' } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    const usage = await prisma.tokenUsage.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
        },
      },
      orderBy: { date: 'desc' },
    });

    // Group by date
    const dailyUsage = usage.reduce((acc, record) => {
      const dateKey = record.date.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          totalTokens: 0,
          totalCost: 0,
          providers: {},
        };
      }
      
      acc[dateKey].totalTokens += record.tokensUsed;
      acc[dateKey].totalCost += Number(record.costRmb);
      
      if (!acc[dateKey].providers[record.provider]) {
        acc[dateKey].providers[record.provider] = {
          tokens: 0,
          cost: 0,
        };
      }
      
      acc[dateKey].providers[record.provider].tokens += record.tokensUsed;
      acc[dateKey].providers[record.provider].cost += Number(record.costRmb);
      
      return acc;
    }, {} as any);

    const sortedDailyUsage = Object.values(dailyUsage).sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    res.json({
      success: true,
      data: sortedDailyUsage,
    });
  } catch (error) {
    logger.error('Get daily usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get daily usage data',
    });
  }
});

// Get default prompts endpoint
router.get('/default-prompts', authenticate, async (req: AuthRequest, res) => {
  try {
    const defaultPrompts = {
      chatPrompt: getDefaultPrompt(PromptType.CHAT),
      generatePrompt: getDefaultPrompt(PromptType.GENERATE),
      editPrompt: getDefaultPrompt(PromptType.EDIT)
    };

    res.json({
      success: true,
      data: defaultPrompts,
    });
  } catch (error) {
    logger.error('Get default prompts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get default prompts',
    });
  }
});

export default router;