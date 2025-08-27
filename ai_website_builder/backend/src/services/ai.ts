import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../database';
import { TokenTracker, type TokenUsage } from './tokenTracker';
import { getDefaultPrompt, PromptType } from '../constants/prompts';

interface AIProvider {
  chat?(messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>, userId?: string, customPrompt?: string, model?: string): Promise<string>;
  chatStream?(messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>, onChunk: (chunk: string) => void, userId?: string, customPrompt?: string, model?: string): Promise<void>;
  generateWebsite(prompt: string, userId?: string, customPrompt?: string, model?: string): Promise<{ reply: string; html: string }>;
  generateWebsiteStream?(prompt: string, onChunk: (chunk: { type: 'html' | 'reply'; content: string }) => void, userId?: string, customPrompt?: string, model?: string): Promise<void>;
  editWebsite(content: string, instructions: string, userId?: string, customPrompt?: string, model?: string): Promise<string>;
  editWebsiteStream?(content: string, instructions: string, onChunk: (chunk: string) => void, userId?: string, customPrompt?: string, model?: string): Promise<void>;
  optimizeWebsite(content: string, userId?: string, model?: string): Promise<string>;
}

/**
 * 获取用户的自定义提示词
 * @param userId 用户ID
 * @param promptType 提示词类型
 * @returns 自定义提示词或默认提示词
 */
async function getUserPrompt(userId: string, promptType: PromptType): Promise<string> {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      return getDefaultPrompt(promptType);
    }

    // 根据类型返回对应的自定义提示词，如果没有则返回默认
    switch (promptType) {
      case PromptType.CHAT:
        return settings.chatPrompt || settings.systemPrompt || getDefaultPrompt(promptType);
      case PromptType.GENERATE:
        return settings.generatePrompt || settings.systemPrompt || getDefaultPrompt(promptType);
      case PromptType.EDIT:
        return settings.editPrompt || settings.systemPrompt || getDefaultPrompt(promptType);
      default:
        return settings.systemPrompt || getDefaultPrompt(promptType);
    }
  } catch (error) {
    logger.error('获取用户提示词失败:', error);
    return getDefaultPrompt(promptType);
  }
}

