import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Send, Bot, User, Loader2, RefreshCw, Settings, MessageCircle, Code, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

// AI模式类型
export type AIMode = 'chat' | 'generate' | 'edit';

// 模式配置
const AI_MODES = {
  chat: {
    name: '对话模式',
    description: '智能对话交流，自动判断意图',
    icon: MessageCircle,
    color: 'bg-blue-500',
    placeholder: '💬 有什么问题或需要帮助的吗？'
  },
  generate: {
    name: '生成模式',
    description: '生成网站、代码和创意内容',
    icon: Code,
    color: 'bg-green-500',
    placeholder: '🚀 描述您想要生成的网站或代码...'
  },
  edit: {
    name: '编辑模式',
    description: '修改和优化现有代码',
    icon: Edit3,
    color: 'bg-purple-500',
    placeholder: '✏️ 描述您想要修改的内容...'
  }
} as const;

// 用户设置类型
interface UserSettings {
  aiProvider?: string;
  aiModel?: string;
  chatPrompt?: string;
  generatePrompt?: string;
  editPrompt?: string;
}

// 消息类型定义
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  error?: boolean;
  mode?: AIMode;
}

// SSE事件类型
interface SSEEvent {
  event: string;
  data: any;
  id: string;
  timestamp: number;
}

/**
 * 严格过滤函数：从任意内容中提取纯净的HTML代码
 * @param content 任意内容（可能包含JSON、描述文字等）
 * @returns 纯净的HTML代码或null
 */
