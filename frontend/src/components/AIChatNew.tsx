import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Send, Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useWebsiteStore } from '../store/websiteStore';
import { aiService } from '../services/api';
import { toast } from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface AIChatProps {
  onCodeStreamUpdate?: (code: string) => void;
}

export default function AIChatNew({ onCodeStreamUpdate }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [forceRenderKey, setForceRenderKey] = useState(0); // 强制重新渲染的key
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { } = useWebsiteStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now() + '-user',
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    const assistantMessageId = Date.now() + '-assistant';
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    // 添加用户消息和空的助手消息
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputValue('');
    setIsLoading(true);
    setStreamingMessageId(assistantMessageId);

    try {
      let fullResponse = '';

      await aiService.chatStream(
        {
          message: userMessage.content,
          conversationHistory: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          stage: 'gathering',
          requirements: {}
        },
        // onChunk - 使用多重策略强制立即显示每个字符
        (chunk: string) => {
          console.log('📨 收到数据块:', chunk);
          fullResponse += chunk;
          
          // 策略1: 立即使用flushSync更新内容
          flushSync(() => {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: fullResponse, isStreaming: true }
                  : msg
              )
            );
          });
          
          // 策略2: 强制DOM重新渲染
          flushSync(() => {
            setForceRenderKey(prev => prev + 1);
          });
          
          // 策略3: 使用requestAnimationFrame确保浏览器立即绘制
          requestAnimationFrame(() => {
            // 滚动到底部确保可见性
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          });
        },
        // onComplete - 完成处理
        (finalResponse: string) => {
          console.log('✅ 流式完成:', finalResponse.length, '字符');
          
          // 最终更新并停止流式状态
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessageId 
                ? { 
                    ...msg, 
                    content: finalResponse,
                    isStreaming: false
                  }
                : msg
            )
          );
          
          setStreamingMessageId(null);
          setIsLoading(false);
          
          // 检查是否有HTML代码需要更新
          if (onCodeStreamUpdate && finalResponse.includes('```html')) {
            const htmlMatch = finalResponse.match(/```html\s*([\s\S]*?)```/);
            if (htmlMatch) {
              onCodeStreamUpdate(htmlMatch[1]);
            }
          }
        },
        // onError - 错误处理
        (error: string) => {
          console.error('❌ 流式错误:', error);
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessageId 
                ? { 
                    ...msg, 
                    content: '抱歉，发生了错误，请重试。',
                    isStreaming: false
                  }
                : msg
            )
          );
          
          setStreamingMessageId(null);
          setIsLoading(false);
          toast.error('AI响应出错，请重试');
        }
      );

    } catch (error) {
      console.error('聊天错误:', error);
      setIsLoading(false);
      setStreamingMessageId(null);
      toast.error('发送消息失败');
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[600px] bg-white border border-slate-200 rounded-xl shadow-sm">
      {/* Header */}
      <div className="flex items-center space-x-3 p-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-purple-50">
        <Avatar variant="ai" size="md" showStatus={true} status="online">
          <AvatarFallback variant="ai">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold text-slate-800">AI 助手</h3>
          <p className="text-xs text-slate-600">帮您创建和编辑网站</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`flex items-start space-x-3 ${
                message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <Avatar 
                variant={message.role === 'user' ? 'user' : 'ai'} 
                size="sm"
                className="w-7 h-7"
              >
                <AvatarFallback variant={message.role === 'user' ? 'user' : 'ai'}>
                  {message.role === 'user' ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <Bot className="h-3 w-3" />
                  )}
                </AvatarFallback>
              </Avatar>

              {/* Message Content */}
              <div className={`flex-1 max-w-[80%] ${
                message.role === 'user' ? 'text-right' : ''
              }`}>
                <div className={`inline-block p-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}>
                  <div 
                    className="text-sm whitespace-pre-wrap leading-relaxed"
                    key={streamingMessageId === message.id ? `streaming-${forceRenderKey}` : `static-${message.id}`}
                    suppressHydrationWarning={true}
                  >
                    {/* 分字符渲染以确保每个字符立即显示 */}
                    {streamingMessageId === message.id ? (
                      <span key={`content-${forceRenderKey}`}>
                        {message.content}
                        <span className="inline-block w-0.5 h-4 bg-violet-500 ml-1 animate-pulse"></span>
                      </span>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-1 px-1">
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="向 AI 助手提问..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:bg-slate-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="w-10 h-10 bg-violet-500 hover:bg-violet-600 disabled:bg-slate-300 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        
        {/* 状态指示 */}
        {isLoading && (
          <div className="mt-2 text-xs text-slate-500 text-center">
            AI 正在回复中...
          </div>
        )}
      </div>
    </div>
  );
}