class DeepSeekProvider implements AIProvider {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || config.ai.deepseek.apiKey,
      baseURL: config.ai.deepseek.baseUrl,
      timeout: 180000, // 3 minutes timeout to match frontend
    });
  }

  /**
   * 实时对话功能 - 与用户进行自然对话，收集网站需求
   */
  async chat(messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>, userId?: string, customPrompt?: string, model?: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: model || config.ai.deepseek.model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: false,
    });

    // 记录Token使用情况
    if (userId && response.usage) {
      const tokenUsage: TokenUsage = {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      };
      
      await TokenTracker.recordUsage(userId, 'deepseek', config.ai.deepseek.model, tokenUsage);
    }

    const generatedContent = response.choices[0]?.message?.content;
    if (!generatedContent || generatedContent.trim() === '') {
      throw new Error('AI模型返回了空的内容，请重试或检查API配置');
    }

    return generatedContent;
  }

  /**
   * 流式对话功能 - 支持实时响应
   */
  async chatStream(messages: Array<{role: "system" | "user" | "assistant", content: string}>, onChunk: (chunk: string) => void, userId?: string, customPrompt?: string, model?: string): Promise<void> {
    try {
      // 处理系统提示词
      let finalMessages = [...messages];
      if (customPrompt) {
        // 如果有自定义提示词，确保它作为系统消息存在
        const hasSystemMessage = finalMessages.some(msg => msg.role === "system");
        if (hasSystemMessage) {
          // 替换现有的系统消息
          finalMessages = finalMessages.map(msg => 
            msg.role === "system" ? { ...msg, content: customPrompt } : msg
          );
        } else {
          // 添加新的系统消息
          finalMessages = [{ role: "system", content: customPrompt }, ...finalMessages];
        }
      } else if (userId) {
        // 如果没有自定义提示词但有用户ID，获取用户提示词
        const userPrompt = await getUserPrompt(userId, PromptType.CHAT);
        const hasSystemMessage = finalMessages.some(msg => msg.role === "system");
        if (hasSystemMessage) {
          finalMessages = finalMessages.map(msg => 
            msg.role === "system" ? { ...msg, content: userPrompt } : msg
          );
        } else {
          finalMessages = [{ role: "system", content: userPrompt }, ...finalMessages];
        }
      }

      const stream = await this.client.chat.completions.create({
        model: model || config.ai.deepseek.model,
        messages: finalMessages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });

      let chunkCount = 0;
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          chunkCount++;
          onChunk(content);
        }
      }

    } catch (error) {
      logger.error("❌ DeepSeek chatStream error:", error);
      throw error;
    }
  }

  async generateWebsite(prompt: string, userId?: string, customPrompt?: string, model?: string): Promise<{ reply: string; html: string }> {
    // 获取用户的生成提示词设置
    let systemPrompt: string;
    if (customPrompt) {
      systemPrompt = customPrompt;
    } else if (userId) {
      systemPrompt = await getUserPrompt(userId, PromptType.GENERATE);
    } else {
      systemPrompt = getDefaultPrompt(PromptType.GENERATE);
    }

    // 调试日志：检查使用的提示词
    logger.info('🤖 DeepSeek generateWebsite调用', {
      userId,
      hasCustomPrompt: !!customPrompt,
      hasUserId: !!userId,
      systemPromptLength: systemPrompt.length,
      systemPromptPreview: systemPrompt.substring(0, 100) + '...',
      model: model || config.ai.deepseek.model,
      promptLength: prompt.length
    });

    const response = await this.client.chat.completions.create({
      model: (model || config.ai.deepseek.model) as string,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    // 记录Token使用情况
    if (userId && response.usage) {
      const tokenUsage: TokenUsage = {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      };
      
      await TokenTracker.recordUsage(userId, 'deepseek', config.ai.deepseek.model, tokenUsage);
    }

    const generatedContent = response.choices[0]?.message?.content;
    if (!generatedContent || generatedContent.trim() === '') {
      throw new Error('AI模型返回了空的内容，请重试或检查API配置');
    }

    try {
      // 尝试解析JSON响应
      const parsedResponse = JSON.parse(generatedContent.trim());
      if (parsedResponse.reply && parsedResponse.html) {
        return {
          reply: parsedResponse.reply,
          html: parsedResponse.html
        };
      } else {
        // 如果JSON格式不正确，使用默认回复和原内容作为HTML
        return {
          reply: '我已经为您创建了一个响应式网站，希望您会喜欢！',
          html: generatedContent
        };
      }
    } catch (error) {
      // 如果不是JSON格式，将整个内容作为HTML，提供默认回复

      return {
        reply: '我已经为您创建了一个响应式网站，希望您会喜欢！',
        html: generatedContent
      };
    }
  }

  /**
   * 流式网站生成功能 - 支持实时HTML代码流式输出
   */
  async generateWebsiteStream(prompt: string, onChunk: (chunk: { type: 'html' | 'reply'; content: string }) => void, userId?: string, customPrompt?: string, model?: string): Promise<void> {
    try {
      logger.info('🌊 DeepSeek generateWebsiteStream开始', { 
        model: model || config.ai.deepseek.model, 
        prompt: prompt.substring(0, 100) + '...', 
        userId 
      });

      // 🔥 测试简化提示词，避免JSON格式要求导致的思考延迟
      let systemPrompt: string;
      if (customPrompt) {
        systemPrompt = customPrompt;
      } else {
        // 使用简化的提示词进行流式测试
        systemPrompt = `你是一个网站开发助手。用户会要求你创建网站，请：
1. 立即开始回复，不要等待
2. 边思考边说话，流式回复
3. 先简单说明你要创建什么类型的网站
4. 然后提供HTML代码

现在立即开始回复用户的需求：`;
        
        // 原始逻辑备用
        /*
        if (userId) {
          systemPrompt = await getUserPrompt(userId, PromptType.GENERATE);
        } else {
          systemPrompt = getDefaultPrompt(PromptType.GENERATE);
        }
        */
      }

      const targetModel = model || config.ai.deepseek.model;
      
      // 🔥 DeepSeek 流式测试：确保使用支持流式的模型
      const streamModel = targetModel === 'deepseek-reasoner' ? 'deepseek-chat' : targetModel;
      
      logger.info('🎯 DeepSeek 流式生成配置', {
        originalModel: targetModel,
        streamModel: streamModel,
        baseUrl: config.ai.deepseek.baseUrl,
        hasApiKey: !!config.ai.deepseek.apiKey
      });

      const stream = await this.client.chat.completions.create({
        model: streamModel as string,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        stream: true,
        // 根据DeepSeek文档，添加额外参数确保流式响应
        stream_options: { include_usage: true }
      });

      let fullContent = '';
      let chunkCount = 0;
      
      // 改进的流式JSON解析状态
      let buffer = '';
      let insideJson = false;
      let insideReplyField = false;
      let insideHtmlField = false;
      let fieldDepth = 0;
      let sentReplyLength = 0;
      let sentHtmlLength = 0;
      
      // 字段内容累积器
      let replyContent = '';
      let htmlContent = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          chunkCount++;
          fullContent += content;
          buffer += content;
          
          logger.info(`🌊 DeepSeek Stream Chunk ${chunkCount}: ${content.length} chars`, {
            content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
            timestamp: new Date().toISOString()
          });
          
          // 🔥 临时简化：直接发送原始内容进行测试
          // 这样可以验证是否是JSON解析逻辑导致的延迟
          
          // 立即发送原始内容作为reply，绕过JSON解析
          onChunk({ type: 'reply', content: content });
          
          // 同时保留原有的JSON解析逻辑作为备用
          /*
          // 逐字符分析实现真正的流式解析
          for (let i = 0; i < content.length; i++) {
            const char = content[i];
            
            // 检测JSON开始
            if (char === '{' && !insideJson) {
              insideJson = true;
              continue;
            }
            
            if (!insideJson) continue;
            
            // 在JSON内部进行字段检测
            if (buffer.includes('"reply"') && !insideReplyField && !insideHtmlField) {
              const replyMatch = buffer.match(/"reply"\s*:\s*"/);
              if (replyMatch) {
                insideReplyField = true;
                // 清理buffer，只保留reply字段值之后的内容
                const matchEnd = buffer.indexOf(replyMatch[0]) + replyMatch[0].length;
                buffer = buffer.substring(matchEnd);
                i = buffer.length - 1; // 重置索引
                continue;
              }
            }
            
            if (buffer.includes('"html"') && !insideHtmlField && !insideReplyField) {
              const htmlMatch = buffer.match(/"html"\s*:\s*"/);
              if (htmlMatch) {
                insideHtmlField = true;
                // 清理buffer，只保留html字段值之后的内容
                const matchEnd = buffer.indexOf(htmlMatch[0]) + htmlMatch[0].length;
                buffer = buffer.substring(matchEnd);
                i = buffer.length - 1; // 重置索引
                continue;
              }
            }
            
            // 处理reply字段内容
            if (insideReplyField) {
              if (char === '"' && (i === 0 || content[i-1] !== '\\')) {
                // reply字段结束
                insideReplyField = false;
                buffer = '';
              } else {
                // 累积reply内容并实时发送
                replyContent += char;
                if (replyContent.length > sentReplyLength) {
                  const newReplyChunk = replyContent.substring(sentReplyLength);
                  onChunk({ type: 'reply', content: newReplyChunk });
                  sentReplyLength = replyContent.length;
                }
              }
            }
            
            // 处理html字段内容
            if (insideHtmlField) {
              if (char === '"' && (i === 0 || content[i-1] !== '\\')) {
                // html字段结束
                insideHtmlField = false;
                buffer = '';
              } else {
                // 累积html内容并实时发送
                htmlContent += char;
                if (htmlContent.length > sentHtmlLength) {
                  const newHtmlChunk = htmlContent.substring(sentHtmlLength);
                  onChunk({ type: 'html', content: newHtmlChunk });
                  sentHtmlLength = htmlContent.length;
                }
              }
            }
          }
          */
        }
      }

      // 最终兜底处理 - 确保没有遗漏的内容
      try {
        const parsedResponse = JSON.parse(fullContent.trim());
        if (parsedResponse.reply && parsedResponse.html) {
          // 发送任何遗漏的reply内容
          if (parsedResponse.reply.length > sentReplyLength) {
            const remainingReply = parsedResponse.reply.substring(sentReplyLength);
            onChunk({ type: 'reply', content: remainingReply });
          }
          
          // 发送任何遗漏的html内容
          if (parsedResponse.html.length > sentHtmlLength) {
            const remainingHtml = parsedResponse.html.substring(sentHtmlLength);
            onChunk({ type: 'html', content: remainingHtml });
          }
        } else {
          // 如果解析的JSON格式不正确
          if (!replyContent) {
            onChunk({ type: 'reply', content: '我已经为您创建了一个响应式网站，希望您会喜欢！' });
          }
          if (!htmlContent) {
            onChunk({ type: 'html', content: fullContent });
          }
        }
      } catch (error) {
        // 如果不是JSON格式，作为备选方案发送
  
        if (!replyContent) {
          onChunk({ type: 'reply', content: '我已经为您创建了一个响应式网站，希望您会喜欢！' });
        }
        if (!htmlContent) {
          onChunk({ type: 'html', content: fullContent });
        }
      }

      logger.info('🎉 DeepSeek generateWebsiteStream完成', { 
        totalChunks: chunkCount, 
        totalLength: fullContent.length,
        sentReplyLength,
        sentHtmlLength
      });

    } catch (error) {
      logger.error('DeepSeek generateWebsiteStream error:', error);
      throw error;
    }
  }

  async editWebsite(content: string, instructions: string, userId?: string, customPrompt?: string, model?: string): Promise<string> {
    // 获取用户的编辑提示词设置
    let systemPrompt: string;
    if (customPrompt) {
      systemPrompt = customPrompt;
    } else if (userId) {
      systemPrompt = await getUserPrompt(userId, PromptType.EDIT);
    } else {
      systemPrompt = getDefaultPrompt(PromptType.EDIT);
    }

    logger.info('🔧 DeepSeek editWebsite调用', {
      userId,
      hasCustomPrompt: !!customPrompt,
      systemPromptLength: systemPrompt.length,
      model: model || config.ai.deepseek.model,
      contentLength: content.length,
      instructionsLength: instructions.length
    });

    const response = await this.client.chat.completions.create({
      model: model || config.ai.deepseek.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `当前HTML代码：\n${content}\n\n修改指令：${instructions}` }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    // 记录Token使用情况
    if (userId && response.usage) {
      const tokenUsage: TokenUsage = {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      };
      
      await TokenTracker.recordUsage(userId, 'deepseek', config.ai.deepseek.model, tokenUsage);
    }

    const generatedContent = response.choices[0]?.message?.content;
    if (!generatedContent || generatedContent.trim() === '') {
      throw new Error('AI模型返回了空的内容，请重试或检查API配置');
    }
    return generatedContent;
  }

  async optimizeWebsite(content: string, userId?: string, model?: string): Promise<string> {
    const systemPrompt = `你是一个网页性能优化专家。优化提供的HTML代码，重点关注：
- 性能（压缩CSS、优化图片加载、高效JavaScript）
- SEO（合适的meta标签、结构化数据、语义化HTML）
- 可访问性（ARIA标签、键盘导航、屏幕阅读器支持）
- 代码质量（清洁结构、可维护的CSS）

只返回优化后的HTML代码。`;

    const response = await this.client.chat.completions.create({
      model: model || config.ai.deepseek.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const generatedContent = response.choices[0]?.message?.content;
    if (!generatedContent || generatedContent.trim() === '') {
      throw new Error('AI模型返回了空的内容，请重试或检查API配置');
    }
    return generatedContent;
  }
}

class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || config.ai.openai.apiKey,
      timeout: 180000, // 3 minutes timeout to match frontend
    });
  }

  async generateWebsite(prompt: string, userId?: string, customPrompt?: string, model?: string): Promise<{ reply: string; html: string }> {
    const systemPrompt = customPrompt || `You are an expert web developer and AI assistant. Based on user requirements:
1. Provide a friendly reply explaining what you're creating for the user
2. Create a complete, responsive HTML page

Return format must be JSON:
{
  "reply": "A friendly response to the user explaining what type of website you created",
  "html": "Complete HTML code"
}

HTML Requirements:
- Use semantic HTML5
- Include responsive CSS with mobile-first approach
- Add interactive JavaScript where appropriate
- Use modern CSS features (flexbox, grid, custom properties)
- Ensure accessibility (alt tags, proper heading hierarchy, ARIA labels)
- Include meta tags for SEO
- Style should be modern and professional

Return ONLY JSON format, no markdown code blocks.`;

    const response = await this.client.chat.completions.create({
      model: model || config.ai.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const generatedContent = response.choices[0]?.message?.content;
    if (!generatedContent || generatedContent.trim() === '') {
      throw new Error('AI模型返回了空的内容，请重试或检查API配置');
    }

    try {
      // 尝试解析JSON响应
      const parsedResponse = JSON.parse(generatedContent.trim());
      if (parsedResponse.reply && parsedResponse.html) {
        return {
          reply: parsedResponse.reply,
          html: parsedResponse.html
        };
      } else {
        // 如果JSON格式不正确，使用默认回复和原内容作为HTML
        return {
          reply: 'I have created a responsive website for you. I hope you like it!',
          html: generatedContent
        };
      }
    } catch (error) {
      // 如果不是JSON格式，将整个内容作为HTML，提供默认回复

      return {
        reply: 'I have created a responsive website for you. I hope you like it!',
        html: generatedContent
      };
    }
  }

  /**
   * 流式网站生成功能 - 支持实时响应
   */
  async generateWebsiteStream(prompt: string, onChunk: (chunk: { type: 'html' | 'reply'; content: string }) => void, userId?: string, customPrompt?: string, model?: string): Promise<void> {
    try {
      logger.info('🌊 OpenAI generateWebsiteStream开始', { 
        model: model || config.ai.openai.model, 
        prompt: prompt.substring(0, 100) + '...', 
        userId 
      });

      let systemPrompt = customPrompt || `你是一个专业的网站代码生成器。你的任务是根据用户需求生成完整的HTML网站代码。

重要规则：
1. 不要进行对话或询问问题
2. 直接生成完整的网站HTML代码
3. 必须返回严格的JSON格式

返回格式（重要！）：
{
  "reply": "我已经为您创建了一个[网站类型]网站，包含了您要求的功能和设计。",
  "html": "完整的HTML代码（包含HTML、CSS、JavaScript）"
}

HTML代码要求：
- 完整的<!DOCTYPE html>文档
- 响应式设计，适配所有设备
- 现代化CSS样式（使用flexbox/grid）
- 如需要，包含JavaScript交互
- 专业的视觉设计
- 中文内容（除非另有要求）

示例输出格式：
{"reply": "我已经为您创建了一个现代化的企业官网，包含了首页、产品介绍和联系方式等功能。", "html": "<!DOCTYPE html><html>...</html>"}

重要：只返回JSON，不要任何其他格式！`;

      const stream = await this.client.chat.completions.create({
        model: model || config.ai.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        stream: true,
      });

      let fullContent = '';
      let chunkCount = 0;
      let jsonBuffer = '';
      let currentHtml = '';
      let currentReply = '';
      let isInHtmlBlock = false;
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          chunkCount++;
          fullContent += content;
          jsonBuffer += content;
          
          // 实时解析和发送内容
          // 尝试解析JSON（如果完整）
          if (jsonBuffer.includes('{') && jsonBuffer.includes('}')) {
            try {
              // 尝试从缓冲区中提取JSON
              const jsonStart = jsonBuffer.indexOf('{');
              const jsonEnd = jsonBuffer.lastIndexOf('}');
              
              if (jsonStart >= 0 && jsonEnd > jsonStart) {
                const possibleJson = jsonBuffer.substring(jsonStart, jsonEnd + 1);
                const parsed = JSON.parse(possibleJson);
                
                // 如果成功解析JSON，发送增量数据
                if (parsed.html && parsed.html !== currentHtml) {
                  const htmlDiff = parsed.html.substring(currentHtml.length);
                  if (htmlDiff) {
                    onChunk({ type: 'html', content: htmlDiff });
                    currentHtml = parsed.html;
                  }
                }
                
                if (parsed.reply && parsed.reply !== currentReply) {
                  const replyDiff = parsed.reply.substring(currentReply.length);
                  if (replyDiff) {
                    onChunk({ type: 'reply', content: replyDiff });
                    currentReply = parsed.reply;
                  }
                }
              }
            } catch (parseError) {
              // JSON还不完整，继续累积
            }
          }
          
          // 检测HTML标签并实时发送（作为备选方案）
          if (content.includes('<!DOCTYPE') || content.includes('<html') || content.includes('<body')) {
            isInHtmlBlock = true;
          }
          
          if (isInHtmlBlock && (content.includes('<') || content.includes('>'))) {
            // 实时发送HTML内容块
            onChunk({ type: 'html', content: content });
          }
          
          logger.info(`OpenAI generateWebsiteStream chunk ${chunkCount}: ${content.length} chars`);
        }
      }

      // 处理完整响应 - 确保发送完所有内容
      try {
        // 最终解析完整JSON
        const parsedResponse = JSON.parse(fullContent.trim());
        if (parsedResponse.reply && parsedResponse.html) {
          // 发送剩余的HTML内容（如果有）
          if (parsedResponse.html.length > currentHtml.length) {
            const remainingHtml = parsedResponse.html.substring(currentHtml.length);
            onChunk({ type: 'html', content: remainingHtml });
          }
          
          // 发送剩余的回复内容（如果有）
          if (parsedResponse.reply.length > currentReply.length) {
            const remainingReply = parsedResponse.reply.substring(currentReply.length);
            onChunk({ type: 'reply', content: remainingReply });
          }
        } else {
          // 如果JSON格式不正确，将整个内容作为HTML
          onChunk({ type: 'reply', content: 'I have created a responsive website for you. I hope you like it!' });
          onChunk({ type: 'html', content: fullContent });
        }
      } catch (error) {
        // 如果不是JSON格式，将整个内容作为HTML
  
        onChunk({ type: 'reply', content: 'I have created a responsive website for you. I hope you like it!' });
        onChunk({ type: 'html', content: fullContent });
      }

      logger.info('🎉 OpenAI generateWebsiteStream完成', { 
        totalChunks: chunkCount, 
        totalLength: fullContent.length 
      });

    } catch (error) {
      logger.error('OpenAI generateWebsiteStream error:', error);
      throw error;
    }
  }

  /**
   * 流式网站编辑功能 - 支持实时响应
   */
  async editWebsiteStream(content: string, instructions: string, onChunk: (chunk: string) => void, userId?: string, customPrompt?: string, model?: string): Promise<void> {
    try {
      logger.info('🌊 DeepSeek editWebsiteStream开始', { 
        model: model || config.ai.deepseek.model, 
        instructions: instructions.substring(0, 100) + '...', 
        contentLength: content.length,
        userId 
      });

      // 获取用户的编辑提示词设置
      let systemPrompt: string;
      if (customPrompt) {
        systemPrompt = customPrompt;
      } else if (userId) {
        systemPrompt = await getUserPrompt(userId, PromptType.EDIT);
      } else {
        systemPrompt = getDefaultPrompt(PromptType.EDIT);
      }

      const stream = await this.client.chat.completions.create({
        model: model || config.ai.deepseek.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `当前HTML代码：\n${content}\n\n修改指令：${instructions}` }
        ],
        temperature: 0.2,
        max_tokens: 4000,
        stream: true,
      });

      let chunkCount = 0;
      
      for await (const chunk of stream) {
        const deltaContent = chunk.choices[0]?.delta?.content;
        if (deltaContent) {
          chunkCount++;
          // 实时发送每个内容块，不等待累积
          onChunk(deltaContent);
          
          logger.info(`DeepSeek editWebsiteStream chunk ${chunkCount}: ${deltaContent.length} chars`);
        }
      }

      logger.info('🎉 DeepSeek editWebsiteStream完成', { 
        totalChunks: chunkCount
      });

    } catch (error) {
      logger.error('DeepSeek editWebsiteStream error:', error);
      throw error;
    }
  }

  async editWebsite(content: string, instructions: string, userId?: string, customPrompt?: string, model?: string): Promise<string> {
    const systemPrompt = customPrompt || `You are an expert web developer. Modify the provided HTML code according to the user's instructions.

Rules:
- Preserve existing functionality unless specifically asked to change it
- Maintain responsive design
- Keep the code clean and well-structured
- Only modify what's requested

Return ONLY the modified HTML code, no explanations.`;

    const response = await this.client.chat.completions.create({
      model: model || config.ai.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Current HTML:\n${content}\n\nInstructions: ${instructions}` }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const generatedContent = response.choices[0]?.message?.content;
    if (!generatedContent || generatedContent.trim() === '') {
      throw new Error('AI模型返回了空的内容，请重试或检查API配置');
    }
    return generatedContent;
  }

  async optimizeWebsite(content: string, userId?: string, model?: string): Promise<string> {
    const systemPrompt = `You are a web performance expert. Optimize the provided HTML code for:
- Performance (minimize CSS, optimize images loading, efficient JavaScript)
- SEO (proper meta tags, structured data, semantic HTML)
- Accessibility (ARIA labels, keyboard navigation, screen reader support)
- Code quality (clean structure, maintainable CSS)

Return ONLY the optimized HTML code.`;

    const response = await this.client.chat.completions.create({
      model: model || config.ai.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const generatedContent = response.choices[0]?.message?.content;
    if (!generatedContent || generatedContent.trim() === '') {
      throw new Error('AI模型返回了空的内容，请重试或检查API配置');
    }
    return generatedContent;
  }

  /**
   * 实时对话功能
   */
  async chat(messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>, userId?: string, customPrompt?: string, model?: string): Promise<string> {
    // 处理系统提示词
    let finalMessages = [...messages];
    if (customPrompt) {
      const hasSystemMessage = finalMessages.some(msg => msg.role === "system");
      if (hasSystemMessage) {
        finalMessages = finalMessages.map(msg => 
          msg.role === "system" ? { ...msg, content: customPrompt } : msg
        );
      } else {
        finalMessages = [{ role: "system", content: customPrompt }, ...finalMessages];
      }
    } else if (userId) {
      const userPrompt = await getUserPrompt(userId, PromptType.CHAT);
      const hasSystemMessage = finalMessages.some(msg => msg.role === "system");
      if (hasSystemMessage) {
        finalMessages = finalMessages.map(msg => 
          msg.role === "system" ? { ...msg, content: userPrompt } : msg
        );
      } else {
        finalMessages = [{ role: "system", content: userPrompt }, ...finalMessages];
      }
    }

    const response = await this.client.chat.completions.create({
      model: model || config.ai.openai.model,
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: false,
    });

    const generatedContent = response.choices[0]?.message?.content;
    if (!generatedContent || generatedContent.trim() === '') {
      throw new Error('AI模型返回了空的内容，请重试或检查API配置');
    }

    return generatedContent;
  }

  /**
   * 流式对话功能 - 支持实时响应
   */
  async chatStream(messages: Array<{role: "system" | "user" | "assistant", content: string}>, onChunk: (chunk: string) => void, userId?: string, customPrompt?: string, model?: string): Promise<void> {
    try {
      // 处理系统提示词
      let finalMessages = [...messages];
      if (customPrompt) {
        const hasSystemMessage = finalMessages.some(msg => msg.role === "system");
        if (hasSystemMessage) {
          finalMessages = finalMessages.map(msg => 
            msg.role === "system" ? { ...msg, content: customPrompt } : msg
          );
        } else {
          finalMessages = [{ role: "system", content: customPrompt }, ...finalMessages];
        }
      } else if (userId) {
        const userPrompt = await getUserPrompt(userId, PromptType.CHAT);
        const hasSystemMessage = finalMessages.some(msg => msg.role === "system");
        if (hasSystemMessage) {
          finalMessages = finalMessages.map(msg => 
            msg.role === "system" ? { ...msg, content: userPrompt } : msg
          );
        } else {
          finalMessages = [{ role: "system", content: userPrompt }, ...finalMessages];
        }
      }

      const stream = await this.client.chat.completions.create({
        model: model || config.ai.openai.model,
        messages: finalMessages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });

      let chunkCount = 0;
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          chunkCount++;
          onChunk(content);
        }
      }

    } catch (error) {
      logger.error("❌ OpenAI chatStream error:", error);
      throw error;
    }
  }
}

class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || config.ai.anthropic.apiKey,
      timeout: 180000, // 3 minutes timeout to match frontend
    });
  }

  async generateWebsite(prompt: string, userId?: string, customPrompt?: string, model?: string): Promise<{ reply: string; html: string }> {
    const systemPrompt = customPrompt || `You are an expert web developer. Create a complete, responsive HTML page with inline CSS and JavaScript based on the user's requirements.

Requirements:
- Use semantic HTML5
- Include responsive CSS with mobile-first approach
- Add interactive JavaScript where appropriate
- Use modern CSS features (flexbox, grid, custom properties)
- Ensure accessibility (alt tags, proper heading hierarchy, ARIA labels)
- Include meta tags for SEO
- Style should be modern and professional

Return ONLY the complete HTML code, no explanations or markdown formatting.`;

    const response = await this.client.messages.create({
      model: model || config.ai.anthropic.model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ],
    });

    const generatedContent = response.content[0].type === 'text' ? response.content[0].text : '';
    if (!generatedContent || generatedContent.trim() === '') {
      throw new Error('Anthropic AI模型返回了空的内容，请重试或检查API配置');
    }
    
    return {
      reply: 'I have created a responsive website for you. I hope you like it!',
      html: generatedContent
    };
  }

  async editWebsite(content: string, instructions: string, userId?: string, customPrompt?: string, model?: string): Promise<string> {
    const systemPrompt = customPrompt || `You are an expert web developer. Modify the provided HTML code according to the user's instructions.

Rules:
- Preserve existing functionality unless specifically asked to change it
- Maintain responsive design
- Keep the code clean and well-structured
- Only modify what's requested

Return ONLY the modified HTML code, no explanations.`;

    const response = await this.client.messages.create({
      model: model || config.ai.anthropic.model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Current HTML:\n${content}\n\nInstructions: ${instructions}` }
      ],
    });

    const generatedContent = response.content[0].type === 'text' ? response.content[0].text : '';
    if (!generatedContent || generatedContent.trim() === '') {
      throw new Error('Anthropic AI模型返回了空的内容，请重试或检查API配置');
    }
    return generatedContent;
  }

  async optimizeWebsite(content: string, userId?: string, model?: string): Promise<string> {
    const systemPrompt = `You are a web performance expert. Optimize the provided HTML code for:
- Performance (minimize CSS, optimize images loading, efficient JavaScript)
- SEO (proper meta tags, structured data, semantic HTML)
- Accessibility (ARIA labels, keyboard navigation, screen reader support)
- Code quality (clean structure, maintainable CSS)

Return ONLY the optimized HTML code.`;

    const response = await this.client.messages.create({
      model: model || config.ai.anthropic.model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: content }
      ],
    });

    const generatedContent = response.content[0].type === 'text' ? response.content[0].text : '';
    if (!generatedContent || generatedContent.trim() === '') {
      throw new Error('Anthropic AI模型返回了空的内容，请重试或检查API配置');
    }
    return generatedContent;
  }

  /**
   * 实时对话功能
   */
  async chat(messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>, userId?: string, customPrompt?: string, model?: string): Promise<string> {
    // Anthropic API需要将系统消息分离出来
    let systemPrompt = '';
    let chatMessages: Array<{role: 'user' | 'assistant', content: string}> = [];

    // 处理系统提示词
    if (customPrompt) {
      systemPrompt = customPrompt;
    } else if (userId) {
      systemPrompt = await getUserPrompt(userId, PromptType.CHAT);
    } else {
      systemPrompt = getDefaultPrompt(PromptType.CHAT);
    }

    // 过滤出非系统消息
    chatMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));

    const response = await this.client.messages.create({
      model: model || config.ai.anthropic.model,
      max_tokens: 1000,
      system: systemPrompt,
      messages: chatMessages,
    });

    const generatedContent = response.content[0].type === 'text' ? response.content[0].text : '';
    if (!generatedContent || generatedContent.trim() === '') {
      throw new Error('Anthropic AI模型返回了空的内容，请重试或检查API配置');
    }

    return generatedContent;
  }

  /**
   * 流式对话功能 - Anthropic API暂不支持流式，降级为普通聊天后模拟流式
   */
  async chatStream(messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>, onChunk: (chunk: string) => void, userId?: string, customPrompt?: string, model?: string): Promise<void> {
    try {
      // 获取完整响应
      const fullResponse = await this.chat(messages, userId, customPrompt, model);
      
      // 模拟流式输出，按词或短语发送
      const chunks = fullResponse.split(/([。！？\n])/);
      let chunkCount = 0;
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.trim()) {
          chunkCount++;
          onChunk(chunk);
          // 模拟打字速度，每个词块间隔100-300ms
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        }
      }

    } catch (error) {
      logger.error("❌ Anthropic chatStream error:", error);
      throw error;
    }
  }
}

