import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { aiService } from '../services/ai';
import { prisma } from '../database';
import { logger } from '../utils/logger';
import { config } from '../config';

const router = Router();

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
    const { message, conversationHistory = [], stage, requirements } = req.body;
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

    try {
      console.log('🔄 开始处理聊天流请求', { userId, messageLength: message.length, stage, requirements });
      if (userId) {
        const { provider, settings } = await aiService.getUserProvider(userId);
        const customPrompt = settings?.systemPrompt;
        const model = aiService.getModelFromSettings(settings);
        
        console.log('📋 用户设置', { 
          provider: settings?.aiProvider, 
          model, 
          hasCustomPrompt: !!customPrompt,
          providerType: provider.constructor.name,
          hasChatStream: typeof provider.chatStream === 'function'
        });
        
        if (provider.chatStream) {
          console.log('🌊 使用流式聊天');
          await provider.chatStream(messages, (chunk: string) => {
            console.log('📤 发送数据块:', chunk);
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
          }, userId, customPrompt, model);
        } else if (provider.chat) {
          // 如果不支持流式，降级为普通chat
          const result = await provider.chat(messages, userId, customPrompt, model);
          res.write(`data: ${JSON.stringify({ type: 'complete', content: result })}\n\n`);
        } else {
          throw new Error('Provider does not support chat or chatStream');
        }
      } else {
        if (aiService.provider.chatStream) {
          await aiService.provider.chatStream(messages, (chunk: string) => {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
          });
        } else if (aiService.provider.chat) {
          const result = await aiService.provider.chat(messages);
          res.write(`data: ${JSON.stringify({ type: 'complete', content: result })}\n\n`);
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
      console.log('🌊 开始流式网站生成', { userId, promptLength: prompt.length, websiteId });
      
      if (userId) {
        const { provider, settings } = await aiService.getUserProvider(userId);
        const customPrompt = settings?.systemPrompt;
        const model = aiService.getModelFromSettings(settings);
        
        // 检查provider是否支持流式生成
        if (provider.generateWebsiteStream) {
          await provider.generateWebsiteStream(prompt, (chunk: any) => {
            console.log('📤 发送生成数据块:', chunk);
            if (chunk.type === 'html') {
              fullHtml += chunk.content;
              res.write(`data: ${JSON.stringify({ type: 'html_chunk', content: chunk.content, fullHtml })}\n\n`);
            } else if (chunk.type === 'reply') {
              aiReply = chunk.content;
              res.write(`data: ${JSON.stringify({ type: 'reply', content: chunk.content })}\n\n`);
            }
          }, userId, customPrompt, model);
        } else {
          // 如果不支持流式，降级为普通生成然后分块发送
          const result = await provider.generateWebsite(prompt, userId, customPrompt, model);
          fullHtml = result.html;
          aiReply = result.reply;
          
          // 模拟流式发送
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
          
          setTimeout(() => {
            res.write(`data: ${JSON.stringify({ type: 'reply', content: aiReply })}\n\n`);
          }, chunks.length * 100);
        }
      } else {
        throw new Error('User ID is required for streaming generation');
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
        reply: aiReply
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
      console.log('🌊 开始流式网站编辑', { userId, websiteId, instructionsLength: instructions.length });
      
      const { provider, settings } = await aiService.getUserProvider(userId);
      const customPrompt = settings?.systemPrompt;
      const model = aiService.getModelFromSettings(settings);
      
      // 检查provider是否支持流式编辑
      if (provider.editWebsiteStream) {
        await provider.editWebsiteStream(website.content, instructions, (chunk: string) => {
          console.log('📤 发送编辑数据块:', chunk);
          newContent += chunk;
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
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

export default router;