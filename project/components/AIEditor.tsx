import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Progress } from './ui/progress';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Send,
  Sparkles,
  Code,
  Eye,
  Download,
  Share,
  Save,
  Settings,
  Smartphone,
  Monitor,
  Tablet,
  RefreshCw,
  User,
  Bot,
  Zap,
  CheckCircle,
  Clock,
  Cpu,
  FileCode,
  Palette,
  Layout,
  Brush,
  Lightbulb,
  Search,
  Globe
} from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  generating?: boolean;
}

interface GenerationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
  icon: any;
}

interface GeneratedWebsite {
  id: string;
  name: string;
  description: string;
  code: string;
  preview: string;
  features?: string[];
}

const generationSteps: GenerationStep[] = [
  {
    id: '1',
    title: '需求分析',
    description: '理解用户需求并分析目标网站类型',
    status: 'pending',
    icon: Search
  },
  {
    id: '2', 
    title: '架构设计',
    description: '设计网站结构和用户体验流程',
    status: 'pending',
    icon: Layout
  },
  {
    id: '3',
    title: '样式生成',
    description: '创建现代化的视觉设计和样式',
    status: 'pending',
    icon: Palette
  },
  {
    id: '4',
    title: '代码编写',
    description: '生成高质量的HTML、CSS和JavaScript代码',
    status: 'pending',
    icon: FileCode
  },
  {
    id: '5',
    title: '优化测试',
    description: '优化性能和响应式适配',
    status: 'pending',
    icon: Zap
  }
];