export class AIService {
  public provider: AIProvider;
  private userProviders: Map<string, AIProvider> = new Map();

  /**
   * 清除用户缓存的AI提供商实例
   */
  public clearUserProviderCache(userId?: string) {
    if (userId) {
      // 清除特定用户的缓存
      const keys = Array.from(this.userProviders.keys()).filter(key => key.startsWith(userId + '-'));
      keys.forEach(key => this.userProviders.delete(key));
      logger.info(`Cleared AI provider cache for user: ${userId}`);
    } else {
      // 清除所有缓存
      this.userProviders.clear();
      logger.info('Cleared all AI provider cache');
    }
  }

  /**
   * 获取用户的AI提供商和设置，并公开此方法以供外部使用
   */
  async getUserProvider(userId: string): Promise<{ provider: AIProvider; settings: any }> {
    return await this.getUserProviderInternal(userId);
  }

  /**
   * 从设置中获取模型，并公开此方法以供外部使用
   */
  getModelFromSettings(settings: any): string | undefined {
    return this.getModelFromSettingsInternal(settings);
  }

  constructor() {
    try {
      switch (config.ai.provider) {
        case 'deepseek':
          if (!config.ai.deepseek.apiKey) {
            throw new Error('DEEPSEEK_API_KEY is required when using DeepSeek provider');
          }
          this.provider = new DeepSeekProvider();
          break;
        case 'anthropic':
          if (!config.ai.anthropic.apiKey) {
            throw new Error('ANTHROPIC_API_KEY is required when using Anthropic provider');
          }
          this.provider = new AnthropicProvider();
          break;
        case 'openai':
          if (!config.ai.openai.apiKey) {
            throw new Error('OPENAI_API_KEY is required when using OpenAI provider');
          }
          this.provider = new OpenAIProvider();
          break;
        default:
          throw new Error(`Unsupported AI provider: ${config.ai.provider}`);
      }
      
      logger.info(`AI Service initialized with provider: ${config.ai.provider}`);
    } catch (error) {
      logger.error('AI Service initialization failed:', error);
      // Use a mock provider for development without API keys
      this.provider = new MockProvider();
      logger.warn('Using mock AI provider for development');
    }
  }

