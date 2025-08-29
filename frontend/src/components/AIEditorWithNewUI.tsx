import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LoadingSpinner } from './LoadingSpinner';
import AIAssistant from './AIAssistant';
import { useWebsiteStore } from '../store/websiteStore';
import { useRouter } from '../lib/router';
import { toast } from 'react-hot-toast';
import { Website } from '@/shared/types';
import {
  Code,
  Eye,
  Download,
  Save,
  Smartphone,
  Monitor,
  Tablet,
  Loader2
} from 'lucide-react';

type ViewMode = 'preview' | 'code';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export function AIEditorWithNewUI() {
  // Get current URL to extract website ID
  const currentPath = window.location.pathname;
  const pathParts = currentPath.split('/');
  const id = pathParts[2]; // /editor/[id] format
  
  const { navigate } = useRouter();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{progress: number, stage: string}>({progress: 0, stage: ''});
  const [isGenerating, setIsGenerating] = useState(false);
  
  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  
  const {
    currentWebsite,
    getWebsite,
    updateWebsite,
    createWebsite,
    setCurrentWebsite,
    isUpdating
  } = useWebsiteStore();

  const getDefaultHTML = () => {
    return `<!DOCTYPE html>
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
</html>`;
  };

  useEffect(() => {
    const loadWebsite = async () => {
      if (id) {
        try {
          setIsLoading(true);
          const website = await getWebsite(id);
          setContent(website.content || getDefaultHTML());
        } catch (error) {
          toast.error('加载网站失败');
          navigate('dashboard');
        } finally {
          setIsLoading(false);
        }
      } else {
        // New website
        setCurrentWebsite(null);
        setContent(getDefaultHTML());
      }
    };

    loadWebsite();
  }, [id, getWebsite, setCurrentWebsite, navigate]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleSave = async () => {
    try {
      if (currentWebsite) {
        await updateWebsite(currentWebsite.id, { content });
      } else {
        // Create new website
        const newWebsite = await createWebsite({
          title: '新网站',
          description: '用AI网站构建器创建',
          domain: `new-website-${Date.now()}.com`,
        });
        
        await updateWebsite(newWebsite.id, { content });
        // Update URL for new website
        window.history.pushState({}, '', `/editor/${newWebsite.id}`);
      }
    } catch (error) {
      toast.error('保存网站失败');
    }
  };

  // AI功能回调处理
  const handleCodeUpdate = (code: string) => {
    console.log('AIEditor: Code update received:', {
      codeLength: code?.length,
      preview: code?.substring(0, 100) + '...'
    });

    // 更新内容，让用户看到实时生成的代码
    setContent(code);
  };

  const handleGenerationStart = () => {
    console.log('AIEditor: Generation started');
    setIsGenerating(true);
    setGenerationProgress({ progress: 0, stage: '开始生成...' });
  };

  const handleGenerationEnd = () => {
    console.log('AIEditor: Generation ended');
    setIsGenerating(false);
    setGenerationProgress({ progress: 100, stage: '生成完成' });
  };

  const getViewportClasses = () => {
    switch (deviceMode) {
      case 'mobile':
        return 'w-[375px] h-[667px]';
      case 'tablet':
        return 'w-[768px] h-[600px]';
      default:
        return 'w-full h-full';
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">加载网站编辑器...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-background">
      {/* Left Panel - AI Chat */}
      <div className="w-1/3 border-r flex flex-col">
        <AIAssistant
          onCodeUpdate={handleCodeUpdate}
          onGenerationStart={handleGenerationStart}
          onGenerationEnd={handleGenerationEnd}
          className="h-full"
        />
      </div>

      {/* Right Panel - Preview/Code */}
      <div className="flex-1 flex flex-col">
        <div className="border-b bg-background/50 backdrop-blur-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)} className="w-auto">
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
                  variant={deviceMode === 'desktop' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setDeviceMode('desktop')}
                >
                  <Monitor className="w-4 h-4" />
                </Button>
                <Button
                  variant={deviceMode === 'tablet' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setDeviceMode('tablet')}
                >
                  <Tablet className="w-4 h-4" />
                </Button>
                <Button
                  variant={deviceMode === 'mobile' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setDeviceMode('mobile')}
                >
                  <Smartphone className="w-4 h-4" />
                </Button>
              </div>
              
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                下载
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isUpdating} 
                size="sm"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    保存
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-gray-50">
          <Tabs value={viewMode} className="h-full">
            <TabsContent value="preview" className="h-full p-4 m-0">
              <div className="h-full flex items-center justify-center">
                <div className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${getViewportClasses()}`}>
                  <iframe
                    srcDoc={content}
                    className="w-full h-full border-0"
                    title="网站预览"
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="code" className="h-full p-4 m-0">
              <div className="h-full">
                <textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="w-full h-full p-4 font-mono text-sm bg-white border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="HTML代码将在这里显示..."
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}