const sampleWebsites = [
  {
    id: '1',
    name: '现代企业官网',
    description: '专业的企业门户网站，包含公司介绍、服务展示和联系方式',
    features: ['响应式设计', '现代化UI', '联系表单', 'SEO优化'],
    code: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>创新科技 - 企业官网</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
        .hero { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 100px 0; 
            text-align: center;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .hero h1 { font-size: 3.5rem; margin-bottom: 20px; font-weight: 700; }
        .hero p { font-size: 1.2rem; margin-bottom: 30px; opacity: 0.9; }
        .btn { 
            background: #4CAF50; 
            color: white; 
            padding: 15px 40px; 
            border: none; 
            border-radius: 50px; 
            cursor: pointer; 
            font-size: 1.1rem;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
        }
        .btn:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 8px 25px rgba(76, 175, 80, 0.4);
        }
        .services {
            padding: 80px 0;
            background: #f8f9fa;
        }
        .service-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-top: 50px;
        }
        .service-card {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.3s ease;
        }
        .service-card:hover {
            transform: translateY(-10px);
        }
        @media (max-width: 768px) {
            .hero h1 { font-size: 2.5rem; }
            .hero p { font-size: 1rem; }
            .service-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <section class="hero">
        <div class="container">
            <h1>创新科技，引领未来</h1>
            <p>专业的技术解决方案提供商，为您的业务提供最优质的服务</p>
            <button class="btn">了解更多</button>
        </div>
    </section>
    <section class="services">
        <div class="container">
            <h2 style="text-align: center; font-size: 2.5rem; margin-bottom: 20px;">我们的服务</h2>
            <p style="text-align: center; font-size: 1.1rem; color: #666; margin-bottom: 50px;">提供全方位的技术解决方案</p>
            <div class="service-grid">
                <div class="service-card">
                    <h3>网站开发</h3>
                    <p>现代化的网站设计与开发</p>
                </div>
                <div class="service-card">
                    <h3>移动应用</h3>
                    <p>跨平台移动应用解决方案</p>
                </div>
                <div class="service-card">
                    <h3>云服务</h3>
                    <p>可扩展的云计算服务</p>
                </div>
            </div>
        </div>
    </section>
</body>
</html>`,
    preview: '/api/placeholder/400/300'
  }
];

export function AIEditor() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: '您好！我是您的AI网站生成助手。请告诉我您想要创建什么类型的网站，我会为您生成专业的代码和设计。',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentWebsite, setCurrentWebsite] = useState<GeneratedWebsite | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [currentSteps, setCurrentSteps] = useState<GenerationStep[]>(generationSteps);
  const [showSteps, setShowSteps] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input;
    setInput('');
    setIsGenerating(true);
    setShowSteps(true);

    // 重置步骤状态
    const resetSteps = generationSteps.map(step => ({ ...step, status: 'pending' as const }));
    setCurrentSteps(resetSteps);

    // 模拟AI思考过程
    const thinkingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: '正在分析您的需求并生成网站...',
      timestamp: new Date(),
      generating: true
    };

    setMessages(prev => [...prev, thinkingMessage]);

    // 逐步执行生成过程
    for (let i = 0; i < generationSteps.length; i++) {
      // 激活当前步骤
      setCurrentSteps(prev => prev.map((step, index) => ({
        ...step,
        status: index === i ? 'active' : index < i ? 'completed' : 'pending'
      })));

      // 等待每步完成
      await new Promise(resolve => setTimeout(resolve, 800));

      // 完成当前步骤
      setCurrentSteps(prev => prev.map((step, index) => ({
        ...step,
        status: index <= i ? 'completed' : 'pending'
      })));

      await new Promise(resolve => setTimeout(resolve, 400));
    }

    // 隐藏步骤并显示结果
    setTimeout(() => {
      setShowSteps(false);
      
      // 移除思考消息，添加结果
      setMessages(prev => prev.filter(m => m.id !== thinkingMessage.id));

      const aiResponse: Message = {
        id: (Date.now() + 2).toString(),
        type: 'ai',
        content: `基于您的需求"${userInput}"，我已经为您生成了一个专业的网站。这个网站包含了现代化的设计、响应式布局和优化的用户体验。您可以在右侧预览效果，或者继续与我对话来优化设计。`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiResponse]);
      setCurrentWebsite(sampleWebsites[0]);
      setIsGenerating(false);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getPreviewSize = () => {
    switch (previewMode) {
      case 'mobile':
        return 'w-80 h-[600px]';
      case 'tablet':
        return 'w-[600px] h-[750px]';
      default:
        return 'w-full h-full max-w-6xl';
    }
  };

  return (
    <div className="h-full flex bg-background">
      {/* Chat Panel */}
      <div className="w-1/2 border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold">AI 网站生成器</h2>
                <p className="text-xs text-muted-foreground">Beta</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Version 1
              </Badge>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'ai' && (
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600">
                      <Bot className="w-4 h-4 text-white" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground ml-12'
                      : 'bg-muted'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  {message.generating && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-muted-foreground/20">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full"
                      />
                      <span className="text-sm text-muted-foreground">正在生成中...</span>
                    </div>
                  )}
                  <div className="text-xs opacity-60 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                {message.type === 'user' && (
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </motion.div>
            ))}

            {/* Generation Steps */}
            <AnimatePresence>
              {showSteps && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex gap-3"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600">
                      <Bot className="w-4 h-4 text-white" />
                    </AvatarFallback>
                  </Avatar>
                  <Card className="max-w-[75%] w-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">正在生成您的网站...</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {currentSteps.map((step, index) => {
                        const Icon = step.icon;
                        return (
                          <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                              step.status === 'active' ? 'bg-blue-50 border-blue-200' :
                              step.status === 'completed' ? 'bg-green-50 border-green-200' :
                              'bg-muted/50 border-muted'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              step.status === 'active' ? 'bg-blue-500' :
                              step.status === 'completed' ? 'bg-green-500' :
                              'bg-muted-foreground/30'
                            }`}>
                              {step.status === 'completed' ? (
                                <CheckCircle className="w-4 h-4 text-white" />
                              ) : step.status === 'active' ? (
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                  <Icon className="w-3 h-3 text-white" />
                                </motion.div>
                              ) : (
                                <Icon className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${
                                step.status === 'active' ? 'text-blue-700' :
                                step.status === 'completed' ? 'text-green-700' :
                                'text-muted-foreground'
                              }`}>{step.title}</p>
                              <p className="text-xs text-muted-foreground">{step.description}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-muted/20">
          {!currentWebsite && messages.length <= 1 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-3 text-muted-foreground">快速开始：</p>
              <div className="grid gap-2">
                {[
                  "创建一个现代化的餐厅官网，包含菜单展示和在线预订功能",
                  "设计一个科技公司的产品展示页面，突出创新和专业性",
                  "制作一个个人作品集网站，展示设计作品和技能"
                ].map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="justify-start h-auto p-3 text-left whitespace-normal text-wrap"
                    onClick={() => setInput(suggestion)}
                    disabled={isGenerating}
                  >
                    <Lightbulb className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{suggestion}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="描述您想要创建的网站，例如：创建一个现代化的餐厅官网，包含菜单展示和在线预订功能..."
              className="min-h-[80px] resize-none border-0 bg-background shadow-sm"
              disabled={isGenerating}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              size="lg"
              className="px-6 h-auto"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>按 Enter 发送，Shift+Enter 换行</span>
            <span>{input.length}/2000</span>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="w-1/2 flex flex-col bg-muted/10">
        {/* Preview Header */}
        <div className="p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-medium">预览</h3>
              </div>
              {currentWebsite && (
                <Badge variant="outline" className="gap-2">
                  <Globe className="w-3 h-3" />
                  {currentWebsite.name}
                </Badge>
              )}
            </div>
            
            {currentWebsite && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  导出
                </Button>
                <Button size="sm" className="gap-2">
                  <Save className="w-4 h-4" />
                  保存
                </Button>
              </div>
            )}
          </div>

          {currentWebsite && (
            <div className="flex items-center justify-between">
              {/* Tab Controls */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'code')} className="w-auto">
                <TabsList className="grid w-auto grid-cols-2">
                  <TabsTrigger value="preview" className="gap-2">
                    <Eye className="w-4 h-4" />
                    预览
                  </TabsTrigger>
                  <TabsTrigger value="code" className="gap-2">
                    <Code className="w-4 h-4" />
                    代码
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Responsive Controls - Only show in preview mode */}
              {activeTab === 'preview' && (
                <div className="flex items-center gap-1 p-1 bg-muted rounded-lg border">
                  <Button
                    variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPreviewMode('desktop')}
                  >
                    <Monitor className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={previewMode === 'tablet' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPreviewMode('tablet')}
                  >
                    <Tablet className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPreviewMode('mobile')}
                  >
                    <Smartphone className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview Content */}
        <div className="flex-1 p-4">
          {currentWebsite ? (
            <Tabs value={activeTab} className="h-full">
              <TabsContent value="preview" className="h-full m-0">
                <div className="h-full flex items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className={`bg-white rounded-xl shadow-2xl overflow-hidden border ${getPreviewSize()}`}
                  >
                    <div className="w-full h-8 bg-gray-100 border-b flex items-center px-4 gap-2">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      <div className="flex-1 text-center">
                        <span className="text-xs text-gray-500">localhost:3000</span>
                      </div>
                    </div>
                    <iframe
                      srcDoc={currentWebsite.code}
                      className="w-full h-[calc(100%-2rem)] border-0"
                      title="Website Preview"
                    />
                  </motion.div>
                </div>
              </TabsContent>
              
              <TabsContent value="code" className="h-full m-0">
                <div className="h-full">
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">生成的代码</CardTitle>
                        <div className="flex items-center gap-2">
                          {currentWebsite.features && (
                            <div className="flex gap-1">
                              {currentWebsite.features.slice(0, 3).map((feature, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {feature}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {currentWebsite.description && (
                        <p className="text-sm text-muted-foreground">{currentWebsite.description}</p>
                      )}
                    </CardHeader>
                    <CardContent className="h-[calc(100%-8rem)] p-0">
                      <ScrollArea className="h-full">
                        <pre className="p-4 text-sm bg-muted/50 rounded-none">
                          <code className="language-html">{currentWebsite.code}</code>
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="h-full flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-6 max-w-md"
              >
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold">为什么选择我们的AI生成器？</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    使用人工智能技术，只需简单描述就能创建专业级的网页
                  </p>
                </div>
                <div className="grid gap-4 text-sm">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Zap className="w-4 h-4 text-green-600" />
                    </div>
                    <span>快速生成</span>
                  </div>
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Palette className="w-4 h-4 text-blue-600" />
                    </div>
                    <span>智能设计</span>
                  </div>
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Globe className="w-4 h-4 text-purple-600" />
                    </div>
                    <span>响应式布局</span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}