import { prisma } from '../database';
import { logger } from '../utils/logger';

// Token价格配置 (人民币/1000 tokens)
const TOKEN_PRICES = {
  deepseek: {
    'deepseek-chat': {
      input: 0.0001,   // ¥0.0001 per 1K input tokens
      output: 0.0002,  // ¥0.0002 per 1K output tokens
    },
    'deepseek-coder': {
      input: 0.0001,   // ¥0.0001 per 1K input tokens
      output: 0.0002,  // ¥0.0002 per 1K output tokens
    },
  },
  openai: {
    'gpt-3.5-turbo': {
      input: 0.0105, // ¥0.0105 per 1K input tokens
      output: 0.014, // ¥0.014 per 1K output tokens
    },
    'gpt-4': {
      input: 0.21,   // ¥0.21 per 1K input tokens  
      output: 0.42,  // ¥0.42 per 1K output tokens
    },
    'gpt-4-turbo': {
      input: 0.07,   // ¥0.07 per 1K input tokens  
      output: 0.21,  // ¥0.21 per 1K output tokens
    },
    'gpt-4o': {
      input: 0.035,  // ¥0.035 per 1K input tokens
      output: 0.105, // ¥0.105 per 1K output tokens
    },
    'gpt-4o-mini': {
      input: 0.001,  // ¥0.001 per 1K input tokens
      output: 0.004, // ¥0.004 per 1K output tokens
    },
  },
  anthropic: {
    'claude-3-haiku-20240307': {
      input: 0.014,  // ¥0.014 per 1K input tokens
      output: 0.049, // ¥0.049 per 1K output tokens
    },
    'claude-3-sonnet-20240229': {
      input: 0.21,   // ¥0.21 per 1K input tokens
      output: 0.63,  // ¥0.63 per 1K output tokens
    },
    'claude-3-opus-20240229': {
      input: 1.05,   // ¥1.05 per 1K input tokens
      output: 5.25,  // ¥5.25 per 1K output tokens
    },
  },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export class TokenTracker {
  
  /**
   * 记录Token使用情况
   */
  static async recordUsage(
    userId: string,
    provider: string,
    model: string,
    usage: TokenUsage,
    operation?: string
  ): Promise<void> {
    try {
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentHour = now.getHours();

      // 计算费用
      const cost = this.calculateCost(provider, model, usage);

      // 检查是否已有当前小时的记录
      const existingRecord = await prisma.tokenUsage.findUnique({
        where: {
          userId_date_hour_provider: {
            userId,
            date: today,
            hour: currentHour,
            provider,
          },
        },
      });

      if (existingRecord) {
        // 更新现有记录
        await prisma.tokenUsage.update({
          where: {
            id: existingRecord.id,
          },
          data: {
            tokensUsed: existingRecord.tokensUsed + usage.totalTokens,
            costRmb: Number(existingRecord.costRmb) + cost,
            model: model, // 更新模型信息
            operation: operation, // 更新操作类型
          },
        });
      } else {
        // 创建新记录
        await prisma.tokenUsage.create({
          data: {
            userId,
            date: today,
            hour: currentHour,
            tokensUsed: usage.totalTokens,
            costRmb: cost,
            provider,
            model,
            operation,
          },
        });
      }

      logger.info(`Token usage recorded: ${usage.totalTokens} tokens, ¥${cost.toFixed(4)} for user ${userId} at ${currentHour}:00`);
    } catch (error) {
      logger.error('Failed to record token usage:', error);
    }
  }

  /**
   * 计算Token费用
   */
  private static calculateCost(provider: string, model: string, usage: TokenUsage): number {
    try {
      let pricing: { input: number; output: number } | undefined;

      switch (provider) {
        case 'deepseek':
          pricing = TOKEN_PRICES.deepseek[model as keyof typeof TOKEN_PRICES.deepseek] || TOKEN_PRICES.deepseek['deepseek-chat'];
          break;
          
        case 'openai':
          pricing = TOKEN_PRICES.openai[model as keyof typeof TOKEN_PRICES.openai] || TOKEN_PRICES.openai['gpt-3.5-turbo'];
          break;
          
        case 'anthropic':
          pricing = TOKEN_PRICES.anthropic[model as keyof typeof TOKEN_PRICES.anthropic] || TOKEN_PRICES.anthropic['claude-3-haiku-20240307'];
          break;
          
        default:
          logger.warn(`Unknown provider for cost calculation: ${provider}`);
          return 0;
      }

      if (!pricing) {
        logger.warn(`No pricing found for model: ${model} on provider: ${provider}`);
        return 0;
      }

      // 计算总费用 (价格为每1000个token的费用)
      const inputCost = (usage.inputTokens / 1000) * pricing.input;
      const outputCost = (usage.outputTokens / 1000) * pricing.output;
      
      return inputCost + outputCost;
    } catch (error) {
      logger.error('Error calculating token cost:', error);
      return 0;
    }
  }


  /**
   * 估算Token数量（简单估算）
   */
  static estimateTokens(text: string): number {
    // 简单估算：中文1个字符约等于1.5个token，英文按空格分割计算
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = text.replace(/[\u4e00-\u9fa5]/g, '').split(/\s+/).filter(w => w.length > 0).length;
    
    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3);
  }
}