  /**
   * 根据用户设置获取对应的模型（内部实现）
   */
  private getModelFromSettingsInternal(settings: any): string | undefined {
    if (!settings) return undefined;
    
    switch (settings.aiProvider) {
      case 'deepseek':
        return settings.deepseekModel;
      case 'openai':
        return settings.openaiModel;
      case 'anthropic':
        return settings.anthropicModel;
      default:
        return undefined;
    }
  }

  /**
   * 获取用户的AI提供商实例（内部实现）
   */
  private async getUserProviderInternal(userId: string): Promise<{ provider: AIProvider; settings: any }> {
    try {
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      if (!userSettings || !userSettings.aiProvider) {
        return { provider: this.provider, settings: userSettings };
      }

      // 检查是否已缓存
      const cacheKey = `${userId}-${userSettings.aiProvider}`;
      if (this.userProviders.has(cacheKey)) {
        return { provider: this.userProviders.get(cacheKey)!, settings: userSettings };
      }

      // 创建用户专用的提供商实例
      let userProvider: AIProvider;

      switch (userSettings.aiProvider) {
        case 'deepseek':
          if (userSettings.deepseekApiKey) {
            logger.info(`创建用户专用DeepSeek Provider，密钥长度: ${userSettings.deepseekApiKey.length}, 密钥前缀: ${userSettings.deepseekApiKey.substring(0, 6)}...`);
            userProvider = new DeepSeekProvider(userSettings.deepseekApiKey);
          } else {
            logger.info('用户未设置DeepSeek API密钥，使用默认Provider');
            userProvider = this.provider;
          }
          break;
        case 'openai':
          if (userSettings.openaiApiKey) {
            userProvider = new OpenAIProvider(userSettings.openaiApiKey);
          } else {
            userProvider = this.provider;
          }
          break;
        case 'anthropic':
          if (userSettings.anthropicApiKey) {
            userProvider = new AnthropicProvider(userSettings.anthropicApiKey);
          } else {
            userProvider = this.provider;
          }
          break;
        default:
          userProvider = this.provider;
      }

      this.userProviders.set(cacheKey, userProvider);
      return { provider: userProvider, settings: userSettings };
    } catch (error) {
      logger.error('Error getting user provider:', error);
      return { provider: this.provider, settings: null };
    }
  }