function extractPureHtml(content: string): string | null {
  if (!content || typeof content !== 'string') {
    return null;
  }

  let cleanContent = content.trim();

  // 1. 尝试从JSON中提取HTML字段
  if (cleanContent.startsWith('{') && cleanContent.includes('"html"')) {
    try {
      const parsed = JSON.parse(cleanContent);
      if (parsed.html && typeof parsed.html === 'string') {
        cleanContent = parsed.html.trim();
      } else {
        return null; // 无效的JSON格式
      }
    } catch (error) {
      // JSON解析失败，继续处理原始内容
    }
  }

  // 2. 移除任何markdown代码块包装
  if (cleanContent.startsWith('```') && cleanContent.includes('```')) {
    const codeBlockRegex = /```(?:html)?\n?([\s\S]*?)```/;
    const match = cleanContent.match(codeBlockRegex);
    if (match) {
      cleanContent = match[1].trim();
    }
  }

  // 3. 移除任何描述性文字（增强版模式匹配）
  const descriptionPatterns = [
    /^我.*?(?:创建|生成|为您制作).*?网站.*?:?\s*/i,
    /^我已经.*?(?:创建|生成|完成).*?\.?\s*/i,
    /^这是一个.*?(?:网站|网页).*?\.?\s*/i,
    /^以下是.*?(?:代码|HTML).*?:?\s*/i,
    /^Here is.*?website.*?code:?\s*/i,
    /^I've created.*?website.*?for you:?\s*/i,
    /^生成.*?HTML.*?代码:?\s*/i,
    /^网站.*?代码.*?如下:?\s*/i,
    /^HTML.*?代码:?\s*/i,
    /^以下是.*?生成的.*?代码:?\s*/i
  ];

  for (const pattern of descriptionPatterns) {
    cleanContent = cleanContent.replace(pattern, '');
  }

  // 4. 移除其他可能的干扰内容
  const interferencePatterns = [
    /^\s*```html\s*$/m,  // 开头的markdown代码块标记
    /^\s*```\s*$/m,      // 结尾的markdown代码块标记
    /^\s*<pre[^>]*>.*?<\/pre>\s*$/m, // pre标签包装
    /^\s*<code[^>]*>.*?<\/code>\s*$/m, // code标签包装
    /^\s*HTML代码：\s*/i,
    /^\s*网页代码：\s*/i,
    /^\s*网站代码：\s*/i
  ];

  for (const pattern of interferencePatterns) {
    cleanContent = cleanContent.replace(pattern, '');
  }

  // 5. 移除多余的空白和换行
  cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim();

  // 6. 过滤不完整的标签序列（如<html<head<body）
  const incompleteTagPatterns = [
    /^<html<head<body.*$/,  // 开头就是不完整的标签序列
    /^<html<head.*$/,       // 不完整的html+head序列
    /^<head<body.*$/,       // 不完整的head+body序列
    /^<html<body.*$/,       // 不完整的html+body序列
    /^<[^>]+<[^>]+<[^>]+.*$/, // 连续多个不完整的开始标签
    /^<html[^>]*>[^<]*<html[^>]*>/, // 重复的html标签
    /^<head[^>]*>[^<]*<head[^>]*>/, // 重复的head标签
    /^<body[^>]*>[^<]*<body[^>]*>/, // 重复的body标签
  ];

  for (const pattern of incompleteTagPatterns) {
    if (pattern.test(cleanContent)) {
      console.log('过滤掉不完整的或重复的标签序列:', cleanContent.substring(0, 50) + '...');
      return null;
    }
  }

  // 7. 检查是否有重复的开始标签
  const duplicateStartTags = [
    /<html[^>]*>.*<html[^>]*>/,  // 重复的html标签
    /<head[^>]*>.*<head[^>]*>/,  // 重复的head标签
    /<body[^>]*>.*<body[^>]*>/,  // 重复的body标签
  ];

  for (const pattern of duplicateStartTags) {
    if (pattern.test(cleanContent)) {
      console.log('过滤掉重复的开始标签:', cleanContent.substring(0, 50) + '...');
      return null;
    }
  }

  // 8. 验证是否是有效的HTML代码
  const isValidHtml = (
    cleanContent.includes('<!DOCTYPE html>') ||
    cleanContent.includes('<html') ||
    (cleanContent.includes('<') && cleanContent.includes('>') &&
     (cleanContent.includes('<head') || cleanContent.includes('<body') ||
      cleanContent.includes('<div') || cleanContent.includes('<section')))
  );

  // 9. 确保内容长度合理且包含HTML标签
  const hasHtmlTags = /<[^>]+>/.test(cleanContent);
  const isReasonableLength = cleanContent.length > 20 && cleanContent.length < 50000;

  // 10. 确保HTML结构基本完整
  const hasBasicStructure = (
    cleanContent.includes('<html') || // 有html标签，或者
    (cleanContent.includes('<head') && cleanContent.includes('<body')) // 既有head又有body
  );

  // 11. 严格验证标准HTML文档格式
  const isStandardHtmlDocument = (
    cleanContent.startsWith('<!DOCTYPE html>') && // 必须以DOCTYPE开头
    cleanContent.includes('<html lang="zh-CN"') && // 必须包含中文html标签
    cleanContent.includes('</html>') && // 必须以</html>结束
    !cleanContent.includes('<html') || cleanContent.indexOf('<html lang="zh-CN"') === cleanContent.indexOf('<!DOCTYPE html>') + '<!DOCTYPE html>'.length // html标签必须紧跟DOCTYPE
  );

  if (isStandardHtmlDocument) {
    console.log('✅ 标准HTML文档验证通过');
    return cleanContent;
  }

  // 12. 如果不是标准格式，尝试标准化
  if (isValidHtml && hasHtmlTags && isReasonableLength && hasBasicStructure) {
    const standardizedHtml = standardizeHtmlDocument(cleanContent);
    if (standardizedHtml) {
      console.log('🔄 HTML文档已标准化');
      return standardizedHtml;
    }
  }

  return null; // 不是有效的HTML代码
}

/**
 * 将不标准的HTML文档标准化为标准格式
 * @param content HTML内容
 * @returns 标准化的HTML文档或null
 */
