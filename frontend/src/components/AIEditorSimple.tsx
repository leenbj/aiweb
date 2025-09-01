import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { CodeEditor } from './CodeEditor';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAuth } from '../lib/auth';
import {
  Send,
  Sparkles,
  Code,
  Eye,
  Download,
  Save,
  Smartphone,
  Monitor,
  Tablet,
  RefreshCw,
  User,
  Bot,
  Zap,
  FileCode,
  Palette,
  Layout,
  Globe
} from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  generating?: boolean;
}

export function AIEditorSimple() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: '你好！我是AI网站生成助手。请告诉我你想要创建什么样的网站，我会为你生成专业的网站代码。',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI生成的网站</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        .hero { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 100px 20px;
        }
        .hero h1 { font-size: 3rem; margin-bottom: 1rem; }
        .hero p { font-size: 1.2rem; opacity: 0.9; }
        .container { max-width: 1200px; margin: 0 auto; padding: 50px 20px; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; }
        .feature { 
            padding: 30px;
            border-radius: 10px;
            background: #f8f9fa;
            text-align: center;
        }
        .feature h3 { margin-bottom: 15px; color: #333; }
        .btn { 
            background: #667eea;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 20px;
        }
        .btn:hover { background: #5a6fd8; }
    </style>
</head>
<body>
    <div class="hero">
        <h1>欢迎来到我的网站</h1>
        <p>这是一个由AI生成的现代化网站</p>
        <button class="btn">开始探索</button>
    </div>
    <div class="container">
        <div class="features">
            <div class="feature">
                <h3>现代设计</h3>
                <p>采用最新的设计趋势，为用户提供优秀的视觉体验</p>
            </div>
            <div class="feature">
                <h3>响应式布局</h3>
                <p>完美适配各种设备，从手机到桌面都有完美表现</p>
            </div>
            <div class="feature">
                <h3>高性能</h3>
                <p>优化的代码结构，确保快速的加载速度</p>
            </div>
        </div>
    </div>
</body>
</html>`);
  const [activeView, setActiveView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const handleSendMessage = () => {
    if (!inputValue.trim() || isGenerating) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsGenerating(true);

    // 模拟AI响应
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '好的，我正在为您生成网站。基于您的需求，我已经创建了一个现代化的响应式网站。您可以在右侧预览区域查看效果，并在代码标签页中查看生成的代码。',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setIsGenerating(false);
    }, 2000);
  };

  const getViewportClasses = () => {
    switch (activeView) {
      case 'mobile':
        return 'w-[375px] h-[667px]';
      case 'tablet':
        return 'w-[768px] h-[600px]';
      default:
        return 'w-full h-full';
    }
  };

  return (
    <div className="h-full flex bg-background">
      {/* Left Panel - Chat */}
      <div className="w-1/3 border-r flex flex-col">
        <div className="border-b bg-background/50 backdrop-blur-sm p-4">
            <div className="flex items-center gap-3">
              <Avatar variant="ai" size="md">
                <AvatarFallback variant="ai">
                  <Sparkles className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">AI 网站生成器</h3>
                <p className="text-sm text-muted-foreground">专业网站，一键生成</p>
              </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <Avatar 
                variant={message.type === 'ai' ? 'ai' : 'user'} 
                size="sm"
              >
                <AvatarFallback variant={message.type === 'ai' ? 'ai' : 'user'}>
                  {message.type === 'ai' ? (
                    <Bot className="w-3 h-3" />
                  ) : (
                    user?.email?.charAt(0).toUpperCase() || 'U'
                  )}
                </AvatarFallback>
              </Avatar>
              <div className={`flex-1 ${message.type === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block p-3 rounded-lg max-w-[80%] ${
                  message.type === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  <p className="text-sm">{message.content}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </motion.div>
          ))}
          
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <Avatar variant="ai" size="sm">
                <AvatarFallback variant="ai">
                  <Bot className="w-3 h-3" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="inline-block p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">正在生成网站...</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="描述您想要的网站..."
              className="resize-none"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isGenerating}
              size="sm"
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel - Preview/Code */}
      <div className="flex-1 flex flex-col">
        <div className="border-b bg-background/50 backdrop-blur-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <Tabs value="preview" className="w-auto">
                <TabsList>
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    预览
                  </TabsTrigger>
                  <TabsTrigger value="code" className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    代码
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={activeView === 'desktop' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveView('desktop')}
                >
                  <Monitor className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeView === 'tablet' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveView('tablet')}
                >
                  <Tablet className="w-4 h-4" />
                </Button>
                <Button
                  variant={activeView === 'mobile' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveView('mobile')}
                >
                  <Smartphone className="w-4 h-4" />
                </Button>
              </div>
              
              <Separator orientation="vertical" className="h-6" />
              
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                下载
              </Button>
              <Button size="sm">
                <Save className="w-4 h-4 mr-2" />
                保存
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 bg-white">
          <div className="h-full flex items-center justify-center">
            <div className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${getViewportClasses()}`}>
              <iframe
                srcDoc={generatedCode}
                className="w-full h-full border-0"
                title="网站预览"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
