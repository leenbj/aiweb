import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { aiService } from '../services/ai';
import { prisma } from '../database';
import { logger } from '../utils/logger';
import { getDefaultPrompt, PromptType } from '../constants/prompts';
import { config } from '../config';
import { planTemplate } from '../services/ai/templatePlanner';
import { composeTemplate } from '../services/ai/templateComposer';
import { createTemplateSnapshot } from '../services/templateVersioning';
import { createStreamEmitter } from '../services/ai/streamEmitter';
import { recordPipelineFailure, recordPipelineSuccess } from '../services/metrics/pipelineMetricsCollector';
import { persistWebsiteAssets } from '../services/websiteAssets';

const router = Router();

/**
 * 获取用户的聊天提示词
 */
async function getUserChatPrompt(userId: string): Promise<string> {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      return getDefaultPrompt(PromptType.CHAT);
    }

    // 优先使用专用的聊天提示词，其次是通用系统提示词，最后是默认
    return settings.chatPrompt || settings.systemPrompt || getDefaultPrompt(PromptType.CHAT);
  } catch (error) {
    logger.error('获取用户聊天提示词失败:', error);
    return getDefaultPrompt(PromptType.CHAT);
  }
}

/**
 * 根据模式获取用户提示词
 */
async function getUserPromptByMode(userId: string, mode: 'chat' | 'generate' | 'edit'): Promise<string> {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      const promptTypeMap = {
        chat: PromptType.CHAT,
        generate: PromptType.GENERATE,
        edit: PromptType.EDIT
      };
      return getDefaultPrompt(promptTypeMap[mode]);
    }

    // 根据模式选择对应的提示词
    let customPrompt = '';
    switch (mode) {
      case 'chat':
        customPrompt = settings.chatPrompt || settings.systemPrompt || '';
        break;
      case 'generate':
        customPrompt = settings.generatePrompt || settings.systemPrompt || '';
        break;
      case 'edit':
        customPrompt = settings.editPrompt || settings.systemPrompt || '';
        break;
    }

    // 如果没有自定义提示词，使用默认提示词
    if (!customPrompt) {
      const promptTypeMap = {
        chat: PromptType.CHAT,
        generate: PromptType.GENERATE,
        edit: PromptType.EDIT
      };
      return getDefaultPrompt(promptTypeMap[mode]);
    }

    return customPrompt;
  } catch (error) {
    logger.error(`获取用户${mode}模式提示词失败:`, error);
    const promptTypeMap = {
      chat: PromptType.CHAT,
      generate: PromptType.GENERATE,
      edit: PromptType.EDIT
    };
    return getDefaultPrompt(promptTypeMap[mode]);
  }
}