function standardizeHtmlDocument(content: string): string | null {
  if (!content || typeof content !== 'string') {
    return null;
  }

  let html = content.trim();

  // 1. 移除DOCTYPE前的任何内容
  const doctypeIndex = html.indexOf('<!DOCTYPE html>');
  if (doctypeIndex > 0) {
    html = html.substring(doctypeIndex);
  } else if (doctypeIndex === -1) {
    // 如果没有DOCTYPE，添加一个
    html = '<!DOCTYPE html>\n' + html;
  }

  // 2. 确保DOCTYPE后紧跟html标签
  const afterDoctype = html.substring('<!DOCTYPE html>'.length).trim();
  if (!afterDoctype.startsWith('<html')) {
    // 如果DOCTYPE后不是html标签，添加标准html标签
    html = html.replace(/<!DOCTYPE html>\s*/, '<!DOCTYPE html>\n<html lang="zh-CN">\n');
  } else {
    // 确保html标签包含正确的lang属性
    html = html.replace(/<html[^>]*>/, '<html lang="zh-CN">');
  }

  // 3. 确保文档以</html>结束
  if (!html.endsWith('</html>')) {
    // 如果没有</html>，添加一个
    html = html.trim() + '\n</html>';
  }

  // 4. 验证标准化后的文档
  const isValidStandard = (
    html.startsWith('<!DOCTYPE html>') &&
    html.includes('<html lang="zh-CN"') &&
    html.endsWith('</html>')
  );

  if (isValidStandard) {
    return html;
  }

  return null;
}

// 组件属性
interface AIAssistantProps {
  onCodeUpdate?: (code: string) => void;
  onGenerationStart?: () => void;
  onGenerationEnd?: () => void;
  className?: string;
}

/**
 * AI助手组件 - 全新设计，专注于实时流式对话
 */
