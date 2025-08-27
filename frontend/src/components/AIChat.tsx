import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Send, User, Loader2, Sparkles, CheckCircle, Zap, Copy, ThumbsUp, ThumbsDown, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebsiteStore } from '../store/websiteStore';
import { aiService } from '../services/api';
import { toast } from 'react-hot-toast';

import { Website } from '@/shared/types';
import { extractHTMLCode } from './HTMLExtractor';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  type?: 'chat' | 'confirmation' | 'generation';
  confirmationData?: {
    websiteType: string;
    features: string[];
    ready: boolean;
  };
  isConfirmation?: boolean;
  needsConfirmation?: boolean;
  isStreaming?: boolean;
}

type ConversationStage = 'initial' | 'gathering' | 'confirmation' | 'generating' | 'editing';

interface AIChatProps {
  websiteId?: string;
  onWebsiteGenerated?: (website: Website, content: string) => void;
  onWebsiteUpdated?: (content: string) => void;
  onGenerationProgress?: (progress: number, stage: string, partialCode?: string) => void;
  onCodeStreamUpdate?: (code: string) => void;
}

export const AIChat: React.FC<AIChatProps> = ({
  websiteId,
  onWebsiteGenerated,
  onWebsiteUpdated,
  onGenerationProgress,
  onCodeStreamUpdate,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [generationProgress, setGenerationProgress] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [conversationStage, setConversationStage] = useState<ConversationStage>('initial');
  const [lastChunkTime, setLastChunkTime] = useState(0);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [websiteRequirements] = useState<{
    type?: string;
    description?: string;
    features?: string[];
    style?: string;
    colors?: string;
    content?: string;
  }>({});
  const [pendingGeneration, setPendingGeneration] = useState(false);
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);
  const [isInterruptable, setIsInterruptable] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('connected');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentWebsite } = useWebsiteStore();
  
  // 简化的状态管理，移除复杂的时间控制
  
  // 清理了批量更新相关的引用，使用直接同步更新确保真正的实时显示
  
  // 测试AI连接状态 - 仅在需要时调用
  const testAIConnection = async () => {
    try {
      setConnectionStatus('testing');
      const response = await aiService.testConnection({ provider: 'auto' });
      setConnectionStatus(response.data.data?.connected ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('连接测试失败:', error);
      setConnectionStatus('disconnected');
    }
  };

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      if (currentAbortController) {
        currentAbortController.abort();
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStopGeneration = () => {
    if (currentAbortController) {
      currentAbortController.abort();
      setCurrentAbortController(null);
      setIsInterruptable(false);
      setShowProgress(false);
      setGenerationProgress('');
      
      setMessages(prev => 
        prev.map(msg => 
          msg.isStreaming || msg.isLoading
            ? { 
                ...msg, 
                content: msg.content ? msg.content + '\n\n**⚠️ 生成已被用户中断**' : '**⚠️ 生成已被用户中断**',
                isStreaming: false,
                isLoading: false
              }
            : msg
        )
      );
      
      toast.success('已停止生成');
    }
  };



  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 清理函数：确保组件卸载时清理所有流式状态
  useEffect(() => {
    return () => {
      if (currentAbortController) {
        currentAbortController.abort();
      }
    };
  }, []);


  // 处理网站生成 - 流式版本
  const handleWebsiteGeneration = async (messageId: string) => {
    const abortController = new AbortController();
    setCurrentAbortController(abortController);
    setIsInterruptable(true);
    setShowProgress(true);
    setConversationStage('generating');
    setPendingGeneration(false);
    
    const progressSteps = [
      '🔍 正在分析您的需求...',
      '🎨 正在设计网站结构...',
      '📝 正在生成HTML代码...',
      '💅 正在优化CSS样式...',
      '⚡ 正在添加交互功能...',
      '🚀 正在进行最终优化...',
    ];
    
    setTotalSteps(progressSteps.length);
    let currentStepIndex = 0;

    try {
      // 构建详细的生成提示
      const detailedPrompt = `请根据以下详细需求创建网站：
类型：${websiteRequirements.type}
描述：${websiteRequirements.description}
风格：${websiteRequirements.style || '现代化'}
功能：${websiteRequirements.features?.join('、') || '基础功能'}
色彩：${websiteRequirements.colors || '和谐搭配'}`;


      
      let streamingContent = '';
      let finalReply = '';
      let isAbortedGeneration = false;
      
      // 监听中断信号
      abortController.signal.addEventListener('abort', () => {
        isAbortedGeneration = true;
      });

      // 使用流式API生成网站
      await aiService.generateWebsiteStream(
        detailedPrompt,
        websiteId,
        // onChunk回调
        (chunk) => {
          if (isAbortedGeneration) {
            return;
          }
          
          if (chunk.type === 'html_chunk') {
            streamingContent = chunk.fullHtml || streamingContent + (chunk.content || '');
            
            // 更新消息内容，只显示生成进度，不显示代码
            setMessages(prev => 
              prev.map(msg => 
                msg.id === messageId 
                  ? { 
                      ...msg, 
                      content: `🎨 网站代码正在生成中...\n\n**进度**: ${streamingContent.length} 字符已生成\n\n✨ 代码已实时同步到右侧代码编辑器`,
                      isStreaming: true 
                    }
                  : msg
              )
            );
            
            // 实时更新代码预览
            if (onCodeStreamUpdate) {
              onCodeStreamUpdate(streamingContent);
            }
            
            // 更新进度
            if (currentStepIndex < progressSteps.length) {
              setGenerationProgress(progressSteps[currentStepIndex]);
              setCurrentStep(currentStepIndex + 1);
              onGenerationProgress?.(((currentStepIndex + 1) / progressSteps.length) * 70, progressSteps[currentStepIndex]);
              currentStepIndex = Math.min(currentStepIndex + 1, progressSteps.length - 1);
            }
          } else if (chunk.type === 'reply') {
            finalReply = chunk.content || finalReply;
          }
        },
        // onComplete回调
        (result) => {
          if (isAbortedGeneration) {
            return;
          }
          
          // 设置完成进度
          onGenerationProgress?.(100, '🚀 网站生成完成！');
          setTimeout(() => {
            setShowProgress(false);
            setGenerationProgress('');
            setCurrentStep(0);
            setTotalSteps(0);
            setCurrentAbortController(null);
            setIsInterruptable(false);
            onGenerationProgress?.(0, ''); // 重置进度
          }, 2000);
          
          if (!result?.content) {
            console.error('响应数据检查失败:', result);
            throw new Error('AI服务返回的数据格式不正确，请重试');
          }
          
          // 实时更新代码到Code视图
          onCodeStreamUpdate?.(result.content);
          onWebsiteGenerated?.(result.website, result.content);
          
          const assistantMessage: Message = {
            id: messageId,
            role: 'assistant',
            content: `🎉 网站生成完成！代码已同步到右侧编辑器。`,
            timestamp: new Date(),
          };

          setMessages(prev => 
            prev.map(msg => msg.id === messageId ? assistantMessage : msg)
          );
          
          setConversationStage('editing');
          toast.success('网站生成成功！');
        },
        // onError回调
        (error) => {
          console.error('AI生成失败:', error);
          setShowProgress(false);
          
          const errorMessage: Message = {
            id: messageId,
            role: 'assistant',
            content: `抱歉，生成网站时出现了错误：${error}。请重试或重新描述您的需求。`,
            timestamp: new Date(),
          };

          setMessages(prev => 
            prev.map(msg => msg.id === messageId ? errorMessage : msg)
          );
          
          toast.error('网站生成失败');
          setCurrentAbortController(null);
          setIsInterruptable(false);
        },
        abortController
      );
      
    } catch (error) {
      setShowProgress(false);
      setCurrentAbortController(null);
      setIsInterruptable(false);
      console.error('网站生成错误:', error);
      
      const errorMessage: Message = {
        id: messageId,
        role: 'assistant',
        content: `抱歉，生成网站时遇到了问题：${(error as Error).message}

请检查：
• 网络连接是否正常
• AI服务配置是否正确
• 稍后重试或简化需求描述`,
        timestamp: new Date(),
      };

      setMessages(prev => 
        prev.map(msg => msg.id === messageId ? errorMessage : msg)
      );
      
      toast.error('网站生成失败');
      setConversationStage('gathering');
    }
  };

  // 处理网站编辑 - 流式版本
  const handleWebsiteEdit = async (instructions: string, messageId: string) => {
    const abortController = new AbortController();
    setCurrentAbortController(abortController);
    setIsInterruptable(true);
    
    try {

      
      let streamingContent = '';
      let isAbortedEdit = false;
      
      // 监听中断信号
      abortController.signal.addEventListener('abort', () => {
        isAbortedEdit = true;
      });

      // 使用流式API编辑网站
      await aiService.editWebsiteStream(
        websiteId || '',
        instructions,
        // onChunk回调
        (chunk) => {
          if (isAbortedEdit) {
            return;
          }
          
          if (chunk.content) {
            streamingContent += chunk.content;
            
            // 更新消息内容以显示实时编辑的代码
            setMessages(prev => 
              prev.map(msg => 
                msg.id === messageId 
                  ? { 
                      ...msg, 
                      content: `🔄 正在编辑网站...\n\n**编辑指令**: ${instructions}\n\n**编辑进度**: ${streamingContent.length} 字符\n\n**预览代码**:\n\`\`\`html\n${streamingContent.substring(0, 300)}${streamingContent.length > 300 ? '...' : ''}\n\`\`\``,
                      isStreaming: true 
                    }
                  : msg
              )
            );
            
            // 实时更新代码预览
            if (onCodeStreamUpdate) {
              onCodeStreamUpdate(streamingContent);
            }
          }
        },
        // onComplete回调
        (result) => {
          if (isAbortedEdit) {
            return;
          }
          
          if (!result?.content) {
            throw new Error('AI服务返回的编辑结果格式不正确，请重试');
          }
          
          // 实时更新代码
          onCodeStreamUpdate?.(result.content);
          onWebsiteUpdated?.(result.content);
          
          const assistantMessage: Message = {
            id: messageId,
            role: 'assistant',
            content: `✅ 修改完成！我已经根据您的指令："${instructions}"更新了网站。

更新内容已应用到左侧预览区域，您可以查看效果。如果还需要其他调整，请继续告诉我！`,
            timestamp: new Date(),
          };

          setMessages(prev => 
            prev.map(msg => msg.id === messageId ? assistantMessage : msg)
          );
          
          setCurrentAbortController(null);
          setIsInterruptable(false);
          toast.success('网站更新成功！');
        },
        // onError回调
        (error) => {
          console.error('AI编辑失败:', error);
          
          const errorMessage: Message = {
            id: messageId,
            role: 'assistant',
            content: `抱歉，编辑网站时遇到了问题：${error}

请重试或提供更具体的修改指令。`,
            timestamp: new Date(),
          };

          setMessages(prev => 
            prev.map(msg => msg.id === messageId ? errorMessage : msg)
          );
          
          toast.error('网站编辑失败');
          setCurrentAbortController(null);
          setIsInterruptable(false);
        },
        abortController
      );
      
    } catch (error) {
      setCurrentAbortController(null);
      setIsInterruptable(false);
      console.error('网站编辑错误:', error);
      
      const errorMessage: Message = {
        id: messageId,
        role: 'assistant',
        content: `抱歉，编辑网站时遇到了问题：${(error as Error).message}

请重试或提供更具体的修改指令。`,
        timestamp: new Date(),
      };

      setMessages(prev => 
        prev.map(msg => msg.id === messageId ? errorMessage : msg)
      );
      
      toast.error('网站编辑失败');
    }
  };

  // 处理需求收集 - 使用流式API实现实时显示
  const handleRequirementsGathering = async (userInput: string, messageId: string) => {
    // 简化中断逻辑，只在必要时使用
    const abortController = new AbortController();
    setCurrentAbortController(abortController);
    setIsInterruptable(false); // 先禁用中断功能，专注于修复流式输出
    
    try {

      
      // 构建对话历史
      const conversationHistory = messages
        .filter(msg => msg.role !== 'assistant' || !msg.content.includes('正在工作中'))
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      let fullResponse = '';
      // 移除复杂的中断逻辑，专注于流式输出
      
      // 调用流式chat API
      
      await aiService.chatStream(
        {
          message: userInput,
          conversationHistory,
          stage: conversationStage,
          requirements: websiteRequirements
        },
        // onChunk - 实时更新消息内容
        (chunk: string) => {
          fullResponse += chunk;
          const currentTime = Date.now();
          
          // 更新消息状态和内容，确保立即显示流式内容
          setMessages(prev => 
            prev.map(msg => 
              msg.id === messageId 
                ? { 
                    ...msg, 
                    content: fullResponse, // 立即更新内容，确保不显示加载状态
                    isStreaming: true,
                    isLoading: false
                  }
                : msg
            )
          );
          
          // 使用最简单的立即更新
          flushSync(() => {
            setStreamingContent(fullResponse);
            setStreamingMessageId(messageId);
            setLastChunkTime(currentTime);
          });
          
          // 立即强制滚动到底部，不使用延迟
          scrollToBottom();
          
          // HTML检查移到最后，避免影响实时显示
          if (chunk.includes('```html') || chunk.includes('<!DOCTYPE') || chunk.includes('<html')) {
            const extractedHTML = extractHTMLCode(fullResponse);
            if (extractedHTML && onCodeStreamUpdate) {
              onCodeStreamUpdate(extractedHTML);
            }
          }
        },
        // onComplete - 完成时的处理
        (finalResponse: string) => {
          
          // 使用最终响应
          const finalContent = finalResponse || fullResponse;
          
          // 清理流式状态
          setStreamingMessageId(null);
          setStreamingContent('');
          
          
          // 检查用户输入是否包含明确的网站生成请求
          const userMessages = messages.filter(msg => msg.role === 'user').map(msg => msg.content).join(' ');
          const hasWebsiteRequest = userMessages.includes('生成网页') || 
                                   userMessages.includes('创建网站') || 
                                   userMessages.includes('制作网站') || 
                                   userMessages.includes('做个网站') ||
                                   userMessages.includes('网站') ||
                                   userMessages.includes('页面') ||
                                   userMessages.includes('官网');
          
          // 检查是否包含HTML代码并同步到Code模块
          const extractedHTML = extractHTMLCode(finalContent);
          if (extractedHTML && onCodeStreamUpdate) {
            onCodeStreamUpdate(extractedHTML);
          }
          
          // 分析AI回复，判断是否需要进入确认阶段
          const shouldConfirm = finalContent.includes('确认无误') || 
                               finalContent.includes('开始为您创建') || 
                               finalContent.includes('方案符合您的预期') ||
                               finalContent.includes('开始生成') ||
                               finalContent.includes('是否确认') ||
                               finalContent.includes('确认生成') ||
                               finalContent.includes('开始制作') ||
                               finalContent.includes('创建网站') ||
                               finalContent.includes('制作网站') ||
                               finalContent.includes('生成网页') ||
                               (finalContent.includes('网站') && (finalContent.includes('确认') || finalContent.includes('开始'))) ||
                               (hasWebsiteRequest && !extractedHTML); // 如果用户有网站请求但回复中没有HTML代码，显示确认按钮
          
          if (shouldConfirm && !pendingGeneration) {
            setPendingGeneration(true);
            setConversationStage('confirmation');
          }
          
          // 处理最终消息内容，移除HTML代码
          const cleanedFinalContent = extractedHTML 
            ? finalContent.replace(/```html\s*[\s\S]*?\s*```/gi, '```\n🎨 网页代码已生成并同步到代码编辑器\n```')
                          .replace(/(<!DOCTYPE\s+html[\s\S]*?<\/html>)/gi, '🎨 完整网页代码已生成并同步到代码编辑器')
                          .replace(/(<html[\s\S]*?<\/html>)/gi, '🎨 网页代码已生成并同步到代码编辑器')
            : finalContent;
            
          const completedMessage: Message = {
            id: messageId,
            role: 'assistant',
            content: cleanedFinalContent,
            timestamp: new Date(),
            needsConfirmation: shouldConfirm,
            isStreaming: false,
          };


          
          setCurrentAbortController(null);
          setIsInterruptable(false);
          setMessages(prev => 
            prev.map(msg => msg.id === messageId ? completedMessage : msg)
          );
        },
        // onError - 错误处理
        (error: string) => {
          console.error('❌ 流式聊天错误:', error);
          
          const errorMessage: Message = {
            id: messageId,
            role: 'assistant',
            content: `抱歉，发生了错误：${error}`,
            timestamp: new Date(),
            isStreaming: false,
          };

          // 清理状态并更新消息
          setCurrentAbortController(null);
          setIsInterruptable(false);
          setMessages(prev => 
            prev.map(msg => msg.id === messageId ? errorMessage : msg)
          );
        },
        abortController
      );
      
    } catch (error) {
      setCurrentAbortController(null);
      setIsInterruptable(false);
      console.error('需求收集错误:', error);
      
      let errorContent = '抱歉，我在处理您的需求时遇到了问题。请重新描述一下您想要创建的网站。';
      
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as any;
        if (apiError.response?.data?.error || apiError.response?.data?.message) {
          errorContent = `抱歉，发生了错误：${apiError.response.data.error || apiError.response.data.message}`;
        }
      }
      
      const errorMessage: Message = {
        id: messageId,
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
        isStreaming: false,
      };

      setMessages(prev => 
        prev.map(msg => msg.id === messageId ? errorMessage : msg)
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || messages.some(msg => msg.isStreaming)) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    const streamingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,     // 显示加载状态
      isStreaming: false,  // 收到第一个内容后立即切换到流式状态
    };

    setMessages(prev => [...prev, userMessage, streamingMessage]);
    const currentInput = inputValue.trim();
    setInputValue('');

    // 检查是否是确认生成网站的指令
    
    if (pendingGeneration && (currentInput.includes('确认') || currentInput.includes('生成') || currentInput.includes('是') || currentInput.toLowerCase().includes('yes'))) {
      await handleWebsiteGeneration(streamingMessage.id);
      return;
    }
    
    // 检查是否是拒绝生成的指令
    if (pendingGeneration && (currentInput.includes('否') || currentInput.includes('不') || currentInput.includes('取消') || currentInput.toLowerCase().includes('no'))) {
      setPendingGeneration(false);
      setConversationStage('gathering');
      
      const assistantMessage: Message = {
        id: streamingMessage.id,
        role: 'assistant',
        content: '好的，我们继续完善网站需求。请告诉我您还需要添加什么功能或修改什么设计？',
        timestamp: new Date(),
      };
      
      setMessages(prev => 
        prev.map(msg => msg.id === streamingMessage.id ? assistantMessage : msg)
      );
      // 不需要设置全局isLoading状态
      return;
    }

    try {

      
      if (websiteId && currentWebsite) {
        // 有现有网站：判断是编辑指令还是聊天询问
        if (isEditInstruction(currentInput)) {
          await handleWebsiteEdit(currentInput, streamingMessage.id);
        } else {
          await handleRequirementsGathering(currentInput, streamingMessage.id);
        }
      } else {
        // 新建网站 - 进入对话收集需求阶段
        await handleRequirementsGathering(currentInput, streamingMessage.id);
      }
    } catch (error) {
      console.error('AI Chat error:', error);
      
      let errorContent = '抱歉，在处理您的请求时遇到了错误。请重试或重新描述您的请求。';
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorContent = `抱歉，发生了错误：${error.message}`;
      }
      
      const errorMessage: Message = {
        id: streamingMessage.id,
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };

      setMessages(prev => 
        prev.map(msg => msg.id === streamingMessage.id ? errorMessage : msg)
      );
      
      toast.error('处理请求失败');
    }
  };

  const suggestions = [
    "我想创建一个个人作品集网站",
    "帮我做一个公司官网",
    "我需要一个电商购物网站",
    "创建一个博客写作平台",
    "制作一个餐厅展示网站"
  ];

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  // 判断用户输入是编辑指令还是聊天询问
  const isEditInstruction = (input: string): boolean => {
    const editKeywords = [
      '修改', '更改', '改变', '编辑', '调整', '优化', '替换', '删除', '删掉', '去掉', 
      '添加', '加上', '增加', '插入', '设置', '改成', '换成', '变成',
      '改为', '改进', '完善', '美化', '重新', '重做', '改写'
    ];
    
    const chatKeywords = [
      '是什么', '什么是', '介绍', '解释', '说明', '告诉我', '请问', '如何', '怎么', 
      '为什么', '哪里', '哪个', '功能', '作用', '用途', '帮助', '了解', '知道',
      '能否', '可以', '是否', '有没有', '包含', '支持', '特点', '优势'
    ];
    
    const lowerInput = input.toLowerCase();
    
    // 如果包含明确的编辑关键词，则认为是编辑指令
    if (editKeywords.some(keyword => lowerInput.includes(keyword))) {
      return true;
    }
    
    // 如果包含明确的聊天关键词，则认为是聊天询问
    if (chatKeywords.some(keyword => lowerInput.includes(keyword))) {
      return false;
    }
    
    // 默认情况下，在编辑模式中把简短的描述性输入当作聊天
    return input.length > 20; // 长指令更可能是编辑指令
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white border-l border-slate-200/60 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="relative flex-shrink-0">
            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            {isInterruptable && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-lg">AI Assistant</h3>
            <div className="flex items-center space-x-1.5">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400' : 
                connectionStatus === 'disconnected' ? 'bg-red-400' : 
                'bg-yellow-400 animate-pulse'
              }`}></div>
              <p className="text-xs text-slate-500 font-medium">
                {isInterruptable ? '生成中...' : 
                 connectionStatus === 'connected' ? (websiteId ? '编辑模式' : '创建模式') :
                 connectionStatus === 'disconnected' ? '未连接' : '连接中...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center py-12"
            >
              <div className="relative mx-auto mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl">
                  <Zap className="h-10 w-10 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3 bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                AI Website Builder
              </h3>
              <p className="text-slate-600 mb-8 max-w-md mx-auto leading-relaxed">
                告诉我您的想法，我会为您创建一个精美的网站。让我们开始这场创意之旅！
              </p>
              
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700 flex items-center justify-center space-x-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <span>试试这些建议</span>
                </p>
                <div className="grid gap-2 max-w-lg mx-auto">
                  {suggestions.map((suggestion, index) => (
                    <motion.button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="group text-left p-4 text-sm text-slate-600 hover:text-violet-700 hover:bg-gradient-to-r hover:from-violet-50 hover:to-purple-50 rounded-xl border border-slate-200 hover:border-violet-300 transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
                    >
                      <span className="flex items-center space-x-2">
                        <span className="text-violet-500 opacity-70 group-hover:opacity-100 transition-opacity">💡</span>
                        <span>"{suggestion}"</span>
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} group`}>
                <div className={`flex-shrink-0 ${message.role === 'user' ? 'ml-3' : 'mr-3'}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md flex-shrink-0 ${
                    message.role === 'user' 
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
                      : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                  }`}>
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : message.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>
                </div>
                
                <div className={`relative px-5 py-3 rounded-2xl shadow-sm ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                    : 'bg-white text-slate-900 border border-slate-200/60 shadow-lg'
                } ${message.isStreaming ? 'animate-pulse' : ''}`}>
                  <div className="space-y-3">
                    <div className="prose prose-sm max-w-none">
                      <div className="text-sm whitespace-pre-wrap leading-relaxed" key={`content-${message.id}-${lastChunkTime}`}>
                        {/* 显示AI思考状态或消息内容 */}
                        {message.isLoading && !message.content ? (
                          <div className="flex items-center space-x-2 text-violet-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>AI正在思考...</span>
                          </div>
                        ) : (
                          <>
                            {message.content}
                            {streamingMessageId === message.id && (
                              <span className="inline-block w-0.5 h-5 bg-violet-500 ml-0.5 animate-pulse rounded-sm"></span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                      
                      {/* Message Actions - only show for assistant messages that aren't loading */}
                      {message.role === 'assistant' && !message.isLoading && !message.isStreaming && message.content && (
                        <div className="flex items-center space-x-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button 
                            onClick={() => navigator.clipboard.writeText(message.content)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors tooltip"
                            title="复制消息"
                          >
                            <Copy className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                          </button>
                          <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="点赞">
                            <ThumbsUp className="h-3.5 w-3.5 text-slate-400 hover:text-green-500" />
                          </button>
                          <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="点踩">
                            <ThumbsDown className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                          </button>
                        </div>
                      )}
                      {message.needsConfirmation && (
                        <div className="mt-3 flex space-x-2">
                          <button
                            onClick={() => {
                              const confirmEvent = { 
                                preventDefault: () => {}, 
                                target: { value: '确认生成' } 
                              } as unknown as React.FormEvent;
                              setInputValue('确认生成');
                              setTimeout(() => {
                                handleSubmit(confirmEvent);
                              }, 100);
                            }}
                            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg transition-colors flex items-center space-x-1"
                          >
                            <CheckCircle className="h-3 w-3" />
                            <span>确认生成</span>
                          </button>
                          <button
                            onClick={() => {
                              const cancelEvent = { 
                                preventDefault: () => {}, 
                                target: { value: '取消' } 
                              } as unknown as React.FormEvent;
                              setInputValue('取消');
                              setTimeout(() => {
                                handleSubmit(cancelEvent);
                              }, 100);
                            }}
                            className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200/60 bg-white/80 backdrop-blur-sm p-5">
        {/* Stop button - only show when interruptable */}
        <AnimatePresence>
          {isInterruptable && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="mb-3 flex justify-center"
            >
              <motion.button
                onClick={handleStopGeneration}
                className="group flex items-center space-x-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-600 hover:text-red-700 rounded-full text-sm font-medium transition-all duration-200 hover:shadow-sm"
                title="停止AI生成"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Pause className="h-3 w-3" />
                <span className="text-xs">停止</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={websiteId ? "您希望如何修改网站？" : "描述您想要创建的网站..."}
              className="w-full pl-4 pr-12 py-3 bg-slate-100 hover:bg-slate-200 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-400 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 placeholder-slate-500 text-slate-800 text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              disabled={messages.some(msg => msg.isStreaming)}
            />
            <motion.button
              type="submit"
              disabled={!inputValue.trim() || messages.some(msg => msg.isStreaming)}
              className={`absolute right-1 p-2.5 rounded-full transition-all duration-300 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed group ${
                messages.some(msg => msg.isStreaming) 
                  ? 'bg-slate-200 text-slate-400 shadow-inner'
                  : inputValue.trim()
                    ? 'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 hover:from-blue-500 hover:via-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl border border-blue-300 hover:border-blue-400'
                    : 'bg-slate-200 text-slate-400 shadow-inner'
              }`}
              whileHover={!messages.some(msg => msg.isStreaming) && inputValue.trim() ? { 
                scale: 1.1, 
                rotate: [0, -3, 3, 0],
                boxShadow: "0 10px 25px rgba(59, 130, 246, 0.4)"
              } : {}}
              whileTap={!messages.some(msg => msg.isStreaming) && inputValue.trim() ? { 
                scale: 0.9,
                boxShadow: "0 5px 15px rgba(59, 130, 246, 0.6)"
              } : {}}
              animate={inputValue.trim() && !messages.some(msg => msg.isStreaming) ? {
                boxShadow: [
                  "0 4px 8px rgba(59, 130, 246, 0.3)",
                  "0 6px 12px rgba(59, 130, 246, 0.4)",
                  "0 4px 8px rgba(59, 130, 246, 0.3)"
                ]
              } : {}}
              transition={{
                boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                scale: { type: "spring", stiffness: 400, damping: 17 },
                rotate: { duration: 0.3 }
              }}
            >
              {messages.some(msg => msg.isStreaming) ? (
                <div className="flex space-x-0.5">
                  <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              ) : (
                <motion.div
                  animate={inputValue.trim() ? { 
                    x: [0, 1, 0],
                    rotate: [0, 5, 0]
                  } : {}}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                >
                  <Send className="h-4 w-4 drop-shadow-sm" />
                </motion.div>
              )}
            </motion.button>
          </div>
        </form>
        
        <div className="mt-3 flex items-center justify-center space-x-2 text-xs text-gray-400">
          <span>按Enter发送</span>
          <span>•</span>
          <div className="flex items-center space-x-1">
            <Sparkles className="h-3 w-3 text-blue-400" />
            <span>由AI驱动</span>
          </div>
        </div>
      </div>
    </div>
  );
};