// Generate website with AI
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  const { prompt, websiteId, conversationId } = req.body || {};
  const userId = req.user?.id;
  const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;

  if (!userId || !prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  let pipelineStage: 'planner' | 'composer' | 'persist' = 'planner';

  try {
    const { provider, settings } = await aiService.getUserProvider(userId);
    const customPrompt = settings?.generatePrompt || settings?.systemPrompt;
    const model = aiService.getModelFromSettings(settings);

    const plannerResult = await planTemplate({
      userContext: prompt,
      scenario: undefined,
      filters: undefined,
      userId,
      customPrompt,
      model,
    });

    if (!plannerResult.success && plannerResult.error) {
      recordPipelineFailure({
        stage: 'planner',
        reason: plannerResult.error,
        requestId,
        metadata: plannerResult.metadata,
      });
    }

    pipelineStage = 'composer';
    const composerResult = await composeTemplate(plannerResult.plan ?? null, {
      requestId,
      userId,
    });

    recordPipelineSuccess({
      stage: 'composer',
      templateSlug: composerResult.plan.page.slug,
      durationMs: composerResult.metadata.durationMs,
      requestId,
      metadata: composerResult.metadata,
    });

    try {
      await createTemplateSnapshot(composerResult.plan.page.slug, {
        plan: composerResult.plan,
        html: composerResult.html,
        css: null,
        js: null,
        components: composerResult.components,
        metadata: {
          planner: plannerResult.metadata,
          composer: composerResult.metadata,
        },
      }, {
        requestId,
        userId,
      });
    } catch (snapshotError) {
      logger.warn('snapshot.save.failed', {
        error: snapshotError instanceof Error ? snapshotError.message : snapshotError,
      });
    }

    pipelineStage = 'persist';
    let websiteRecord;
    if (websiteId) {
      websiteRecord = await prisma.website.findFirst({
        where: { id: websiteId, userId },
      });
      if (!websiteRecord) {
        return res.status(404).json({ success: false, error: 'Website not found' });
      }
    } else {
      websiteRecord = await prisma.website.create({
        data: {
          userId,
          domain: `temp-${Date.now()}.example.com`,
          title: 'AI Generated Website',
          content: '',
          status: 'draft',
        },
      });
    }

    const persistResult = await persistWebsiteContent(
      websiteRecord.id,
      userId,
      composerResult.pages,
      composerResult.html,
      requestId,
    );

    if (conversationId) {
      await prisma.aIMessage.create({
        data: {
          conversationId,
          role: 'user',
          content: prompt,
        },
      });

      await prisma.aIMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: 'Website generated successfully',
          websiteChanges: [
            {
              type: 'create',
              element: 'website',
              content: persistResult.mainHtml,
            },
          ],
        },
      });
    }

    const replyText = plannerResult.success
      ? 'Website plan generated successfully.'
      : 'Fallback template applied due to planner error.';

    res.json({
      success: true,
      data: {
        website: persistResult.website,
        content: persistResult.mainHtml,
        pages: persistResult.pages,
        reply: replyText,
        plan: composerResult.plan,
        metadata: {
          planner: {
            success: plannerResult.success,
            attempts: plannerResult.attempts,
            error: plannerResult.error,
            ...plannerResult.metadata,
          },
          composer: composerResult.metadata,
        },
      },
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to generate website';
    recordPipelineFailure({
      stage: pipelineStage,
      reason: message,
      requestId,
    });
    logger.error('Generate website error:', error);

    let statusCode = 500;
    let errorMessage = message;

    if (errorMessage.includes('API密钥') || errorMessage.includes('身份验证')) {
      statusCode = 400;
    } else if (errorMessage.includes('请求频率')) {
      statusCode = 429;
    } else if (errorMessage.includes('余额不足')) {
      statusCode = 402;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      message: errorMessage,
    });
  }
});

// Edit website with AI
router.post('/edit', authenticate, async (req: any, res: Response) => {
  try {
    const { websiteId, instructions, conversationId } = req.body;
    const userId = req.user!.id;
    const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;

    if (!websiteId || !instructions) {
      return res.status(400).json({ success: false, error: 'Website ID and instructions are required' });
    }

    // Get current website
    const website = await prisma.website.findFirst({
      where: { id: websiteId, userId },
    });

    if (!website) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    // Edit website with AI (aiService internal will handle user settings)
    const newContent = await aiService.editWebsite(website.content, instructions, userId);

    // 检查编辑后的内容是否有效
    if (!newContent || newContent.trim() === '') {
      throw new Error('AI服务未能生成有效的编辑结果，请重试');
    }

    const persistResult = await persistWebsiteContent(
      websiteId,
      userId,
      [{ slug: 'index', html: newContent }],
      newContent,
      requestId,
    );

    // Save conversation if provided
    if (conversationId) {
      await prisma.aIMessage.create({
        data: {
          conversationId,
          role: 'user',
          content: instructions,
        },
      });

      await prisma.aIMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: 'Website updated successfully',
          websiteChanges: [
            {
              type: 'update',
              element: 'website',
              content: persistResult.mainHtml,
            },
          ],
        },
      });
    }

    res.json({
      success: true,
      data: {
        website: persistResult.website,
        content: persistResult.mainHtml,
        pages: persistResult.pages,
      },
    });
  } catch (error: any) {
    logger.error('Edit website error:', error);
    
    // 提取具体错误消息并传递给前端
    let errorMessage = 'Failed to edit website';
    let statusCode = 500;
    
    if (error?.message) {
      errorMessage = error.message;
      // 如果是API密钥相关错误，使用400状态码
      if (error.message.includes('API密钥') || error.message.includes('身份验证')) {
        statusCode = 400;
      }
      // 如果是API请求限制错误，使用429状态码
      else if (error.message.includes('请求频率')) {
        statusCode = 429;
      }
      // 如果是余额不足错误，使用402状态码
      else if (error.message.includes('余额不足')) {
        statusCode = 402;
      }
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      message: errorMessage // 添加message字段确保前端能接收到
    });
  }
});

