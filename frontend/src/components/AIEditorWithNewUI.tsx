import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Button } from './ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LoadingSpinner } from './LoadingSpinner';
import AIAssistantModern from './AIAssistantModern';
import { CodeEditor } from './CodeEditor';
import { StaticPreviewPlaceholder, StaticCodePlaceholder, GenerationAnimation } from './StaticPlaceholder';
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
  // 移除悬浮代码窗口，改为对话内滚动展示，并实时同步到右侧代码模块
  
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
    return ''; // 返回空字符串，不使用默认示例代码
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
    // 实时同步到右侧代码模块
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

  // 已移除悬浮代码生成窗口相关逻辑

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
    <div className="h-full min-h-0 flex bg-white">
      {/* Left Panel - AI Chat */}
      <div className="w-96 border-r border-gray-200 flex flex-col min-h-0">
        <AIAssistantModern
          onCodeUpdate={handleCodeUpdate}
          onGenerationStart={handleGenerationStart}
          onGenerationEnd={handleGenerationEnd}
          className="h-full"
          projectName={currentWebsite?.title || `编号001-未命名`}
          onProjectNameChange={(name) => {
            // TODO: 实现项目名称更新逻辑
            console.log('项目名称更新:', name);
          }}
        />
      </div>

      {/* Right Panel - Preview/Code */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header aligned with AI panel height */}
        <div className="border-b border-gray-200 h-[72px] p-4 flex items-center">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full">
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

              {/* 中间：页面尺寸选择（居中对齐） */}
              <div className="justify-self-center">
                <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1">
                  <Button
                    variant={deviceMode === 'desktop' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDeviceMode('desktop')}
                    className="h-8 w-8 p-0"
                  >
                    <Monitor className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={deviceMode === 'tablet' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDeviceMode('tablet')}
                    className="h-8 w-8 p-0"
                  >
                    <Tablet className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={deviceMode === 'mobile' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDeviceMode('mobile')}
                    className="h-8 w-8 p-0"
                  >
                    <Smartphone className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* 右侧：下载/保存（靠右对齐） */}
              <div className="flex items-center gap-2 justify-self-end">
                <Button variant="outline" size="sm" className="border-gray-200">
                  <Download className="w-4 h-4 mr-2" />
                  下载
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isUpdating} 
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
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

        <div className="flex-1 min-h-0 overflow-hidden bg-white">
          <Tabs value={viewMode} className="h-full">
            <TabsContent value="preview" className="h-full p-0 m-0">
              <div className="h-full w-full overflow-hidden">
                {isGenerating ? (
                  // 生成时显示动画
                  <GenerationAnimation />
                ) : content ? (
                  // 有内容时显示iframe预览 - 无外框
                  <div className={`w-full h-full transition-all duration-300`}>
                    <iframe
                      srcDoc={content}
                      className="w-full h-full border-0"
                      title="网站预览"
                    />
                  </div>
                ) : (
                  // 无内容时显示静态占位符
                  <StaticPreviewPlaceholder />
                )}
              </div>
            </TabsContent>
            <TabsContent value="code" className="h-full p-4 m-0">
              <div className="h-full overflow-auto code-scroll">
                {content ? (
                  // 有内容时显示代码编辑器
                  <div className="h-full border border-gray-200 rounded-lg overflow-hidden">
                    <CodeEditor
                      value={content}
                      onChange={handleContentChange}
                      language="html"
                      theme="traditional"
                      readOnly={false}
                      minimap={true}
                      lineNumbers="on"
                      height="100%"
                    />
                  </div>
                ) : (
                  // 无内容时显示静态占位符
                  <StaticCodePlaceholder />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* 代码生成浮动窗口 */}
      {/* 已移除悬浮代码窗口，滚动展示在对话区域内实现 */}
    </div>
  );
}