  async chat(messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>, userId?: string): Promise<string> {
    try {
      logger.info('Chat with AI', { messagesCount: messages.length, userId });

      if (userId) {
        const { provider, settings } = await this.getUserProviderInternal(userId);
        const customPrompt = settings?.systemPrompt;
        const model = this.getModelFromSettingsInternal(settings);
        
        if (provider.chat) {
          const result = await provider.chat(messages, userId, customPrompt, model);
          logger.info('Chat completed successfully');
          return result;
        } else {
          // 如果提供商不支持chat方法，使用generateWebsite作为后备
          const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
          const result = await provider.generateWebsite(lastUserMessage, userId, customPrompt, model);
          return result.reply;
        }
      } else {
        if (this.provider.chat) {
          const result = await this.provider.chat(messages);
          logger.info('Chat completed successfully');
          return result;
        } else {
          // 后备方案
          const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
          const result = await this.provider.generateWebsite(lastUserMessage);
          return result.reply;
        }
      }
    } catch (error: any) {
      logger.error('Failed to chat with AI:', error);
      
      // 使用Mock Provider作为后备
      logger.warn('AI服务不可用，切换到演示模式');
      const mockProvider = new MockProvider();
      const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
      
      // 模拟对话回复
      return `我理解您说的"${lastUserMessage}"。作为AI助手，我可以帮助您创建网站。请告诉我您想要什么类型的网站，我会为您提供详细的建议。`;
    }
  }

  async generateWebsite(prompt: string, userId?: string): Promise<{ reply: string; html: string }> {
    try {
      logger.info('Generating website with AI', { prompt: prompt.substring(0, 100), userId });

      if (userId) {
        const { provider, settings } = await this.getUserProviderInternal(userId);
        const customPrompt = settings?.systemPrompt;
        const model = this.getModelFromSettingsInternal(settings);
        
        // 详细的调试日志
        logger.info('🔍 AI生成网站 - 用户设置详情', {
          userId,
          hasSettings: !!settings,
          aiProvider: settings?.aiProvider,
          hasCustomPrompt: !!customPrompt,
          customPromptLength: customPrompt?.length || 0,
          customPromptPreview: customPrompt ? customPrompt.substring(0, 100) + '...' : 'none',
          selectedModel: model,
          providerType: provider.constructor.name
        });
        
        const result = await provider.generateWebsite(prompt, userId, customPrompt, model);
        logger.info('Website generated successfully');
        return result;
      } else {
        const result = await this.provider.generateWebsite(prompt);
        logger.info('Website generated successfully');
        return result;
      }
    } catch (error: any) {
      logger.error('Failed to generate website:', error);
      
      // 检查是否是API密钥相关错误，如果是则使用演示模式
      if (error.message && error.message.includes('401')) {
        if (error.message.includes('Authentication Fails') || error.message.includes('invalid')) {
          logger.info('API密钥无效，切换到演示模式');
          const mockProvider = new MockProvider();
          const result = await mockProvider.generateWebsite(prompt, userId);
          logger.info('使用演示模式生成网站成功');
          return result;
        }
        throw new Error('身份验证失败，请检查您的API密钥');
      }
      
      // 检查其他常见错误
      if (error.message && error.message.includes('429')) {
        throw new Error('API请求频率过高，请稍后重试');
      }
      
      if (error.message && error.message.includes('402')) {
        throw new Error('API余额不足，请检查您的账户余额');
      }
      
      // 检查500错误
      if (error.message && (error.message.includes('500') || error.message.includes('Internal Server Error'))) {
        throw new Error('AI服务器内部错误，请稍后重试或联系服务提供商');
      }
      
      // 其他错误也可以使用演示模式作为后备方案
      logger.warn('AI服务不可用，切换到演示模式');
      const mockProvider = new MockProvider();
      const result = await mockProvider.generateWebsite(prompt, userId);
      logger.info('使用演示模式生成网站成功');
      return result;
    }
  }

  /**
   * 流式网站生成功能
   */
  async generateWebsiteStream(prompt: string, onChunk: (chunk: { type: 'html' | 'reply'; content: string }) => void, userId?: string, customPrompt?: string, model?: string): Promise<void> {
    try {
      logger.info('AIService: 开始流式网站生成', { prompt: prompt.substring(0, 100), userId });

      if (userId) {
        const { provider, settings } = await this.getUserProviderInternal(userId);
        const finalCustomPrompt = customPrompt || settings?.systemPrompt;
        const finalModel = model || this.getModelFromSettingsInternal(settings);
        
        // 详细的调试日志
        logger.info('🔍 AIService流式生成 - 用户设置详情', {
          userId,
          hasSettings: !!settings,
          aiProvider: settings?.aiProvider,
          hasCustomPrompt: !!finalCustomPrompt,
          customPromptLength: finalCustomPrompt?.length || 0,
          customPromptPreview: finalCustomPrompt ? finalCustomPrompt.substring(0, 100) + '...' : 'none',
          selectedModel: finalModel,
          providerType: provider.constructor.name,
          hasStreamMethod: !!provider.generateWebsiteStream
        });

        if (provider.generateWebsiteStream) {
          await provider.generateWebsiteStream(prompt, onChunk, userId, finalCustomPrompt, finalModel);
        } else {
          // 如果不支持流式，回退到模拟
          logger.info('Provider不支持流式生成，使用模拟模式');
          const result = await provider.generateWebsite(prompt, userId, finalCustomPrompt, finalModel);
          
          // 模拟分块发送
          const htmlChunks = this.chunkText(result.html, 100);
          for (const chunk of htmlChunks) {
            onChunk({ type: 'html', content: chunk });
            await new Promise(resolve => setTimeout(resolve, 50)); // 模拟延迟
          }
          onChunk({ type: 'reply', content: result.reply });
        }
      } else {
        if (this.provider.generateWebsiteStream) {
          await this.provider.generateWebsiteStream(prompt, onChunk);
        } else {
          const result = await this.provider.generateWebsite(prompt);
          onChunk({ type: 'html', content: result.html });
          onChunk({ type: 'reply', content: result.reply });
        }
      }
      
      logger.info('AIService: 流式网站生成完成');
    } catch (error: any) {
      logger.error('AIService: 流式网站生成失败:', error);
      throw error;
    }
  }