// Optimize website
router.post('/optimize', authenticate, async (req: any, res: Response) => {
  try {
    const { websiteId } = req.body;
    const userId = req.user!.id;
    const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;

    if (!websiteId) {
      return res.status(400).json({ success: false, error: 'Website ID is required' });
    }

    // Get current website
    const website = await prisma.website.findFirst({
      where: { id: websiteId, userId },
    });

    if (!website) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    // Optimize website with AI
    const optimizedContent = await aiService.optimizeWebsite(website.content, userId);

    const persistResult = await persistWebsiteContent(
      websiteId,
      userId,
      [{ slug: 'index', html: optimizedContent }],
      optimizedContent,
      requestId,
    );

    res.json({
      success: true,
      data: {
        website: persistResult.website,
        content: persistResult.mainHtml,
        pages: persistResult.pages,
      },
    });
  } catch (error) {
    logger.error('Optimize website error:', error);
    res.status(500).json({ success: false, error: 'Failed to optimize website' });
  }
});

// Start or continue conversation
router.post('/conversation', authenticate, async (req: any, res: Response) => {
  try {
    const { websiteId, title } = req.body;
    const userId = req.user!.id;

    if (!websiteId) {
      return res.status(400).json({ success: false, error: 'Website ID is required' });
    }

    // Check if website belongs to user
    const website = await prisma.website.findFirst({
      where: { id: websiteId, userId },
    });

    if (!website) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    // Create conversation
    const conversation = await prisma.aIConversation.create({
      data: {
        userId,
        websiteId,
        title: title || 'New Conversation',
      },
    });

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Create conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
});

// Get conversation history
router.get('/conversation/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const conversation = await prisma.aIConversation.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        website: {
          select: { id: true, title: true, domain: true },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to get conversation' });
  }
});

// Get available models
router.get('/models', authenticate, async (req: any, res: Response) => {
  try {
    const models = {
      deepseek: {
        name: 'DeepSeek',
        models: config.ai.deepseek.availableModels.map(model => ({
          id: model,
          name: model === 'deepseek-chat' ? 'DeepSeek V3 Chat' : 
                model === 'deepseek-reasoner' ? 'DeepSeek R1 Reasoner' : model,
          description: model === 'deepseek-chat' ? '强大的对话模型，适合创意生成' :
                      model === 'deepseek-reasoner' ? '推理模型，适合复杂问题解决' : ''
        }))
      },
      openai: {
        name: 'OpenAI',
        models: config.ai.openai.availableModels.map(model => ({
          id: model,
          name: model === 'gpt-4o' ? 'GPT-4o' :
                model === 'gpt-4o-mini' ? 'GPT-4o Mini' :
                model === 'gpt-4-turbo' ? 'GPT-4 Turbo' :
                model === 'gpt-4' ? 'GPT-4' :
                model === 'gpt-3.5-turbo' ? 'GPT-3.5 Turbo' : model,
          description: model === 'gpt-4o' ? '最新最强大的GPT模型' :
                      model === 'gpt-4o-mini' ? '轻量高效的版本' :
                      model === 'gpt-4-turbo' ? '快速响应的GPT-4' : ''
        }))
      },
      anthropic: {
        name: 'Anthropic',
        models: config.ai.anthropic.availableModels.map(model => ({
          id: model,
          name: model.includes('sonnet') ? 'Claude 3.5 Sonnet' :
                model.includes('haiku') ? 'Claude 3.5 Haiku' :
                model.includes('opus') ? 'Claude 3 Opus' : model,
          description: model.includes('sonnet') ? '平衡性能与成本的优秀模型' :
                      model.includes('haiku') ? '快速响应的轻量模型' :
                      model.includes('opus') ? '最强大的Claude模型' : ''
        }))
      }
    };

    res.json({
      success: true,
      data: models
    });
  } catch (error) {
    logger.error('Get models error:', error);
    res.status(500).json({ success: false, error: 'Failed to get models' });
  }
});

