import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { aiService, extractPureHtmlFromResponse } from '../services/ai';
import { prisma } from '../database';
import { logger } from '../utils/logger';
import { getDefaultPrompt, PromptType } from '../constants/prompts';
import { config } from '../config';

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
router.post('/generate', authenticate, async (req: any, res: Response) => {
  try {
    const { prompt, websiteId, conversationId } = req.body;
    const userId = req.user!.id;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    // Generate website content (aiService internal will handle user settings)
    const result = await aiService.generateWebsite(prompt, userId);

    // 兼容旧的响应格式（字符串）和新的格式（对象）
    let content: string;
    let aiReply: string;
    
    if (typeof result === 'string') {
      // 旧格式兼容
      content = result;
      aiReply = '我已经为您创建了一个响应式网站，希望您会喜欢！';
    } else {
      // 新格式
      content = result.html;
      aiReply = result.reply;
    }

    // 检查生成的内容是否有效
    if (!content || content.trim() === '') {
      throw new Error('AI服务未能生成有效的网站内容，请重试');
    }

    let website;
    if (websiteId) {
      // Update existing website
      website = await prisma.website.update({
        where: { id: websiteId, userId },
        data: { content, updatedAt: new Date() },
      });
    } else {
      // Create new website
      website = await prisma.website.create({
        data: {
          userId,
          domain: `temp-${Date.now()}.example.com`,
          title: 'AI Generated Website',
          content,
          status: 'draft',
        },
      });
    }

    // Save conversation if provided
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
              content,
            },
          ],
        },
      });
    }

    res.json({
      success: true,
      data: {
        website,
        content,
        reply: aiReply,
      },
    });
  } catch (error: any) {
    logger.error('Generate website error:', error);
    
    // 提取具体错误消息并传递给前端
    let errorMessage = 'Failed to generate website';
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

// Edit website with AI
router.post('/edit', authenticate, async (req: any, res: Response) => {
  try {
    const { websiteId, instructions, conversationId } = req.body;
    const userId = req.user!.id;

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

    // Update website
    const updatedWebsite = await prisma.website.update({
      where: { id: websiteId },
      data: { content: newContent, updatedAt: new Date() },
    });

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
              content: newContent,
            },
          ],
        },
      });
    }

    res.json({
      success: true,
      data: {
        website: updatedWebsite,
        content: newContent,
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

    // Update website
    const updatedWebsite = await prisma.website.update({
      where: { id: websiteId },
      data: { content: optimizedContent, updatedAt: new Date() },
    });

    res.json({
      success: true,
      data: {
        website: updatedWebsite,
        content: optimizedContent,
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

    // 设置SSE响应头（尽量减少缓冲和代理延迟）
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Authorization, Last-Event-ID',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'X-Accel-Buffering': 'no',
      'Transfer-Encoding': 'chunked',
      'Keep-Alive': 'timeout=300, max=1000',
    });

    // 立即刷新首包
    // @ts-ignore
    if (typeof (res as any).flushHeaders === 'function') {
      // @ts-ignore
      (res as any).flushHeaders();
    }

    const writeSSE = (payload: any) => {
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        // @ts-ignore – 如果可用，强制刷新
        if (typeof (res as any).flush === 'function') {
          // @ts-ignore
          (res as any).flush();
        }
      } catch (e) {
        logger.error('SSE write error:', e);
      }
    };

    // 连接确认，前端可立即更新UI（减少首字节等待感）
    writeSSE({ event: 'connected', type: 'connected', timestamp: Date.now() });

    // 根据模式获取用户的提示词
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

    // 心跳，避免长时间无数据被代理关闭，并为前端提供存活信号
    const heartbeat = setInterval(() => {
      writeSSE({ event: 'heartbeat', type: 'heartbeat', timestamp: Date.now() });
    }, 10000);

    // 断开/错误时清理
    res.on('close', () => {
      clearInterval(heartbeat);
    });
    res.on('error', () => {
      clearInterval(heartbeat);
    });

    try {

      if (userId) {
        const { provider, settings } = await aiService.getUserProvider(userId);
        const customPrompt = settings?.systemPrompt;
        const model = aiService.getModelFromSettings(settings);
        

        
        if (provider.chatStream) {

          await provider.chatStream(
            messages,
            (chunk: string) => {
              writeSSE({
                event: 'chunk',
                type: 'chunk',
                content: chunk,
                mode: mode,
                hasCustomPrompt: !!systemPrompt,
                timestamp: Date.now(),
              });
            },
            userId,
            customPrompt,
            model
          );
        } else if (provider.chat) {
          // 如果不支持流式，降级为普通chat
          const result = await provider.chat(messages, userId, customPrompt, model);
          writeSSE({ event: 'complete', type: 'complete', content: result });
        } else {
          throw new Error('Provider does not support chat or chatStream');
        }
      } else {
        if (aiService.provider.chatStream) {
          await aiService.provider.chatStream(messages, (chunk: string) => {
            writeSSE({ event: 'chunk', type: 'chunk', content: chunk, timestamp: Date.now() });
          });
        } else if (aiService.provider.chat) {
          const result = await aiService.provider.chat(messages);
          writeSSE({ event: 'complete', type: 'complete', content: result });
        } else {
          throw new Error('Default provider does not support chat or chatStream');
        }
      }
      
      writeSSE({ event: 'done', type: 'done' });
      res.end();
      
    } catch (error: any) {
      logger.error('Failed to chat stream with AI:', error);
      writeSSE({ event: 'error', type: 'error', error: error.message || 'AI聊天失败' });
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

    // 构建对话消息数组
    const messages = [
      {
        role: 'system' as const,
        content: `你是一个专业的网站需求分析师和AI助手。你的任务是与用户进行友好对话，了解他们的网站需求。

对话原则：
1. 友好、专业、有帮助
2. 逐步引导用户提供网站需求信息
3. 询问关键信息：网站类型、功能需求、设计风格、目标用户等
4. 当收集到足够信息时，总结需求并询问是否开始生成
5. 不要直接生成代码，只负责需求收集和确认

请根据用户消息进行自然对话。`
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
router.post('/generate-stream', authenticate, async (req: any, res: Response) => {
  try {
    const { prompt, websiteId } = req.body;
    const userId = req.user!.id;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    let fullHtml = '';
    let aiReply = '';

    try {


      if (userId) {
        const { provider, settings } = await aiService.getUserProvider(userId);
        // 修复：使用生成模式专用的提示词，而不是通用系统提示词
        const customPrompt = settings?.generatePrompt || settings?.systemPrompt;
        const model = aiService.getModelFromSettings(settings);

        // 🔥 关键调试：确认实际使用的provider
        // console.log('🔍 实际使用的Provider信息:', {
        //   providerType: provider.constructor.name,
        //   hasStreamMethod: !!provider.generateWebsiteStream,
        //   userAiProvider: settings?.aiProvider || 'default',
        //   selectedModel: model,
        //   hasApiKey: !!(settings?.deepseekApiKey || settings?.openaiApiKey || settings?.anthropicApiKey)
        // });
        
        // 检查provider是否支持流式生成
        if (provider.generateWebsiteStream) {
          await provider.generateWebsiteStream(prompt, (chunk: any) => {
            const timestamp = new Date().toISOString();
            // console.log(`📤 [${timestamp}] 路由发送数据块:`, {
            //   type: chunk.type,
            //   contentLength: chunk.content?.length || 0,
            //   contentPreview: chunk.content?.substring(0, 30) || '',
            //   totalHtml: fullHtml.length,
            //   totalReply: aiReply.length
            // });
            
            if (chunk.type === 'html') {
              // 在累积到fullHtml之前，先验证内容是否为纯净HTML
              const pureHtml = extractPureHtmlFromResponse(chunk.content);
              if (pureHtml) {
                fullHtml += pureHtml;
                const responseData = { type: 'html_chunk', content: pureHtml, fullHtml };
                res.write(`data: ${JSON.stringify(responseData)}\n\n`);
                console.log(`📤 [${timestamp}] 纯净HTML块已写入响应流 (${pureHtml.length} chars)`);
              } else {
                console.log(`⏭️ [${timestamp}] 跳过非纯净HTML内容: ${chunk.content.substring(0, 50)}...`);
              }
            } else if (chunk.type === 'reply') {
              // 不累积reply内容到fullHtml，只记录
              console.log(`📝 [${timestamp}] Reply内容: ${chunk.content.substring(0, 50)}...`);
            }
          }, userId, customPrompt, model);
        } else {
          // 如果不支持流式，降级为普通生成然后分块发送
          const result = await provider.generateWebsite(prompt, userId, customPrompt, model);
          fullHtml = result.html;
          aiReply = result.reply;
          
          // 模拟流式发送，只发送HTML代码块，不发送描述性回复
          const chunks = fullHtml.match(/.{1,100}/g) || [fullHtml];
          for (let i = 0; i < chunks.length; i++) {
            setTimeout(() => {
              res.write(`data: ${JSON.stringify({
                type: 'html_chunk',
                content: chunks[i],
                fullHtml: fullHtml.slice(0, chunks.slice(0, i + 1).join('').length)
              })}\n\n`);
            }, i * 100);
          }

          // 不发送reply块给前端，避免在代码编辑器中显示描述文字
        }
      } else {
        throw new Error('User ID is required for streaming generation');
      }

      // 检查代码完整性，如果不完整则自动继续生成
      const checkCodeCompleteness = (code: string): { isComplete: boolean; missingParts: string[] } => {
        const missingParts: string[] = [];

        if (!code.includes('<!DOCTYPE html>')) missingParts.push('DOCTYPE声明');
        if (!code.includes('<html')) missingParts.push('html标签');
        if (!code.includes('<head')) missingParts.push('head标签');
        if (!code.includes('<body')) missingParts.push('body标签');
        if (!code.includes('</html>')) missingParts.push('html结束标签');
        if (!code.includes('</body>')) missingParts.push('body结束标签');
        if (!code.includes('</head>')) missingParts.push('head结束标签');

        // 检查是否有基本的样式或内容
        const hasBasicContent = code.includes('<h1') || code.includes('<div') ||
                               code.includes('<section') || code.includes('<p');
        if (!hasBasicContent) missingParts.push('基本内容');

        return {
          isComplete: missingParts.length === 0,
          missingParts
        };
      };

      const completeness = checkCodeCompleteness(fullHtml);

      if (!completeness.isComplete) {
        console.log('检测到代码不完整，尝试自动补全:', completeness.missingParts);

        try {
          // 使用AI生成缺失的部分
          const completionPrompt = `请补全以下不完整的HTML代码，缺失的部分包括：${completeness.missingParts.join('、')}

当前代码：
${fullHtml}

请提供完整的、可运行的HTML代码，不要添加任何解释。`;

          const completionResult = await aiService.generateWebsite(completionPrompt, userId);

          if (completionResult.html && completionResult.html.length > fullHtml.length) {
            fullHtml = completionResult.html;
            console.log('代码补全成功，新的代码长度:', fullHtml.length);
          }
        } catch (completionError) {
          console.warn('自动补全失败，使用原始代码:', completionError);
        }
      }

      // 保存到数据库
      let website;
      if (websiteId) {
        website = await prisma.website.update({
          where: { id: websiteId, userId },
          data: { content: fullHtml, updatedAt: new Date() },
        });
      } else {
        website = await prisma.website.create({
          data: {
            userId,
            domain: `temp-${Date.now()}.example.com`,
            title: 'AI Generated Website',
            content: fullHtml,
            status: 'draft',
          },
        });
      }

      res.write(`data: ${JSON.stringify({
        type: 'complete',
        website,
        content: fullHtml,
        reply: aiReply,
        autoCompleted: !completeness.isComplete
      })}\n\n`);
      res.end();

    } catch (error: any) {
      logger.error('Stream generate website error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || '生成网站失败' })}\n\n`);
      res.end();
    }
  } catch (error) {
    logger.error('Generate stream setup error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to setup stream generation' 
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
