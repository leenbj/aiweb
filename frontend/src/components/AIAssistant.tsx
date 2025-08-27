import React, { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Send, Bot, User, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

// 消息类型定义
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  error?: boolean;
}

// SSE事件类型
interface SSEEvent {
  event: string;
  data: any;
  id: string;
  timestamp: number;
}

// 组件属性
interface AIAssistantProps {
  onCodeUpdate?: (code: string) => void;
  className?: string;
}

/**
 * AI助手组件 - 全新设计，专注于实时流式对话
 */
export default function AIAssistant({ className = '' }: AIAssistantProps) {
  // 状态管理
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error' | 'testing'>('testing');
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'end'
    });
  }, []);

  // 测试AI连接状态
  const testAIConnection = useCallback(async () => {
    try {
      setConnectionStatus('testing');
      
      // 使用健康检查端点测试连接 - 这个端点不需要认证
      const response = await fetch('/api/ai-chat/health', {
        method: 'GET',
        // 移除 Authorization header，因为健康检查端点不需要认证
      });
      
      if (response.ok) {
        const result = await response.json();
        setConnectionStatus(result.data?.status === 'healthy' ? 'connected' : 'disconnected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      console.error('连接测试失败:', error);
      setConnectionStatus('disconnected');
    }
  }, []); // 移除依赖，因为函数内部只使用setConnectionStatus

  // 清理连接
  const cleanupConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // 处理SSE连接
  const handleSSEConnection = useCallback(async (message: string) => {
    try {
      setIsConnecting(true);
      setConnectionStatus('connecting');
      
      // 清理之前的连接
      cleanupConnection();

      // 创建新的AbortController
      abortControllerRef.current = new AbortController();

      // 准备请求数据
      const requestData = {
        message,
        conversationHistory: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      };

      // 获取认证token
      const token = localStorage.getItem('auth-token');
      if (!token) {
        throw new Error('请先登录');
      }

      // 发起请求
      const response = await fetch('/api/ai-chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(requestData),
        signal: abortControllerRef.current.signal,
        // 禁用默认超时，让流式响应自然结束
        keepalive: true,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      setConnectionStatus('connected');

      // 创建助手消息
      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStreamingMessageId(assistantMessageId);

      // 读取流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          // 检查是否被取消
          if (abortControllerRef.current?.signal.aborted) {
            console.log('请求被取消，停止读取');
            break;
          }

          const { done, value } = await reader.read();
          
          if (done) {
            console.log('流式响应读取完成');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            if (line.startsWith('event:')) {
              // 处理事件类型
              continue;
            }
            
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;
                
                const eventData: SSEEvent = JSON.parse(jsonStr);
                await handleSSEEvent(eventData, assistantMessageId);
                
              } catch (parseError) {
                console.error('解析SSE数据错误:', parseError, line);
              }
            }
          }
        }
      } catch (readError) {
        if (readError.name !== 'AbortError') {
          console.error('读取流时出错:', readError);
          throw readError;
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error: any) {
      console.error('SSE连接错误:', error);
      
      if (error.name === 'AbortError') {
        console.log('请求被取消');
        return;
      }

      setConnectionStatus('error');
      
      // 显示错误消息
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `抱歉，连接出现问题：${error.message}`,
        timestamp: new Date(),
        error: true
      };

      setMessages(prev => [...prev, errorMessage]);
      toast.error('连接失败，请重试');

    } finally {
      setIsConnecting(false);
      setStreamingMessageId(null);
      setConnectionStatus('disconnected');
    }
  }, [messages, cleanupConnection]);

  // 处理SSE事件
  const handleSSEEvent = useCallback(async (event: SSEEvent, messageId: string) => {
    switch (event.event) {
      case 'init':
        console.log('AI助手初始化完成');
        setConnectionStatus('connected');
        break;

      case 'connected':
        console.log('AI助手已连接');
        setConnectionStatus('connected');
        break;

      case 'heartbeat':
        // 心跳信号，保持连接活跃
        console.log('收到心跳信号');
        break;

      case 'chunk':
        // 更新流式内容 - 使用React 18的flushSync强制立即更新
        const chunkContent = event.data.content;
        const fullContent = event.data.fullContent;
        
        // 使用React 18的flushSync确保立即更新
        flushSync(() => {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: fullContent || msg.content + chunkContent }
              : msg
          ));
        });
        
        // 立即滚动到底部
        requestAnimationFrame(() => {
          scrollToBottom();
        });
        break;

      case 'done':
        console.log('AI响应完成:', event.data);
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, isStreaming: false }
            : msg
        ));
        setStreamingMessageId(null);
        break;

      case 'error':
        console.error('AI响应错误:', event.data);
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: `错误：${event.data.message}`, error: true, isStreaming: false }
            : msg
        ));
        setStreamingMessageId(null);
        toast.error(event.data.message);
        break;
    }
  }, [scrollToBottom]);

  // 发送消息
  const handleSendMessage = useCallback(async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isConnecting) return;

    // 创建用户消息
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    // 聚焦输入框
    setTimeout(() => inputRef.current?.focus(), 0);

    // 启动SSE连接
    await handleSSEConnection(trimmedInput);
  }, [inputValue, isConnecting, handleSSEConnection]);

  // 键盘事件处理
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // 清除对话
  const handleClearConversation = useCallback(() => {
    cleanupConnection();
    setMessages([]);
    setStreamingMessageId(null);
    setConnectionStatus('disconnected');
    inputRef.current?.focus();
  }, [cleanupConnection]);

  // 组件初始化时测试连接
  useEffect(() => {
    testAIConnection();
  }, []); // 只在组件挂载时执行一次

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanupConnection();
    };
  }, [cleanupConnection]);

  // 自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className={`flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-full">
            <Bot className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI助手</h3>
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500' :
                connectionStatus === 'testing' ? 'bg-yellow-500 animate-pulse' :
                connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
              }`} />
              <span className="text-gray-600">
                {connectionStatus === 'connected' ? '创建模式' :
                 connectionStatus === 'connecting' ? '生成中...' :
                 connectionStatus === 'testing' ? '连接中...' :
                 connectionStatus === 'error' ? '连接错误' : '未连接'}
              </span>
            </div>
          </div>
        </div>
        
        {/* 重连按钮 - 只在断开或错误时显示 */}
        {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
          <button
            onClick={testAIConnection}
            disabled={connectionStatus === 'testing'}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${connectionStatus === 'testing' ? 'animate-spin' : ''}`} />
            重新连接
          </button>
        )}
        
        <button
          onClick={handleClearConversation}
          disabled={isConnecting}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="清除对话"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 flex-shrink-0 p-2 bg-blue-100 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
              )}
              
              <div className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.error
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <div className="text-sm whitespace-pre-wrap">
                  {message.content}
                  {message.isStreaming && streamingMessageId === message.id && (
                    <span className="inline-block w-2 h-4 bg-blue-600 ml-1 animate-pulse rounded-sm" />
                  )}
                </div>
                <div className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 flex-shrink-0 p-2 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 思考指示器只在没有流式消息时显示 */}
        {isConnecting && !streamingMessageId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 flex-shrink-0 p-2 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            </div>
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="text-sm text-gray-600">AI正在思考...</div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            disabled={isConnecting}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isConnecting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