// Test AI connection
router.post('/test-connection', authenticate, async (req: any, res: Response) => {
  try {
    const { provider, apiKey, model } = req.body;
    const userId = req.user!.id;

    if (!provider) {
      return res.status(400).json({ success: false, error: 'Provider is required' });
    }

    if (!apiKey || apiKey.includes('*')) {
      return res.json({
        success: false,
        data: {
          connected: false,
          error: '请输入有效的API密钥进行测试',
          provider,
          model
        }
      });
    }

    // 临时测试AI连接
    const testPrompt = '请简短回复"连接测试成功"';
    
    try {
      // 使用有效的API密钥进行测试
      const testResult = await aiService.testConnection(provider, apiKey, model, testPrompt, userId);
      
      res.json({
        success: true,
        data: {
          connected: true,
          response: testResult,
          provider,
          model
        }
      });
    } catch (connectionError: any) {
      logger.error('AI connection test failed:', connectionError);
      res.json({
        success: false,
        data: {
          connected: false,
          error: connectionError?.message || 'Connection failed',
          provider,
          model
        }
      });
    }
  } catch (error) {
    logger.error('Test connection error:', error);
    res.status(500).json({ success: false, error: 'Failed to test connection' });
  }
});

// AI Chat Stream for real-time response
router.post('/chat-stream', authenticate, async (req: any, res: Response) => {
  try {
    const { message, conversationHistory = [], mode = 'chat', stage, requirements } = req.body;
    const userId = req.user!.id;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 根据模式获取用户的提示词（优先使用设置页面中的提示词）
    const systemPrompt = await getUserPromptByMode(userId, mode as 'chat' | 'generate' | 'edit');
    
    // 构建对话消息数组
    const messages = [
      {
        role: 'system' as const,
        content: systemPrompt
      },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user' as const,
        content: message
      }
    ];

    try {

      if (userId) {
        const { provider, settings } = await aiService.getUserProvider(userId);
        // 对话场景明确使用“对话聊天提示词”，不要被系统通用提示词覆盖
        const customPrompt = systemPrompt;
        const model = aiService.getModelFromSettings(settings);
        let fullResponse = '';
        let chunkIndex = 0;

        if (provider.chatStream) {
          await provider.chatStream(messages, (chunk: string) => {
            fullResponse += chunk;
            chunkIndex++;
            res.write(`data: ${JSON.stringify({ 
              type: 'chunk', 
              content: chunk, 
              mode: mode,
              hasCustomPrompt: !!systemPrompt,
              chunkIndex
            })}\n\n`);
          }, userId, customPrompt, model);
        } else if (provider.chat) {
          // 如果不支持流式，降级为普通chat：用chunk事件输出，保持后续续写能力
          const result = await provider.chat(messages, userId, customPrompt, model);
          fullResponse += result || '';
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: result, mode: mode, hasCustomPrompt: !!systemPrompt, chunkIndex: ++chunkIndex })}\n\n`);
        } else {
          throw new Error('Provider does not support chat or chatStream');
        }

        // 自动续写直到完整HTML（若本轮含HTML但未闭合）
        try {
          const hasStarted = /```html|<!DOCTYPE\s+html|<html|<head|<body/i.test(fullResponse);
          let currentHtml = extractPureHtmlFromResponse(fullResponse) || '';
          let isComplete = /<\/html>/i.test(currentHtml) || /<\/html>/i.test(fullResponse);
          const MAX_FOLLOWUPS = 10; // 进一步提高续写上限
          let followups = 0;
          let lastHtmlLength = currentHtml.length;

          while (hasStarted && !isComplete && followups < MAX_FOLLOWUPS) {
            followups++;
            const continuationPrompt =
              '继续输出刚才未完成的HTML网页代码，从中断处接着往后输出，直到包含完整的</html>结束标签为止。严格要求：只输出代码，不要任何说明或前后缀；不要使用```html或```围栏；不要重复已输出的任何部分。';

            const followupMessages = [
              ...messages,
              { role: 'assistant' as const, content: fullResponse },
              { role: 'user' as const, content: continuationPrompt }
            ];

            if (provider.chat) {
              const more = await provider.chat(followupMessages, userId, customPrompt, model);
              const addition = more || '';
              const parts = addition.match(/[\s\S]{1,512}/g) || [addition];
              for (const part of parts) {
                fullResponse += part;
                chunkIndex++;
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: part, mode: mode, chunkIndex })}\n\n`);
              }
            } else if (provider.chatStream) {
              await provider.chatStream(
                followupMessages,
                (chunk: string) => {
                  fullResponse += chunk;
                  chunkIndex++;
                  res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk, mode: mode, chunkIndex })}\n\n`);
                },
                userId,
                customPrompt,
                model
              );
            } else {
              break;
            }

            currentHtml = extractPureHtmlFromResponse(fullResponse) || '';
            isComplete = /<\/html>/i.test(currentHtml) || /<\/html>/i.test(fullResponse);
            if (currentHtml.length <= lastHtmlLength && !isComplete) {
              logger.warn('chat-stream 自动续写无进展，提前结束', { followups, htmlLen: currentHtml.length, lastHtmlLength });
              break;
            }
            lastHtmlLength = currentHtml.length;
          }
        } catch (ensureErr) {
          logger.warn('chat-stream 自动续写完整HTML出现问题：', ensureErr);
        }

        // 尾部兜底合并：若仍未闭合，追加必要的收尾标签（仅在确有HTML信号时启用）
        try {
          const hasHtmlOpen = /<html[^>]*>/i.test(fullResponse);
          const hasDoctype = /<!DOCTYPE\s+html>/i.test(fullResponse);
          const hasBodyOpen = /<body[^>]*>/i.test(fullResponse);
          const hasHtmlClose = /<\/html>/i.test(fullResponse);
          const hasBodyClose = /<\/body>/i.test(fullResponse);
          const htmlStr = extractPureHtmlFromResponse(fullResponse) || '';
          const shouldTail = !!htmlStr || hasHtmlOpen || hasBodyOpen || hasDoctype;

          if (shouldTail) {
            let tail = '';
            if (hasBodyOpen && !hasBodyClose) tail += '</body>';
            if (hasHtmlOpen && !hasHtmlClose) tail += '</html>';

            if (!hasHtmlOpen) {
              const skeleton = `${hasDoctype ? '' : '<!DOCTYPE html>\n'}<html lang="zh-CN">\n<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>AI Generated</title></head>\n<body>\n${htmlStr || fullResponse}\n</body>\n</html>`;
              fullResponse += skeleton;
              chunkIndex++;
              res.write(`data: ${JSON.stringify({ type: 'chunk', content: skeleton, mode: mode, chunkIndex })}\n\n`);
            } else if (tail) {
              fullResponse += tail;
              chunkIndex++;
              res.write(`data: ${JSON.stringify({ type: 'chunk', content: tail, mode: mode, chunkIndex })}\n\n`);
            }
          }
        } catch (tailErr) {
          logger.warn('chat-stream 尾部兜底合并失败：', tailErr);
        }
      } else {
        if (aiService.provider.chatStream) {
          let fullResponse = '';
          let chunkIndex = 0;
          await aiService.provider.chatStream(messages, (chunk: string) => {
            fullResponse += chunk;
            chunkIndex++;
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk, chunkIndex })}\n\n`);
          });
          // 非登录态兜底：尝试一次完整性检查，但不做续写
        } else if (aiService.provider.chat) {
          const result = await aiService.provider.chat(messages);
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: result, chunkIndex: 1 })}\n\n`);
        } else {
          throw new Error('Default provider does not support chat or chatStream');
        }
      }
      
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
      
    } catch (error: any) {
      logger.error('Failed to chat stream with AI:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'AI聊天失败' })}\n\n`);
      res.end();
    }
  } catch (error) {
    logger.error('Chat stream error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process chat stream' 
    });
  }
});