export default function AIAssistant({ onCodeUpdate, onGenerationStart, onGenerationEnd, className = '' }: AIAssistantProps) {
  // 状态管理
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'testing';
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('testing');
  const [currentMode, setCurrentMode] = useState<AIMode>('chat');
  const [userSettings, setUserSettings] = useState<UserSettings>({});
  const [showModeSelector, setShowModeSelector] = useState(false);

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

  // 获取当前模式配置
  const currentModeConfig = useMemo(() => AI_MODES[currentMode], [currentMode]);





  // 自动判断对话模式
  const detectModeFromMessage = useCallback((message: string): AIMode => {
    const lowerMessage = message.toLowerCase();

    // 编辑模式关键词
    const editKeywords = [
      '修改', '编辑', '更新', '优化', '改进', '修复', '改', '优化',
      'change', 'edit', 'update', 'optimize', 'improve', 'fix',
      '修改代码', '编辑代码', '更新代码', '优化代码', '改进代码', '修复代码'
    ];

    // 生成模式关键词
    const generateKeywords = [
      '创建', '生成', '新建', '制作', '开发', '设计', '构建', '写',
      'create', 'generate', 'make', 'build', 'write', 'design',
      '创建网站', '生成代码', '新建项目', '制作页面', '开发应用'
    ];

    // 检查是否包含编辑关键词
    if (editKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'edit';
    }

    // 检查是否包含生成关键词
    if (generateKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'generate';
    }

    // 默认为对话模式
    return 'chat';
  }, []);

  // 处理模式切换
  const handleModeChange = useCallback((newMode: AIMode) => {
    setCurrentMode(newMode);
    setShowModeSelector(false);
    toast.success(`已切换到${AI_MODES[newMode].name}`);
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
  const handleSSEConnection = useCallback(async (message: string, mode: AIMode = 'chat') => {
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
        mode,
        conversationHistory: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        customPrompt: userSettings[`${mode}Prompt`]
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
      } catch (readError: any) {
        if (readError?.name !== 'AbortError') {
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
        // 更新流式内容
        const chunkContent = event.data.content;
        const fullContent = event.data.fullContent;

        // 同时更新代码编辑器和对话框（适用于所有模式）
        if (onCodeUpdate && fullContent) {
          onCodeUpdate(fullContent);
        }

        // 在对话框中显示流式内容
        if (messageId) {
          flushSync(() => {
            setMessages(prev => prev.map(msg =>
              msg.id === messageId
                ? { ...msg, content: fullContent || msg.content + chunkContent }
                : msg
            ));
          });

          requestAnimationFrame(() => {
            scrollToBottom();
          });
        }
        break;

      case 'done':
        console.log('AI响应完成:', event.data);
        if (messageId) {
          setMessages(prev => prev.map(msg =>
            msg.id === messageId
              ? { ...msg, isStreaming: false }
              : msg
          ));
          // 延迟清理streamingMessageId，避免竞态条件
          setTimeout(() => {
        setStreamingMessageId(null);
          }, 100);
        }
        break;

      case 'error':
        console.error('AI响应错误:', event.data);
        if (messageId) {
          setMessages(prev => prev.map(msg =>
            msg.id === messageId
              ? { ...msg, content: `错误：${event.data.message}`, error: true, isStreaming: false }
              : msg
          ));
          // 延迟清理streamingMessageId
          setTimeout(() => {
        setStreamingMessageId(null);
          }, 100);
        }
        toast.error(event.data.message);
        break;
    }
  }, [scrollToBottom, currentMode, onCodeUpdate]);

  // 处理流式生成事件（用于直接流式生成，保持与对话模式一致）
  const handleStreamEvent = useCallback(async (eventData: any, messageId?: string) => {
    try {
      // 模拟对话模式的SSE事件格式
      const simulatedEvent: SSEEvent = {
        id: `event-${Date.now()}`,
        event: 'chunk',
        timestamp: Date.now(),
        data: {
          content: eventData.content || '',
          fullContent: eventData.content || ''
        }
      };

      // 使用对话模式的处理逻辑
      await handleSSEEvent(simulatedEvent, messageId || '');
    } catch (error) {
      console.error('处理流式事件错误:', error);
    }
  }, [handleSSEEvent]);

  // 处理生成连接
  const handleGenerateConnection = useCallback(async (prompt: string) => {
    try {
      setIsConnecting(true);
      setConnectionStatus('connecting');

      // 通知父组件生成开始
      onGenerationStart?.();

      // 清理之前的连接
      cleanupConnection();

      // 创建新的AbortController
      abortControllerRef.current = new AbortController();

      // 获取认证token
      const token = localStorage.getItem('auth-token');
      if (!token) {
        throw new Error('请先登录');
      }

      // 发起生成请求
      const response = await fetch('/api/ai/generate-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          prompt,
          mode: 'generate',
          customPrompt: userSettings.generatePrompt
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      setConnectionStatus('connected');

      // 创建助手消息（用于在对话框中显示流式内容）
      const assistantMessageId = `assistant-generate-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
        mode: 'generate'
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

            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;

                const eventData = JSON.parse(jsonStr);
                await handleStreamEvent(eventData, assistantMessageId);

              } catch (parseError) {
                console.error('解析SSE数据错误:', parseError, line);
              }
            }
          }
        }

      } catch (readError: any) {
        if (readError?.name !== 'AbortError') {
          console.error('读取流时出错:', readError);
          throw readError;
        } else {
          console.log('读取被中断');
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error: any) {
      console.error('生成连接失败:', error);
      setConnectionStatus('error');

      // 添加错误消息到对话框
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `生成失败：${error.message}`,
        timestamp: new Date(),
        error: true
      };

      setMessages(prev => [...prev, errorMessage]);
      toast.error(error.message);

      // 通知父组件生成结束（即使出错）
      onGenerationEnd?.();
    } finally {
      setIsConnecting(false);
      setStreamingMessageId(null);
    }
  }, [cleanupConnection, userSettings.generatePrompt, handleStreamEvent, onGenerationStart, onGenerationEnd]);

  // 处理编辑连接
  const handleEditConnection = useCallback(async (instructions: string) => {
    // 创建助手消息ID
    const assistantMessageId = `assistant-${Date.now()}`;

    try {
      setIsConnecting(true);
      setConnectionStatus('connecting');

      // 清理之前的连接
      cleanupConnection();

      // 创建新的AbortController
      abortControllerRef.current = new AbortController();

      // 获取认证token
      const token = localStorage.getItem('auth-token');
      if (!token) {
        throw new Error('请先登录');
      }

      // 发起编辑请求
      const response = await fetch('/api/ai/edit-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          instructions,
          mode: 'edit',
          customPrompt: userSettings.editPrompt
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('响应体为空');
      }

      setConnectionStatus('connected');

      // 创建助手消息
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
        mode: 'edit'
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

      } catch (readError: any) {
        if (readError?.name !== 'AbortError') {
          console.error('读取流时出错:', readError);
          throw readError;
        } else {
          console.log('读取被中断');
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error: any) {
      console.error('编辑连接失败:', error);
      setConnectionStatus('error');

      // 添加错误消息
      flushSync(() => {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: `错误：${error.message}`, error: true, isStreaming: false }
            : msg
        ));
      });

      toast.error(error.message);
    } finally {
      setIsConnecting(false);
      setStreamingMessageId(null);
    }
  }, [cleanupConnection, userSettings.editPrompt, handleSSEEvent]);

  // 发送消息
  const handleSendMessage = useCallback(async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isConnecting) return;

    // 自动判断模式（如果当前是chat模式）
    let messageMode = currentMode;
    if (currentMode === 'chat') {
      const detected = detectModeFromMessage(trimmedInput);
      if (detected !== 'chat') {
        messageMode = detected;
        toast.success(`自动识别为${AI_MODES[detected].name}，使用对应提示词`);
      }
    }

    // 创建用户消息
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
      mode: messageMode
    };

    // 只在非生成模式下在对话框中显示用户消息
    if (messageMode !== 'generate') {
    setMessages(prev => [...prev, userMessage]);
    }

    setInputValue('');

    // 聚焦输入框
    setTimeout(() => inputRef.current?.focus(), 0);

    try {
      // 根据模式调用不同的API
      if (messageMode === 'chat') {
        await handleSSEConnection(trimmedInput, messageMode);
      } else if (messageMode === 'generate') {
        // 生成模式：直接开始生成，不显示在对话框中
        toast.success('开始生成网页，请查看代码编辑器...');
        await handleGenerateConnection(trimmedInput);
      } else if (messageMode === 'edit') {
        await handleEditConnection(trimmedInput);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      toast.error('发送消息失败，请重试');
    }
  }, [inputValue, isConnecting, currentMode, detectModeFromMessage, handleSSEConnection, handleGenerateConnection, handleEditConnection, setMessages]);

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
  }, [testAIConnection]); // 只在组件挂载时执行一次

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
                {connectionStatus === 'connected' ? `${currentModeConfig.name}` :
                 connectionStatus === 'connecting' ? `${currentModeConfig.name}中...` :
                 connectionStatus === 'testing' ? '连接中...' :
                 connectionStatus === 'error' ? '连接错误' : '未连接'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 模式切换器 */}
          <div className="relative">
            <button
              onClick={() => setShowModeSelector(!showModeSelector)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                currentModeConfig.color
              } text-white hover:opacity-90`}
            >
              <currentModeConfig.icon className="w-4 h-4" />
              <span>{currentModeConfig.name}</span>
              <Settings className="w-3 h-3" />
            </button>

            {/* 模式选择下拉菜单 */}
            {showModeSelector && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 mb-2">选择AI模式</div>
                  {Object.entries(AI_MODES).map(([mode, config]) => (
                    <button
                      key={mode}
                      onClick={() => handleModeChange(mode as AIMode)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                        currentMode === mode
                          ? `${config.color} text-white`
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <config.icon className="w-4 h-4" />
                      <div className="flex-1 text-left">
                        <div className="font-medium">{config.name}</div>
                        <div className="text-xs opacity-75">{config.description}</div>
                      </div>
                      {currentMode === mode && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-200 p-2">
                  <div className="text-xs text-gray-500">
                    💡 对话模式下会自动识别您的意图
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 重连按钮 - 只在断开或错误时显示 */}
          {(connectionStatus === 'disconnected' || connectionStatus === 'error') && (
            <button
              onClick={testAIConnection}
              disabled={false}
              className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
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
      </div>

      {/* 模式信息提示 */}
      {currentMode !== 'chat' && (
        <div className={`${currentModeConfig.color} text-white px-4 py-2 text-sm flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <currentModeConfig.icon className="w-4 h-4" />
            <span>{currentModeConfig.description}</span>
          </div>
          <div className="flex items-center gap-2 text-xs opacity-90">
            {userSettings[`${currentMode}Prompt`] && (
              <span>使用自定义提示词</span>
            )}
          </div>
        </div>
      )}



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
            placeholder={currentModeConfig.placeholder}
            disabled={isConnecting}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isConnecting}
            className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 ${
              currentModeConfig.color
            } hover:opacity-90`}
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
