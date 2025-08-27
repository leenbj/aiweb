import { Response } from 'express';
import { logger } from '../utils/logger';
import { aiService } from './ai';

/**
 * AI聊天服务 - 专门处理实时流式对话
 */
export class AIChatService {
  /**
   * 处理流式聊天请求
   */
  async handleStreamChat(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>,
    userId: string,
    response: Response
  ): Promise<void> {
    try {
      // 设置SSE头
      this.setupSSEHeaders(response);
      
      // 发送连接确认
      this.sendSSEEvent(response, 'connected', { status: 'ready' });
      
      // 获取用户的AI设置
      const { provider, settings } = await aiService.getUserProvider(userId);
      const model = aiService.getModelFromSettings(settings);
      
      // 构建消息数组 - 不添加系统提示词，因为provider.chatStream会处理
      const messages = this.buildMessageArray(message, conversationHistory);
      
      logger.info('开始AI流式聊天', {
        userId,
        messageLength: message.length,
        provider: provider.constructor.name,
        model,
        hasSystemPrompt: !!settings?.systemPrompt
      });

      // 流式响应变量
      let fullResponse = '';
      let chunkCount = 0;
      const startTime = Date.now();
      let lastActivityTime = Date.now();

      // 设置心跳检测，防止连接超时 - 遵循SSE最佳实践
      const heartbeatInterval = setInterval(() => {
        try {
          if (response.destroyed || response.closed) {
            clearInterval(heartbeatInterval);
            return;
          }
          if (Date.now() - lastActivityTime > 25000) { // 25秒无活动发送心跳
            this.sendSSEEvent(response, 'heartbeat', { timestamp: Date.now() });
            lastActivityTime = Date.now();
          }
        } catch (error) {
          logger.debug('心跳发送失败:', error);
          clearInterval(heartbeatInterval);
        }
      }, 8000); // 桅8秒检查一次，确保及时处理

      // 监听客户端断开连接
      response.on('close', () => {
        clearInterval(heartbeatInterval);
        logger.info('客户端断开连接', { userId, duration: Date.now() - startTime });
      });

      response.on('error', (error) => {
        clearInterval(heartbeatInterval);
        logger.error('响应流错误:', error);
      });

      try {
        // 处理流式响应
        if (provider.chatStream) {
          await provider.chatStream(
            messages,
            (chunk: string) => {
              chunkCount++;
              fullResponse += chunk;
              lastActivityTime = Date.now(); // 更新活动时间
              
              // 发送数据块
              this.sendSSEEvent(response, 'chunk', {
                content: chunk,
                fullContent: fullResponse,
                chunkIndex: chunkCount,
                timestamp: lastActivityTime
              });
              
              logger.debug(`发送数据块 ${chunkCount}:`, {
                chunkLength: chunk.length,
                totalLength: fullResponse.length
              });
            },
            userId,
            settings?.systemPrompt, // 传递用户的系统提示词
            model
          );
        } else {
          // 降级到普通聊天
          if (provider.chat) {
            const result = await provider.chat(messages, userId, settings?.systemPrompt, model);
            this.sendSSEEvent(response, 'complete', { content: result });
          } else {
            throw new Error('No chat method available');
          }
        }

        // 清理心跳定时器
        clearInterval(heartbeatInterval);

        // 发送完成信号
        const endTime = Date.now();
        this.sendSSEEvent(response, 'done', {
          totalChunks: chunkCount,
          totalCharacters: fullResponse.length,
          duration: endTime - startTime,
          timestamp: endTime
        });

        logger.info('AI流式聊天完成', {
          userId,
          chunks: chunkCount,
          characters: fullResponse.length,
          duration: endTime - startTime
        });

      } catch (innerError: any) {
        clearInterval(heartbeatInterval);
        logger.error('AI流式处理内部错误:', innerError);
        this.sendSSEEvent(response, 'error', {
          message: innerError.message || 'AI处理错误',
          timestamp: Date.now()
        });
      }

    } catch (error: any) {
      logger.error('AI流式聊天错误:', error);
      this.sendSSEEvent(response, 'error', {
        message: error.message || 'AI聊天服务错误',
        timestamp: Date.now()
      });
    } finally {
      // 确保连接关闭
      response.end();
    }
  }

  /**
   * 设置Server-Sent Events头
   */
  private setupSSEHeaders(response: Response): void {
    // 基于Better SSE最佳实践的SSE头配置
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Authorization, Last-Event-ID',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'X-Accel-Buffering': 'no', // 禁用Nginx缓冲
      'Transfer-Encoding': 'chunked', // 启用分块传输
      'Keep-Alive': 'timeout=300, max=1000', // 保持连接5分钟
    });

    // 发送初始连接确认事件
    const initEvent = {
      event: 'connected',
      data: { status: 'ready', timestamp: Date.now() },
      id: Date.now().toString()
    };
    const formatted = `event: connected\ndata: ${JSON.stringify(initEvent)}\nid: ${initEvent.id}\n\n`;
    response.write(formatted);
  }

  /**
   * 发送SSE事件
   */
  private sendSSEEvent(response: Response, event: string, data: any): void {
    try {
      // 检查连接是否仍然活跃
      if (response.destroyed || response.closed) {
        logger.debug('连接已关闭，跳过数据发送');
        return;
      }

      const sseData = {
        event,
        data,
        id: Date.now().toString(),
        timestamp: Date.now()
      };

      const formatted = `event: ${event}\ndata: ${JSON.stringify(sseData)}\nid: ${sseData.id}\n\n`;
      
      // 强制刷新缓冲区
      response.write(formatted);
      
      // 如果支持flush，立即刷新
      if (typeof response.flush === 'function') {
        response.flush();
      }
      
    } catch (error: any) {
      logger.error('发送SSE事件失败:', error);
      throw error;
    }
  }

  /**
   * 构建消息数组 - 简化版，不添加系统提示词
   */
  private buildMessageArray(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>
  ): Array<{ role: 'user' | 'system' | 'assistant'; content: string }> {
    
    return [
      ...conversationHistory,
      { role: 'user', content: message }
    ];
  }

  /**
   * 验证聊天输入
   */
  validateChatInput(message: string, conversationHistory: any[]): { valid: boolean; error?: string } {
    if (!message || typeof message !== 'string') {
      return { valid: false, error: '消息内容不能为空' };
    }

    if (message.trim().length === 0) {
      return { valid: false, error: '消息内容不能为空' };
    }

    if (message.length > 4000) {
      return { valid: false, error: '消息内容过长，请限制在4000字符以内' };
    }

    if (!Array.isArray(conversationHistory)) {
      return { valid: false, error: '对话历史格式错误' };
    }

    if (conversationHistory.length > 50) {
      return { valid: false, error: '对话历史过长，请刷新页面开始新的对话' };
    }

    return { valid: true };
  }
}

export const aiChatService = new AIChatService();