// AI Chat for conversational requirements gathering
router.post('/chat', authenticate, async (req: any, res: Response) => {
  try {
    const { message, conversationHistory = [], stage, requirements } = req.body;
    const userId = req.user!.id;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // 使用设置页面中的“对话聊天提示词”作为系统提示
    const chatSystemPrompt = await getUserPromptByMode(userId, 'chat');

    // 构建对话消息数组
    const messages = [
      {
        role: 'system' as const,
        content: chatSystemPrompt
      },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user' as const,
        content: message
      }
    ];

    // 调用AI服务进行对话
    const reply = await aiService.chat(messages, userId);

    res.json({
      success: true,
      data: {
        reply,
        stage: stage || 'chatting',
      },
    });
  } catch (error: any) {
    logger.error('AI Chat error:', error);
    
    // 提取具体错误消息并传递给前端
    let errorMessage = 'Failed to process chat message';
    let statusCode = 500;
    
    if (error?.message) {
      errorMessage = error.message;
      // 如果是API密钥相关错误，使用400状态码
      if (error.message.includes('API密钥') || error.message.includes('身份验证')) {
        statusCode = 400;
      }
      // 如果是API请求限制错误，使用429状态码
      else if (error.message.includes('请求频率')) {
        statusCode = 429;
      }
      // 如果是余额不足错误，使用402状态码
      else if (error.message.includes('余额不足')) {
        statusCode = 402;
      }
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      message: errorMessage
    });
  }
});