  /**
   * 流式网站编辑功能
   */
  async editWebsiteStream(content: string, instructions: string, onChunk: (chunk: string) => void, userId?: string, customPrompt?: string, model?: string): Promise<void> {
    try {
      logger.info('AIService: 开始流式网站编辑', { instructions: instructions.substring(0, 100), userId });

      if (userId) {
        const { provider, settings } = await this.getUserProviderInternal(userId);
        const finalCustomPrompt = customPrompt || settings?.systemPrompt;
        const finalModel = model || this.getModelFromSettingsInternal(settings);
        
        // 详细的调试日志
        logger.info('🔍 AIService流式编辑 - 用户设置详情', {
          userId,
          hasSettings: !!settings,
          aiProvider: settings?.aiProvider,
          hasCustomPrompt: !!finalCustomPrompt,
          customPromptLength: finalCustomPrompt?.length || 0,
          customPromptPreview: finalCustomPrompt ? finalCustomPrompt.substring(0, 100) + '...' : 'none',
          selectedModel: finalModel,
          providerType: provider.constructor.name,
          hasStreamMethod: !!provider.editWebsiteStream
        });

        if (provider.editWebsiteStream) {
          await provider.editWebsiteStream(content, instructions, onChunk, userId, finalCustomPrompt, finalModel);
        } else {
          // 如果不支持流式，回退到模拟
          logger.info('Provider不支持流式编辑，使用模拟模式');
          const result = await provider.editWebsite(content, instructions, userId, finalCustomPrompt, finalModel);
          
          // 模拟分块发送
          const chunks = this.chunkText(result, 100);
          for (const chunk of chunks) {
            onChunk(chunk);
            await new Promise(resolve => setTimeout(resolve, 50)); // 模拟延迟
          }
        }
      } else {
        if (this.provider.editWebsiteStream) {
          await this.provider.editWebsiteStream(content, instructions, onChunk);
        } else {
          const result = await this.provider.editWebsite(content, instructions);
          onChunk(result);
        }
      }
      
      logger.info('AIService: 流式网站编辑完成');
    } catch (error: any) {
      logger.error('AIService: 流式网站编辑失败:', error);
      throw error;
    }
  }

  /**
   * 将文本分块以模拟流式传输
   */
  private chunkText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async editWebsite(content: string, instructions: string, userId?: string): Promise<string> {
    try {
      logger.info('Editing website with AI', { instructions: instructions.substring(0, 100), userId });

      if (userId) {
        const { provider, settings } = await this.getUserProviderInternal(userId);
        const customPrompt = settings?.systemPrompt;
        const model = this.getModelFromSettingsInternal(settings);
        
        // 详细的调试日志
        logger.info('🔍 AI编辑网站 - 用户设置详情', {
          userId,
          hasSettings: !!settings,
          aiProvider: settings?.aiProvider,
          hasCustomPrompt: !!customPrompt,
          customPromptLength: customPrompt?.length || 0,
          customPromptPreview: customPrompt ? customPrompt.substring(0, 100) + '...' : 'none',
          selectedModel: model,
          providerType: provider.constructor.name,
          instructionsLength: instructions.length
        });
        
        const result = await provider.editWebsite(content, instructions, userId, customPrompt, model);
        logger.info('Website edited successfully');
        return result;
      } else {
        const result = await this.provider.editWebsite(content, instructions);
        logger.info('Website edited successfully');
        return result;
      }
    } catch (error: any) {
      logger.error('Failed to edit website:', error);
      
      // 检查是否是API密钥相关错误，如果是则使用演示模式
      if (error.message && error.message.includes('401')) {
        if (error.message.includes('Authentication Fails') || error.message.includes('invalid')) {
          logger.info('API密钥无效，切换到演示模式进行编辑');
          const mockProvider = new MockProvider();
          const result = await mockProvider.editWebsite(content, instructions, userId);
          logger.info('使用演示模式编辑网站成功');
          return result;
        }
        throw new Error('身份验证失败，请检查您的API密钥');
      }
      
      // 检查其他常见错误
      if (error.message && error.message.includes('429')) {
        throw new Error('API请求频率过高，请稍后重试');
      }
      
      if (error.message && error.message.includes('402')) {
        throw new Error('API余额不足，请检查您的账户余额');
      }
      
      // 检查500错误
      if (error.message && (error.message.includes('500') || error.message.includes('Internal Server Error'))) {
        throw new Error('AI服务器内部错误，请稍后重试或联系服务提供商');
      }
      
      // 其他错误也使用演示模式作为后备方案
      logger.warn('AI服务不可用，切换到演示模式进行编辑');
      const mockProvider = new MockProvider();
      const result = await mockProvider.editWebsite(content, instructions, userId);
      logger.info('使用演示模式编辑网站成功');
      return result;
    }
  }

  async optimizeWebsite(content: string, userId?: string, model?: string): Promise<string> {
    try {
      logger.info('Optimizing website with AI', { userId });

      if (userId) {
        const { provider, settings } = await this.getUserProviderInternal(userId);
        const model = this.getModelFromSettingsInternal(settings);
        const result = await provider.optimizeWebsite(content, userId, model);
        logger.info('Website optimized successfully');
        return result;
      } else {
        const result = await this.provider.optimizeWebsite(content);
        logger.info('Website optimized successfully');
        return result;
      }
    } catch (error) {
      logger.error('Failed to optimize website:', error);
      throw new Error('Failed to optimize website with AI');
    }
  }

  /**
   * 测试AI连接
   */
  async testConnection(provider: string, apiKey: string, model: string, prompt: string, userId?: string): Promise<string> {
    try {
      logger.info('Testing AI connection', { provider, model, userId });

      let testProvider: AIProvider;

      switch (provider) {
        case 'deepseek':
          testProvider = new DeepSeekProvider(apiKey);
          break;
        case 'openai':
          testProvider = new OpenAIProvider(apiKey);
          break;
        case 'anthropic':
          testProvider = new AnthropicProvider(apiKey);
          break;
        default:
          throw new Error(`不支持的AI提供商: ${provider}`);
      }

      // 使用简单的生成网站方法进行测试
      const result = await testProvider.generateWebsite(prompt, userId);
      logger.info('AI connection test successful');
      
      // 兼容返回格式
      if (typeof result === 'string') {
        return result;
      } else {
        return result.html;
      }
    } catch (error: any) {
      logger.error('AI connection test failed:', error);
      throw new Error(`AI连接测试失败: ${error.message}`);
    }
  }
}

// Mock provider for development without API keys
class MockProvider implements AIProvider {
  async chat(messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>, userId?: string, customPrompt?: string, model?: string): Promise<string> {
    logger.info('Using mock AI provider for chat', { messagesCount: messages.length });
    
    // 添加延时模拟真实AI对话过程
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
    
    // 根据用户消息内容进行智能回复
    if (lastUserMessage.includes('你好') || lastUserMessage.includes('hello') || lastUserMessage.includes('hi')) {
      return '你好！我是AI网站构建助手。我可以帮助您创建各种类型的网站。请告诉我您想要创建什么类型的网站？';
    }
    
    if (lastUserMessage.includes('帮助') || lastUserMessage.includes('help')) {
      return '我可以帮助您：\n1. 创建各种类型的网站（企业官网、个人作品集、电商网站等）\n2. 根据您的需求收集详细信息\n3. 生成完整的HTML、CSS和JavaScript代码\n\n请描述您想要创建的网站类型和功能需求。';
    }
    
    if (lastUserMessage.includes('网站') || lastUserMessage.includes('website')) {
      return '很好！我来帮您创建网站。为了给您制作最合适的网站，请告诉我：\n1. 您需要什么类型的网站？（如：企业官网、个人博客、在线商城等）\n2. 您的目标用户是谁？\n3. 您希望网站有哪些主要功能？\n4. 您偏好什么样的设计风格？';
    }
    
    if (lastUserMessage.includes('商城') || lastUserMessage.includes('电商') || lastUserMessage.includes('购物')) {
      return '电商网站是个不错的选择！我可以为您创建一个现代化的在线商城。为了更好地定制，请告诉我：\n1. 您主要销售什么产品？\n2. 需要支付功能吗？\n3. 需要用户注册登录吗？\n4. 您希望什么样的色彩搭配？\n\n当您准备好这些信息后，我就可以开始为您生成网站代码了！';
    }
    
    if (lastUserMessage.includes('企业') || lastUserMessage.includes('公司') || lastUserMessage.includes('官网')) {
      return '企业官网能很好地展示公司形象！我可以为您创建专业的企业网站。请提供：\n1. 公司名称和主要业务\n2. 需要展示的主要内容（如：关于我们、产品服务、联系方式等）\n3. 是否需要新闻动态或案例展示？\n4. 您偏好商务风格还是现代简约风格？\n\n有了这些信息，我就能为您生成完整的企业官网！';
    }
    
    if (lastUserMessage.includes('博客') || lastUserMessage.includes('文章') || lastUserMessage.includes('写作')) {
      return '博客网站很适合分享内容！我可以为您创建一个优雅的博客平台。请告诉我：\n1. 博客的主题方向（如：技术、生活、旅行等）\n2. 需要分类和标签功能吗？\n3. 是否需要评论功能？\n4. 您喜欢简洁风格还是丰富的视觉效果？\n\n我会根据您的需求创建一个美观实用的博客网站！';
    }
    
    if (lastUserMessage.includes('确认') || lastUserMessage.includes('生成') || lastUserMessage.includes('开始')) {
      return '好的！我现在开始为您生成网站。请稍等，我会在左侧的预览区域实时显示生成进度，生成的代码会在代码编辑器中同步显示。这个过程大约需要几分钟时间。';
    }
    
    // 默认回复
    return `我理解您说的"${lastUserMessage}"。作为AI网站构建助手，我可以帮助您创建专业的网站。请告诉我您想要创建什么类型的网站，我会根据您的需求提供详细的指导和生成完整的网站代码。`;
  }

