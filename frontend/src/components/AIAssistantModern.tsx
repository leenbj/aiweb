import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/Button';
import { aiService } from '../services/api';
import { useAuth } from '../lib/auth';
import CodeScrollDisplay from './CodeScrollDisplay';
import { useSseStore } from '@/store/sseStore';
import { 
  Send, 
  User, 
  Loader2,
  Sparkles,
  Code,
  MessageSquare,
  RefreshCw,
  ChevronRight,
  Pause as PauseIcon,
  Play as PlayIcon
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  error?: boolean;
  reasoning?: string;
  codeSnippet?: string | null;
  codeLang?: string;
  codeTitle?: string | null;
}

interface Props {
  onCodeUpdate?: (code: string) => void;
  onGenerationStart?: () => void;
  onGenerationEnd?: () => void;
  className?: string;
  projectName?: string;
  onProjectNameChange?: (name: string) => void;
}

// 模拟代码生成的组件 - 已废弃，改为使用新的代码展示组件

export default function AIAssistantModern({ 
  onCodeUpdate, 
  onGenerationStart, 
  onGenerationEnd, 
  className = '',
  projectName = '未命名',
  onProjectNameChange 
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const sendingRef = useRef(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(projectName);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { setConnected: setGlobalConnected, setHeartbeat: setGlobalHeartbeat, triggerPulse: globalPulse } = useSseStore();
  const [chatAbortController, setChatAbortController] = useState<AbortController | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>('');
  const [pendingCode, setPendingCode] = useState<string>('');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const codeStartedRef = useRef<boolean>(false);
  const [listOverflow, setListOverflow] = useState<boolean>(false);
  // 流式解析状态：把代码从文本中分离，避免代码出现在文本里
  const insideCodeRef = useRef<boolean>(false);
  const codeBufferRef = useRef<string>('');
  const textBufferRef = useRef<string>('');
  const lastLangRef = useRef<string>('html');
  const lastFilePathRef = useRef<string>('');

  const resetParsingState = () => {
    insideCodeRef.current = false;
    codeBufferRef.current = '';
    textBufferRef.current = '';
    lastLangRef.current = 'html';
    codeStartedRef.current = false;
  };

  const processChunk = (raw: string) => {
    // 尝试从纯文本中提取文件路径（示例：Writing /components/Footer.tsx...）
    const file = detectFilePath(raw);
    if (file) lastFilePathRef.current = file;
    let c = raw;
    // 支持多语言围栏：```<lang> 可选
    const fenceRegex = /```([a-zA-Z0-9+#._-]+)?\s*\n?/;
    while (c.length > 0) {
      if (insideCodeRef.current) {
        const endIdx = c.indexOf('```');
        if (endIdx !== -1) {
          codeBufferRef.current += c.slice(0, endIdx);
          c = c.slice(endIdx + 3);
          // 可选的换行
          if (c.startsWith('\n')) c = c.slice(1);
          insideCodeRef.current = false;
        } else {
          codeBufferRef.current += c;
          c = '';
        }
      } else {
        const m = c.match(fenceRegex);
        if (m) {
          const idx = m.index as number;
          // fence 前面的内容是纯文本
          textBufferRef.current += c.slice(0, idx);
          c = c.slice(idx + m[0].length);
          insideCodeRef.current = true;
          if (m[1]) lastLangRef.current = m[1].toLowerCase();
        } else {
          // 无 fence，作为文本追加
          textBufferRef.current += c;
          c = '';
        }
      }
    }
  };

  // 提取完整的 <!DOCTYPE html ... </html> 文档片段
  const extractFullHtml = (s: string): string | null => {
    if (!s) return null;
    const lower = s.toLowerCase();
    const start = lower.indexOf('<!doctype html');
    const end = lower.lastIndexOf('</html>');
    if (start !== -1 && end !== -1 && end > start) {
      return s.substring(start, end + 7 + 1); // include </html>
    }
    return null;
  };

  // 从文本片段中提取文件路径
  const detectFilePath = (s: string): string | null => {
    if (!s) return null;
    const r1 = /(Writing\s+)([A-Za-z0-9_\-\.\/]+\.(?:tsx|jsx|ts|js|css|scss|less|html|vue|svelte))/i;
    const m1 = s.match(r1);
    if (m1 && m1[2]) return m1[2];
    const r2 = /([\/A-Za-z0-9_\-\.]+\.(?:tsx|jsx|ts|js|css|scss|less|html|vue|svelte))/i;
    const m2 = s.match(r2);
    if (m2 && m2[1]) return m2[1];
    return null;
  };

  // 心跳指示状态
  const [isConnected, setIsConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<number | null>(null);
  const [heartbeatPulse, setHeartbeatPulse] = useState(false);
  const pulseTimer = useRef<number | null>(null);
  const [tick, setTick] = useState(0); // 用于被动刷新状态

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 被动刷新：每5秒重渲染一次用于更新“心跳是否过期”的显示
  useEffect(() => {
    const t = window.setInterval(() => setTick((v) => v + 1), 5000);
    return () => window.clearInterval(t);
  }, []);

  // 触发一次心跳动画
  const triggerPulse = () => {
    setHeartbeatPulse(true);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setHeartbeatPulse(false), 700) as unknown as number;
  };

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isGenerating || sendingRef.current) return;
    sendingRef.current = true;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue.trim();
    setInputValue('');
    setIsGenerating(true);
    setLastPrompt(currentInput);

    // 检测是否是生成网站的指令 - 更精确的关键词匹配
    const isGenerationRequest = /^(好的?[，,]?)?((请)?(帮我?|给我?|为我?)?)(生成|创建|制作|建立|做一个|要一个|开始生成|开始创建)(一个?)?(网站|页面|网页|html|代码)/.test(currentInput.toLowerCase());
    
    // 只有在生成网站请求时才调用onGenerationStart
    if (isGenerationRequest) {
      onGenerationStart?.();
    }

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      reasoning: '⚡ AI正在快速响应中...'
    };

    setMessages(prev => [...prev, assistantMessage]);
    setStreamingMessageId(assistantMessageId);
    resetParsingState();

    try {
      let fullResponse = '';
      let generatedCode = '';

      // 使用真实的AI API - 确保使用对话模式提示词并传递用户ID
      const ctrl = new AbortController();
      setChatAbortController(ctrl);
      await aiService.chatStream(
        {
          message: currentInput,
          conversationHistory: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          stage: 'chat', // 强制使用chat阶段以获取对话提示词
          requirements: { type: 'conversation' }
        },
        // onChunk - 实时流式显示
        (chunk: string) => {
          fullResponse += chunk;
          // 增量解析：将代码分离到 codeBufferRef，普通文本进入 textBufferRef
          processChunk(chunk);
          const contentText = textBufferRef.current;
          const codeText = codeBufferRef.current;

          // 实时更新对话中的文本与代码框
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: contentText,
                  codeSnippet: codeText || null,
                  codeLang: codeText ? lastLangRef.current : msg.codeLang,
                  codeTitle: lastFilePathRef.current || msg.codeTitle || null,
                  isStreaming: true,
                  reasoning: fullResponse.length > 0 ? '✨ 正在实时为您生成回答...' : msg.reasoning,
                }
              : msg
          ));

          // 首次发现代码，触发右侧生成动画开始
          if (!codeStartedRef.current && codeText) {
            codeStartedRef.current = true;
            onGenerationStart?.();
          }
          // 实时同步到右侧代码模块：优先提取完整 <!DOCTYPE html> ... </html>
          if (codeText) {
            const full = extractFullHtml(codeText) || codeText;
            onCodeUpdate?.(full);
          }
        },
        // onComplete
        (response: string) => {
          // 完成：若未识别到 fence，则尝试整体提取一次 HTML
          let finalCode = codeBufferRef.current;
          let finalText = textBufferRef.current;
          if (!finalCode) {
            const fallback = response.match(/```html\s*[\r\n]+([\s\S]*?)```/i) || response.match(/(<html[\s\S]*<\/html>)/i);
            if (fallback) {
              finalCode = fallback[1] || fallback[0];
              finalText = response.replace(fallback[0], '').trim();
              lastLangRef.current = 'html';
            }
          }

          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: finalText,
                  codeSnippet: finalCode || null,
                  codeLang: finalCode ? lastLangRef.current : msg.codeLang,
                  codeTitle: lastFilePathRef.current || msg.codeTitle || null,
                  isStreaming: false,
                  reasoning: '✅ 分析完成，已为您生成回答',
                }
              : msg
          ));

          // 完成：确保右侧代码模块有最终版本并结束动画
          if (finalCode) {
            setPendingCode(finalCode);
            const full = extractFullHtml(finalCode) || finalCode;
            onCodeUpdate?.(full);
          }

          setStreamingMessageId(null);
          setIsGenerating(false);
          if (codeStartedRef.current) onGenerationEnd?.();
          sendingRef.current = false;
          },
        // onError
        (error: string) => {
          console.error('AI聊天错误:', error);
          if (error === '聊天已被中断') {
            // 暂停：不覆盖已有内容，仅标记为暂停可继续
            setIsPaused(true);
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, isStreaming: false, reasoning: '⏸ 已暂停，可点击继续输出' }
                : msg
            ));
          } else {
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: '抱歉，发生了错误，请稍后重试。', isStreaming: false, error: true }
                : msg
            ));
          }
          setStreamingMessageId(null);
          setIsGenerating(false);
          onGenerationEnd?.();
          sendingRef.current = false;
        },
        ctrl,
        // onEvent - 处理connected/heartbeat以优化感知速度
        (evt) => {
          if (evt.event === 'connected') {
            setIsConnected(true);
            setLastHeartbeat(Date.now());
            triggerPulse();
            setGlobalConnected(true);
            setGlobalHeartbeat(Date.now());
            globalPulse();
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, isStreaming: true, reasoning: '✅ 已连接，正在生成…' }
                : msg
            ));
          }
          if (evt.event === 'heartbeat') {
            setLastHeartbeat(Date.now());
            triggerPulse();
            setGlobalHeartbeat(Date.now());
            globalPulse();
          }
          if (evt.event === 'done') {
            setIsConnected(false);
            setLastHeartbeat(null);
            setHeartbeatPulse(false);
            setGlobalConnected(false);
            setGlobalHeartbeat(null);
          }
        }
      );

    } catch (error) {
      console.error('发送消息失败:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: '网络错误，请检查连接后重试。', isStreaming: false, error: true }
          : msg
      ));
      setStreamingMessageId(null);
      setIsGenerating(false);
      onGenerationEnd?.();
      sendingRef.current = false;
    }
  }, [inputValue, isGenerating, messages, onCodeUpdate, onGenerationStart, onGenerationEnd]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearConversation = () => {
    setMessages([]);
  };

  const handlePause = () => {
    if (chatAbortController) {
      chatAbortController.abort();
      setChatAbortController(null);
      setIsConnected(false);
      setHeartbeatPulse(false);
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    // 继续上次未完成的输出
    if (!isGenerating && lastPrompt) {
      setIsPaused(false);
      setInputValue('继续输出刚才未完成的代码，从断点继续，直接输出代码，不要重复已输出部分。')
      // 触发一次发送
      setTimeout(() => handleSendMessage(), 0)
    }
  };

  const handleNameEdit = () => {
    setIsEditingName(true);
    setEditingName(projectName);
  };

  const handleNameSave = () => {
    onProjectNameChange?.(editingName);
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setEditingName(projectName);
    setIsEditingName(false);
  };

  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  // 动态检测对话列表是否溢出，决定是否显示滚动条
  const recomputeOverflow = React.useCallback(() => {
    const el = chatListRef.current;
    if (!el) return;
    const overflowing = el.scrollHeight > el.clientHeight + 1;
    setListOverflow(overflowing);
  }, []);

  useEffect(() => {
    recomputeOverflow();
  }, [messages, isGenerating, streamingMessageId, recomputeOverflow]);

  useEffect(() => {
    const onResize = () => recomputeOverflow();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [recomputeOverflow]);

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header - 匹配右侧模块高度 */}
      <div className="border-b border-gray-200 p-4 h-[72px] flex items-center">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200">
              <Sparkles className="w-3 h-3 text-gray-600" />
            </div>
            <div className="flex-1">
              {isEditingName ? (
                <div className="relative">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={handleNameKeyPress}
                    onBlur={handleNameSave}
                    className="font-medium text-gray-900 bg-white border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                    autoFocus
                  />
                  <div className="absolute -bottom-5 left-0 text-xs text-gray-500">
                    按 Enter 保存，Esc 取消
                  </div>
                </div>
              ) : (
                <h3 
                  className="font-medium text-gray-900 cursor-pointer hover:text-gray-700 hover:bg-gray-50 px-2 py-1 rounded transition-colors text-sm flex items-center gap-1"
                  onClick={handleNameEdit}
                  title="点击编辑项目名称"
                >
                  {projectName}
                  <Code className="w-3 h-3 text-gray-400" />
                </h3>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* 仅在对话连接或流式期间显示当前会话心跳 */}
            {(isConnected || streamingMessageId !== null) && (() => {
              const now = Date.now();
              const age = lastHeartbeat ? now - lastHeartbeat : Infinity;
              const online = isConnected && age < 15000;
              const idle = isConnected && age >= 15000 && age < 30000;
              const color = online ? 'bg-emerald-500' : idle ? 'bg-amber-500' : 'bg-blue-500';
              const label = online ? '实时' : idle ? '保活' : '连接中';
              return (
                <div className="flex items-center gap-2" title={`AI连接状态：${label}`}>
                  <div className="relative">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`}></span>
                    {heartbeatPulse && (
                      <span className={`absolute -inset-1 rounded-full ${color} opacity-30 animate-ping`}></span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
              );
            })()}

            {/* 暂停/继续控制：生成中显示暂停，暂停后显示继续 */}
            {isGenerating && !isPaused && (
              <button
                onClick={handlePause}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="暂停生成"
              >
                <PauseIcon className="w-3.5 h-3.5" />
              </button>
            )}
            {isPaused && (
              <button
                onClick={handleResume}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="继续生成"
              >
                <PlayIcon className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={handleClearConversation}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="清除对话"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 消息列表 - 使用全局美化滚动条 */}
      <div
        ref={chatListRef}
        className={`flex-1 p-6 space-y-6 ${listOverflow ? 'overflow-y-auto chat-scroll' : 'overflow-y-visible'}`}
      >
        {messages.length === 0 && (
          // 中心引导区域 - 参考16.png
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-gray-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-medium text-gray-900">你想要创建什么网站？</h3>
              <p className="text-gray-600 max-w-md">
                告诉我你想创建的网站类型，我会帮你一步步构建
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-6">
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors">
                注册登录页面
              </button>
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors">
                数据仪表板
              </button>
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors">
                图片画廊
              </button>
            </div>
          </div>
        )}
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`${message.role === 'user' ? 'max-w-[70%]' : 'w-full'}`}>
                {message.role === 'user' ? (
                  // 用户消息使用外框
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="text-sm text-gray-900 whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  // AI消息 - 带Reasoning展示
                  <div className="space-y-3">
                    {/* 始终显示Reasoning区域，在流式响应开始时显示 */}
                    {(message.reasoning || (message.isStreaming && streamingMessageId === message.id)) && (
                      <details className="group" open={true}>
                        <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2 select-none font-medium">
                          <span>💭 Reasoning</span>
                          <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                        </summary>
                        <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-800 border border-blue-200">
                          {message.reasoning ? (
                            <p>{message.reasoning}</p>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                              <span>AI正在思考中，请稍候...</span>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                    
                  {/* AI 回复内容（去除打字机，避免重复） */}
                  <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </div>
                  {message.codeSnippet && (
                    <div className="mt-2">
                      <CodeScrollDisplay
                        code={message.codeSnippet}
                        language={(message.codeLang || 'html') as any}
                        maxLines={6}
                        onCodeComplete={() => {}}
                        title={message.codeTitle ? `Writing ${message.codeTitle}…` : undefined}
                        spinning={message.isStreaming && streamingMessageId === message.id}
                      />
                    </div>
                  )}
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 flex-shrink-0 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 思考指示器 - 更加突出 */}
        {isGenerating && !streamingMessageId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-200 shadow-sm"
          >
            {/* 复杂的加载动画 */}
            <div className="relative">
              <div className="w-12 h-12 border-4 border-blue-200 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              {/* 周围的装饰点 */}
              <motion.div 
                className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full"
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ duration: 2, repeat: Infinity, delay: 0 }}
              />
              <motion.div 
                className="absolute -bottom-1 -left-1 w-2 h-2 bg-green-400 rounded-full"
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              />
              <motion.div 
                className="absolute top-1 -left-2 w-1.5 h-1.5 bg-orange-400 rounded-full"
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
            </div>
            <div className="text-center">
              <div className="text-base font-medium text-gray-800 mb-1">AI正在深度思考</div>
              <div className="text-sm text-gray-600">分析您的需求并准备回答...</div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 - 参考16.png样式，大幅增加高度 */}
      <div className="p-6 border-t border-gray-200">
        <div className="relative">
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
            <textarea
              ref={inputRef as any}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="描述你的想法"
              className="w-full bg-transparent resize-none focus:outline-none text-base placeholder-gray-500 min-h-[80px] max-h-48"
              rows={3}
              disabled={isGenerating}
              style={{ lineHeight: '1.5' }}
            />
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Code className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isGenerating}
                className="bg-gray-700 hover:bg-gray-800 text-white rounded-full w-10 h-10 p-0"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