// Generate website with AI - Streaming version
router.post('/generate-stream', authenticate, async (req: AuthRequest, res: Response) => {
  const { prompt, websiteId, scenario, filters, persist = true } = req.body || {};
  const userId = req.user?.id;
  const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined;

  const emitter = createStreamEmitter(res, {
    requestId,
  });

  if (!userId || !prompt || typeof prompt !== 'string') {
    emitter.error('Prompt and authenticated user are required.');
    return;
  }

  emitter.stage('request', 'start', { websiteId: websiteId ?? null });

  try {
    const { provider, settings } = await aiService.getUserProvider(userId);
    const customPrompt = settings?.generatePrompt || settings?.systemPrompt;
    const model = aiService.getModelFromSettings(settings);

    emitter.log('info', 'provider.selected', {
      provider: provider.constructor.name,
      model,
    });

    emitter.stage('planner', 'start', {});
    const plannerResult = await planTemplate({
      userContext: prompt,
      scenario: typeof scenario === 'string' ? scenario : undefined,
      filters: typeof filters === 'object' && filters !== null ? filters : undefined,
      userId,
      customPrompt,
      model,
    });

    if (plannerResult.success && plannerResult.plan) {
      emitter.stage('planner', 'success', {
        attempts: plannerResult.attempts,
        totalTemplates: plannerResult.metadata.totalTemplates,
      });
      emitter.plan({
        plan: plannerResult.plan,
        metadata: plannerResult.metadata,
      });
    } else {
      emitter.stage('planner', 'error', {
        attempts: plannerResult.attempts,
        error: plannerResult.error,
      });
      if (plannerResult.error) {
        emitter.log('warn', 'planner.failed', { error: plannerResult.error });
        recordPipelineFailure({
          stage: 'planner',
          reason: plannerResult.error,
          requestId,
          metadata: plannerResult.metadata,
        });
      }
    }

    emitter.stage('composer', 'start', {});
    const composerResult = await composeTemplate(plannerResult.plan ?? null, {
      requestId,
      userId,
    });

    emitter.stage('composer', 'success', {
      fallbackUsed: composerResult.metadata.fallbackUsed,
      issues: composerResult.metadata.issues,
    });

    if (!plannerResult.success) {
      emitter.plan({
        plan: composerResult.plan,
        metadata: {
          ...composerResult.metadata,
          source: 'fallback',
        },
      });
    }

    emitter.preview({
      html: composerResult.html,
      components: composerResult.components,
      metadata: composerResult.metadata,
    });

    try {
      await createTemplateSnapshot(composerResult.plan.page.slug, {
        plan: composerResult.plan,
        html: composerResult.html,
        css: null,
        js: null,
        components: composerResult.components,
        metadata: {
          planner: plannerResult.metadata,
          composer: composerResult.metadata,
        },
      }, {
        requestId,
        userId,
      });
      emitter.log('info', 'snapshot.saved', { slug: composerResult.plan.page.slug });
    } catch (snapshotError) {
      emitter.log('warn', 'snapshot.failed', {
        error: snapshotError instanceof Error ? snapshotError.message : snapshotError,
      });
    }

    let website = null;
    let persistedPages: Array<{ slug: string; html: string; publicPath: string }> | undefined;
    if (persist) {
      emitter.stage('persist', 'start', { websiteId: websiteId ?? null });
      let targetWebsite = websiteId
        ? await prisma.website.findFirst({ where: { id: websiteId, userId } })
        : null;

      if (!targetWebsite) {
        targetWebsite = await prisma.website.create({
          data: {
            userId,
            domain: `temp-${Date.now()}.example.com`,
            title: 'AI Generated Website',
            content: '',
            status: 'draft',
          },
        });
      }

      const persistResult = await persistWebsiteContent(
        targetWebsite.id,
        userId,
        composerResult.pages,
        composerResult.html,
        requestId,
      );
      website = persistResult.website;
      persistedPages = persistResult.pages;
      emitter.stage('persist', 'success', { websiteId: website?.id ?? null });
    }

    const finalHtml = persistedPages && persistedPages.length > 0
      ? persistedPages[0].html
      : composerResult.html;

    emitter.complete({
      plan: composerResult.plan,
      html: finalHtml,
      reply: plannerResult.success ? 'Website plan generated successfully.' : 'Fallback template applied due to planner error.',
      metadata: {
        planner: {
          success: plannerResult.success,
          attempts: plannerResult.attempts,
          error: plannerResult.error,
          ...plannerResult.metadata,
        },
        composer: composerResult.metadata,
      },
      snapshot: composerResult.snapshot,
      website,
      pages: persistedPages ?? composerResult.pages,
    });

    recordPipelineSuccess({
      stage: 'composer',
      templateSlug: composerResult.plan.page.slug,
      durationMs: composerResult.metadata?.durationMs,
      requestId,
      metadata: composerResult.metadata,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    logger.error('generate-stream.failed', error);
    emitter.error(message, {
      stack: error instanceof Error ? error.stack : undefined,
    });
    recordPipelineFailure({
      stage: 'composer',
      reason: message,
      requestId,
    });
  }
});

// Edit website with AI - Streaming version  
router.post('/edit-stream', authenticate, async (req: any, res: Response) => {
  try {
    const { websiteId, instructions } = req.body;
    const userId = req.user!.id;

    if (!websiteId || !instructions) {
      return res.status(400).json({ success: false, error: 'Website ID and instructions are required' });
    }

    // 获取当前网站
    const website = await prisma.website.findFirst({
      where: { id: websiteId, userId },
    });

    if (!website) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    let newContent = '';

    try {
      // console.log('🌊 开始流式网站编辑', { userId, websiteId, instructionsLength: instructions.length });
      
      const { provider, settings } = await aiService.getUserProvider(userId);
      const customPrompt = settings?.systemPrompt;
      const model = aiService.getModelFromSettings(settings);
      
      // 检查provider是否支持流式编辑
      if (provider.editWebsiteStream) {
        await provider.editWebsiteStream(website.content, instructions, (chunk: string) => {
          // console.log('📤 发送编辑数据块:', chunk);
          newContent += chunk;
          res.write(`data: ${JSON.stringify({ type: 'content_chunk', content: chunk, fullContent: newContent })}\n\n`);
        }, userId, customPrompt, model);
      } else {
        // 如果不支持流式，降级为普通编辑然后分块发送
        newContent = await provider.editWebsite(website.content, instructions, userId, customPrompt, model);
        
        // 模拟流式发送
        const chunks = newContent.match(/.{1,100}/g) || [newContent];
        for (let i = 0; i < chunks.length; i++) {
          setTimeout(() => {
            res.write(`data: ${JSON.stringify({ 
              type: 'content_chunk', 
              content: chunks[i],
              fullContent: newContent.slice(0, chunks.slice(0, i + 1).join('').length)
            })}\n\n`);
          }, i * 100);
        }
      }

      // 保存到数据库
      const updatedWebsite = await prisma.website.update({
        where: { id: websiteId },
        data: { content: newContent, updatedAt: new Date() },
      });

      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        website: updatedWebsite,
        content: newContent
      })}\n\n`);
      res.end();

    } catch (error: any) {
      logger.error('Stream edit website error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || '编辑网站失败' })}\n\n`);
      res.end();
    }
  } catch (error) {
    logger.error('Edit stream setup error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to setup stream editing' 
    });
  }
});