  async chatStream(messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>, onChunk: (chunk: string) => void, userId?: string, customPrompt?: string, model?: string): Promise<void> {

    
    // 获取完整响应
    const fullResponse = await this.chat(messages, userId, customPrompt, model);

    
    // 模拟流式输出，按词或短语发送
    const chunks = fullResponse.split(/([。！？\n])/);
    let sentText = '';
    let chunkCount = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.trim()) {
        chunkCount++;
        sentText += chunk;

        onChunk(chunk);
        // 模拟打字速度，每个词块间隔100-300ms
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      }
    }

  }

  async generateWebsite(prompt: string, userId?: string, customPrompt?: string, model?: string): Promise<{ reply: string; html: string }> {
    logger.info('Using mock AI provider for website generation', { prompt: prompt.substring(0, 50) });
    
    // 添加延时模拟真实AI生成过程
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 根据提示词分析生成不同类型的网站
    const websiteType = this.analyzeWebsiteType(prompt);
    const html = this.generateWebsiteByType(websiteType, prompt);
    
    return {
      reply: `我已经根据您的需求"${prompt}"创建了一个${websiteType === 'default' ? '现代化' : this.getWebsiteTypeName(websiteType)}网站。这是演示模式，请配置API密钥以获得完整功能。`,
      html: html
    };
  }

  private analyzeWebsiteType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('电商') || lowerPrompt.includes('购物') || lowerPrompt.includes('产品展示') || lowerPrompt.includes('商店')) {
      return 'ecommerce';
    } else if (lowerPrompt.includes('餐厅') || lowerPrompt.includes('菜单') || lowerPrompt.includes('美食') || lowerPrompt.includes('咖啡')) {
      return 'restaurant';
    } else if (lowerPrompt.includes('博客') || lowerPrompt.includes('文章') || lowerPrompt.includes('写作') || lowerPrompt.includes('内容')) {
      return 'blog';
    } else if (lowerPrompt.includes('作品集') || lowerPrompt.includes('个人') || lowerPrompt.includes('简历') || lowerPrompt.includes('展示')) {
      return 'portfolio';
    } else if (lowerPrompt.includes('公司') || lowerPrompt.includes('企业') || lowerPrompt.includes('商务') || lowerPrompt.includes('服务')) {
      return 'corporate';
    } else if (lowerPrompt.includes('创意') || lowerPrompt.includes('艺术') || lowerPrompt.includes('设计') || lowerPrompt.includes('工作室')) {
      return 'creative';
    }
    
    return 'default';
  }

  private getWebsiteTypeName(type: string): string {
    const typeNames: { [key: string]: string } = {
      'ecommerce': '电商',
      'restaurant': '餐厅',
      'blog': '博客',
      'portfolio': '作品集',
      'corporate': '企业',
      'creative': '创意'
    };
    return typeNames[type] || '现代化';
  }

  private generateWebsiteByType(type: string, prompt: string): string {
    const templates: { [key: string]: string } = {
      ecommerce: this.generateEcommerceTemplate(prompt),
      restaurant: this.generateRestaurantTemplate(prompt),
      blog: this.generateBlogTemplate(prompt),
      portfolio: this.generatePortfolioTemplate(prompt),
      corporate: this.generateCorporateTemplate(prompt),
      creative: this.generateCreativeTemplate(prompt),
      default: this.generateDefaultTemplate(prompt)
    };
    
    return templates[type] || templates.default;
  }

  private generateEcommerceTemplate(prompt: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>精品商城 - AI生成</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8fafc;
        }
        
        .header {
            background: #fff;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 1rem 0;
            position: fixed;
            width: 100%;
            top: 0;
            z-index: 1000;
        }
        
        .nav {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 2rem;
        }
        
        .logo {
            font-size: 1.8rem;
            font-weight: bold;
            color: #e53e3e;
        }
        
        .hero {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8rem 0 4rem;
            text-align: center;
            margin-top: 80px;
        }
        
        .hero h1 {
            font-size: 3.5rem;
            margin-bottom: 1rem;
        }
        
        .products {
            max-width: 1200px;
            margin: 4rem auto;
            padding: 0 2rem;
        }
        
        .products-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }
        
        .product-card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        
        .product-card:hover {
            transform: translateY(-5px);
        }
        
        .product-image {
            height: 200px;
            background: linear-gradient(45deg, #ff6b6b, #feca57);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
        }
        
        .product-info {
            padding: 1.5rem;
        }
        
        .product-title {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }
        
        .product-price {
            color: #e53e3e;
            font-size: 1.4rem;
            font-weight: bold;
        }
        
        .btn {
            background: #667eea;
            color: white;
            padding: 0.8rem 2rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        
        .btn:hover {
            background: #5a67d8;
            transform: translateY(-2px);
        }
        
        .footer {
            background: #2d3748;
            color: white;
            text-align: center;
            padding: 3rem 0;
            margin-top: 4rem;
        }
        
        @media (max-width: 768px) {
            .hero h1 { font-size: 2.5rem; }
            .nav { flex-direction: column; gap: 1rem; }
            .products { padding: 0 1rem; }
        }
    </style>
</head>
<body>
    <header class="header">
        <nav class="nav">
            <div class="logo">🛒 精品商城</div>
            <div>
                <a href="#products" class="btn">浏览商品</a>
            </div>
        </nav>
    </header>

    <section class="hero">
        <h1>发现精品好物</h1>
        <p>基于您的需求：${prompt}</p>
    </section>

    <section class="products" id="products">
        <h2 style="text-align: center; margin-bottom: 2rem;">热门商品</h2>
        <div class="products-grid">
            <div class="product-card">
                <div class="product-image">📱</div>
                <div class="product-info">
                    <h3 class="product-title">智能手机</h3>
                    <div class="product-price">¥2,999</div>
                    <button class="btn" style="margin-top: 1rem;">加入购物车</button>
                </div>
            </div>
            <div class="product-card">
                <div class="product-image">💻</div>
                <div class="product-info">
                    <h3 class="product-title">笔记本电脑</h3>
                    <div class="product-price">¥5,999</div>
                    <button class="btn" style="margin-top: 1rem;">加入购物车</button>
                </div>
            </div>
            <div class="product-card">
                <div class="product-image">🎧</div>
                <div class="product-info">
                    <h3 class="product-title">无线耳机</h3>
                    <div class="product-price">¥299</div>
                    <button class="btn" style="margin-top: 1rem;">加入购物车</button>
                </div>
            </div>
        </div>
    </section>

    <footer class="footer">
        <p>© 2024 精品商城 - 由AI网站构建器生成</p>
        <p><em>演示模式 - 请配置API密钥以获得完整功能</em></p>
    </footer>

    <script>
        document.querySelectorAll('.btn').forEach(btn => {
            if (btn.textContent.includes('加入购物车')) {
                btn.addEventListener('click', () => {
                    btn.textContent = '已添加 ✓';
                    btn.style.background = '#48bb78';
                    setTimeout(() => {
                        btn.textContent = '加入购物车';
                        btn.style.background = '#667eea';
                    }, 2000);
                });
            }
        });
        
        // 平滑滚动
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });
    </script>