// AI Mode Detection - 智能模式检测
router.post('/detect-mode', authenticate, async (req: any, res: Response) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const userId = req.user!.id;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // 简单的模式检测逻辑
    const detectMode = (msg: string): { mode: string; confidence: number; reasoning: string } => {
      const normalizedMsg = msg.toLowerCase();
      const scores = { generate: 0, edit: 0, chat: 0 };

      // 生成模式关键词检测
      const generateKeywords = ['创建', '生成', '制作', '建立', '构建', '开发', '做一个', '新建', 'create', 'build', 'generate', 'make'];
      generateKeywords.forEach(keyword => {
        if (normalizedMsg.includes(keyword)) scores.generate += 1;
      });

      // 编辑模式关键词检测
      const editKeywords = ['修改', '编辑', '更改', '调整', '优化', '完善', '更新', '修复', 'edit', 'modify', 'change', 'update', 'fix'];
      editKeywords.forEach(keyword => {
        if (normalizedMsg.includes(keyword)) scores.edit += 1;
      });

      // 对话模式关键词检测
      const chatKeywords = ['什么', '如何', '怎么', '为什么', '能否', '可以', '帮助', '建议', '咨询', 'what', 'how', 'why', 'help'];
      chatKeywords.forEach(keyword => {
        if (normalizedMsg.includes(keyword)) scores.chat += 1;
      });

      // 网站相关内容检测
      if (normalizedMsg.includes('网站') || normalizedMsg.includes('页面') || normalizedMsg.includes('website')) {
        if (scores.edit > 0) scores.edit += 1;
        else if (scores.generate > 0) scores.generate += 1;
      }

      // 问号检测
      if (normalizedMsg.includes('?') || normalizedMsg.includes('？')) {
        scores.chat += 0.5;
      }

      // 确定最高得分的模式
      const maxScore = Math.max(scores.generate, scores.edit, scores.chat);
      const totalScore = scores.generate + scores.edit + scores.chat;
      
      let detectedMode = 'chat'; // 默认对话模式
      if (scores.generate === maxScore && maxScore > 0) detectedMode = 'generate';
      else if (scores.edit === maxScore && maxScore > 0) detectedMode = 'edit';
      
      const confidence = totalScore > 0 ? maxScore / totalScore : 0.33;

      // 生成推理说明
      let reasoning = `检测到${detectedMode === 'generate' ? '生成' : detectedMode === 'edit' ? '编辑' : '对话'}意图`;
      if (maxScore > 0) {
        reasoning += `，置信度 ${Math.round(confidence * 100)}%`;
      }

      return { mode: detectedMode, confidence, reasoning };
    };

    const result = detectMode(message);

    res.json({
      success: true,
      data: {
        message,
        detectedMode: result.mode,
        confidence: result.confidence,
        reasoning: result.reasoning,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Mode detection error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to detect mode' 
    });
  }
});

export default router;
async function persistWebsiteContent(
  websiteId: string,
  userId: string,
  pages: Array<{ slug: string; html: string }> | undefined,
  fallbackHtml: string,
  requestId?: string,
) {
  const effectivePages = Array.isArray(pages) && pages.length > 0
    ? pages
    : [{ slug: 'index', html: fallbackHtml }];

  const assetResult = await persistWebsiteAssets(websiteId, effectivePages, { requestId });
  const mainHtml = assetResult.pages[0]?.html ?? fallbackHtml;

  const website = await prisma.website.update({
    where: { id: websiteId },
    data: {
      content: mainHtml,
      html: mainHtml,
      css: null,
      js: null,
      updatedAt: new Date(),
    },
  });

  const publicPages = assetResult.pages.map((page) => ({
    slug: page.slug,
    html: page.html,
    publicPath: page.publicPath,
  }));

  return { website, pages: publicPages, mainHtml };
}