</body>
</html>`;
  }

  private generateRestaurantTemplate(prompt: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>美味餐厅 - AI生成</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #2d3748;
        }
        
        .hero {
            height: 100vh;
            background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), 
                        linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: white;
        }
        
        .hero-content h1 {
            font-size: 4rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }
        
        .menu {
            max-width: 1000px;
            margin: 4rem auto;
            padding: 0 2rem;
        }
        
        .menu-category {
            margin-bottom: 3rem;
        }
        
        .menu-category h3 {
            font-size: 2rem;
            color: #e53e3e;
            text-align: center;
            margin-bottom: 2rem;
            position: relative;
        }
        
        .menu-category h3::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 100px;
            height: 3px;
            background: #e53e3e;
        }
        
        .menu-items {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }
        
        .menu-item {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        
        .menu-item:hover {
            transform: translateY(-3px);
        }
        
        .menu-item h4 {
            color: #2d3748;
            margin-bottom: 0.5rem;
            font-size: 1.2rem;
        }
        
        .menu-item .price {
            color: #e53e3e;
            font-weight: bold;
            font-size: 1.1rem;
            float: right;
        }
        
        .menu-item p {
            color: #666;
            clear: both;
        }
        
        .contact {
            background: #f7fafc;
            padding: 4rem 0;
            text-align: center;
        }
        
        .contact-info {
            max-width: 600px;
            margin: 0 auto;
        }
        
        .contact-item {
            margin: 1rem 0;
            font-size: 1.1rem;
        }
        
        .contact-item strong {
            color: #e53e3e;
        }
        
        @media (max-width: 768px) {
            .hero-content h1 { font-size: 2.5rem; }
            .menu { padding: 0 1rem; }
        }
    </style>
</head>
<body>
    <section class="hero">
        <div class="hero-content">
            <h1>🍽️ 美味餐厅</h1>
            <p style="font-size: 1.2rem;">根据您的需求：${prompt}</p>
        </div>
    </section>

    <section class="menu">
        <div class="menu-category">
            <h3>🥗 精选开胃菜</h3>
            <div class="menu-items">
                <div class="menu-item">
                    <h4>凯撒沙拉</h4>
                    <span class="price">¥38</span>
                    <p>新鲜生菜配特制凯撒酱汁，搭配帕玛森芝士碎</p>
                </div>
                <div class="menu-item">
                    <h4>烟熏三文鱼</h4>
                    <span class="price">¥68</span>
                    <p>挪威进口烟熏三文鱼，配酸豆和洋葱丝</p>
                </div>
            </div>
        </div>

        <div class="menu-category">
            <h3>🍖 主菜推荐</h3>
            <div class="menu-items">
                <div class="menu-item">
                    <h4>澳洲牛排</h4>
                    <span class="price">¥158</span>
                    <p>200g优质澳洲牛排，配时令蔬菜和黑椒汁</p>
                </div>
                <div class="menu-item">
                    <h4>香煎鳕鱼</h4>
                    <span class="price">¥88</span>
                    <p>新鲜鳕鱼配柠檬黄油汁和烤蔬菜</p>
                </div>
                <div class="menu-item">
                    <h4>意式面条</h4>
                    <span class="price">¥48</span>
                    <p>手工制作意面配番茄罗勒酱</p>
                </div>
            </div>
        </div>

        <div class="menu-category">
            <h3>🍰 精美甜品</h3>
            <div class="menu-items">
                <div class="menu-item">
                    <h4>提拉米苏</h4>
                    <span class="price">¥38</span>
                    <p>经典意式甜品，浓郁咖啡香味</p>
                </div>
                <div class="menu-item">
                    <h4>巧克力熔岩蛋糕</h4>
                    <span class="price">¥42</span>
                    <p>温热巧克力蛋糕配香草冰淇淋</p>
                </div>
            </div>
        </div>
    </section>

    <section class="contact">
        <h2>联系我们</h2>
        <div class="contact-info">
            <div class="contact-item">
                <strong>📍 地址：</strong> 上海市黄浦区南京东路123号
            </div>
            <div class="contact-item">
                <strong>📞 电话：</strong> 021-1234-5678
            </div>
            <div class="contact-item">
                <strong>🕒 营业时间：</strong> 11:00-22:00
            </div>
            <div class="contact-item">
                <strong>📧 邮箱：</strong> info@restaurant.com
            </div>
            <p style="margin-top: 2rem; color: #666;"><em>演示模式 - 请配置API密钥以获得完整功能</em></p>
        </div>
    </section>

    <script>
        // 添加菜单项点击效果
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                item.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    item.style.transform = 'translateY(-3px)';
                }, 150);
            });
        });
        
        // 滚动动画效果
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };
        
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);
        
        document.querySelectorAll('.menu-category').forEach(category => {
            category.style.opacity = '0';
            category.style.transform = 'translateY(50px)';
            category.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(category);
        });
    </script>
</body>
</html>`;
  }

  private generateDefaultTemplate(prompt: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI生成的网站</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .hero {
            text-align: center;
            padding: 4rem 0;
            color: white;
        }
        
        .hero h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .content {
            background: white;
            border-radius: 1rem;
            padding: 3rem;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            margin-top: 2rem;
        }
        
        .demo-notice {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-top: 2rem;
            text-align: center;
        }
        
        @media (max-width: 768px) {
            .hero h1 { font-size: 2rem; }
            .container { padding: 1rem; }
            .content { padding: 2rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <h1>🤖 AI生成的网站</h1>
            <p>基于您的需求：${prompt}</p>
        </div>
        
        <div class="content">
            <h2>欢迎使用AI网站构建器</h2>
            <p>这是一个由AI生成的演示网站，展示了AI网站构建器的强大功能。</p>
            
            <div class="demo-notice">
                <strong>📝 演示模式说明</strong><br>
                当前使用的是演示模式。要获得完整的AI功能，请在设置中配置DeepSeek API密钥。
                演示模式仍然可以展示完整的生成过程和用户界面。
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  private generateBlogTemplate(prompt: string): string {
    return this.generateDefaultTemplate(prompt); // 暂时使用默认模板
  }

  private generatePortfolioTemplate(prompt: string): string {
    return this.generateDefaultTemplate(prompt); // 暂时使用默认模板
  }

  private generateCorporateTemplate(prompt: string): string {
    return this.generateDefaultTemplate(prompt); // 暂时使用默认模板
  }

  private generateCreativeTemplate(prompt: string): string {
    return this.generateDefaultTemplate(prompt); // 暂时使用默认模板
  }

  async editWebsite(content: string, instructions: string, userId?: string, customPrompt?: string, model?: string): Promise<string> {
    logger.info('Using mock AI provider for website editing', { 
      userId, 
      customPrompt: customPrompt ? 'provided' : 'none',
      model 
    });
    
    // 添加延时模拟AI编辑过程
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 简单的模拟编辑 - 在内容中添加一个编辑标记
    const editTimestamp = new Date().toLocaleString('zh-CN');
    const editNote = `<!-- AI编辑于 ${editTimestamp}：${instructions.substring(0, 50)} -->`;
    
    // 模拟根据指令修改内容
    let updatedContent = content;
    
    // 添加编辑标记到头部
    if (content.includes('<head>')) {
      updatedContent = content.replace(
        '<head>',
        `<head>\n    ${editNote}`
      );
    }
    
    // 尝试根据指令修改标题
    if (content.includes('<title>')) {
      updatedContent = updatedContent.replace(
        /<title>.*?<\/title>/,
        `<title>已编辑 - ${instructions.substring(0, 30)}</title>`
      );
    }
    
    // 如果包含主要内容区域，添加编辑说明
    if (content.includes('<h1>') || content.includes('<h2>')) {
      const editInfo = `<p style="background: #e6fffa; padding: 10px; border-radius: 5px; margin: 10px 0;"><em>✏️ AI编辑：根据"${instructions}"进行了调整</em></p>`;
      
      // 尝试在第一个内容区域后添加编辑说明
      if (content.includes('</h1>')) {
        updatedContent = updatedContent.replace('</h1>', `</h1>\n${editInfo}`);
      } else if (content.includes('</h2>')) {
        updatedContent = updatedContent.replace('</h2>', `</h2>\n${editInfo}`);
      }
    }
    
    return updatedContent;
  }

  async optimizeWebsite(content: string, userId?: string, customPrompt?: string, model?: string): Promise<string> {
    logger.info('Using mock AI provider for website optimization', { 
      userId, 
      customPrompt: customPrompt ? 'provided' : 'none',
      model 
    });
    
    // 添加延时模拟AI优化过程
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 简单的优化模拟 - 添加性能优化标记
    const optimizationTimestamp = new Date().toLocaleString('zh-CN');
    const optimizationNote = `<!-- AI优化于 ${optimizationTimestamp} -->`;
    
    let optimizedContent = content;
    
    // 添加优化标记
    if (content.includes('<head>')) {
      optimizedContent = content.replace(
        '<head>',
        `<head>\n    ${optimizationNote}`
      );
    }
    
    // 添加优化说明
    const optimizationInfo = `<p style="background: #f0fff4; padding: 10px; border-radius: 5px; margin: 10px 0;"><em>🚀 AI优化：网站已针对性能和用户体验进行优化</em></p>`;
    
    if (content.includes('</h1>')) {
      optimizedContent = optimizedContent.replace('</h1>', `</h1>\n${optimizationInfo}`);
    } else if (content.includes('</h2>')) {
      optimizedContent = optimizedContent.replace('</h2>', `</h2>\n${optimizationInfo}`);
    }
    
    return optimizedContent;
  }
}

export const aiService = new AIService();