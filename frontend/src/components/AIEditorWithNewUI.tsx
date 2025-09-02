import React, { useState, useEffect, useRef } from 'react';
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
import { uploadsService, aiService } from '@/services/api';
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
  // 获取网站ID：优先URL /editor/[id]，否则从localStorage回退
  const currentPath = window.location.pathname;
  const pathParts = currentPath.split('/');
  const idFromPath = pathParts[2];
  const id = idFromPath || (typeof window !== 'undefined' ? localStorage.getItem('editing-website-id') || '' : '');
  
  const { navigate } = useRouter();
  const [content, setContent] = useState('');
  const [projectTitle, setProjectTitle] = useState<string>('编号001-未命名');
  const [initialChat, setInitialChat] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string | Date }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{progress: number, stage: string}>({progress: 0, stage: ''});
  const [isGenerating, setIsGenerating] = useState(false);
  const [directEdit, setDirectEdit] = useState(false);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const inputTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
          setProjectTitle(website.title || '编号001-未命名');
          // 载入最新对话记录（如有）
          try {
            const convs = (website as any).conversations || [];
            if (convs.length > 0) {
              const convId = convs[0]?.id;
              if (convId) {
                const conv = await aiService.getConversation(convId);
                const msgs = (conv.data?.data as any)?.messages || [];
                const mapped = msgs
                  .map((m: any) => {
                    const role = String(m.role || '').toLowerCase();
                    if (role !== 'user' && role !== 'assistant') return null;
                    return { role, content: String(m.content || ''), timestamp: m.createdAt } as {
                      role: 'user' | 'assistant';
                      content: string;
                      timestamp?: string | Date;
                    };
                  })
                  .filter(Boolean) as Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string | Date }>;
                setInitialChat(mapped);
              } else {
                setInitialChat([]);
              }
            } else {
              setInitialChat([]);
            }
          } catch (e) {
            setInitialChat([]);
          }
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
        setProjectTitle('编号001-未命名');
        setInitialChat([]);
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
          title: projectTitle || '新网站',
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

  // 直改模式：对预览iframe注入可编辑与选择事件
  useEffect(() => {
    if (viewMode !== 'preview') return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const enable = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        // 开启可编辑
        (doc.body as any).contentEditable = 'true';
        (doc.body as any).style.caretColor = '#2563eb';
        // 高亮被点击的图片
        const onClick = (e: any) => {
          const target = e.target as HTMLElement;
          if (target && target.tagName === 'IMG') {
            setSelectedImg(target as HTMLImageElement);
            (target as HTMLImageElement).style.outline = '2px solid #22c55e';
            setTimeout(() => { if (target) (target as HTMLImageElement).style.outline = ''; }, 1200);
          }
        };
        // 监听文本编辑，节流同步到右侧代码
        const onInput = () => {
          if (inputTimerRef.current) window.clearTimeout(inputTimerRef.current);
          inputTimerRef.current = window.setTimeout(() => {
            try {
              const html = doc.documentElement.outerHTML;
              setContent(html);
            } catch {}
          }, 250) as unknown as number;
        };
        doc.addEventListener('click', onClick);
        doc.addEventListener('input', onInput, true);

        cleanupRef.current = () => {
          try {
            (doc.body as any).contentEditable = 'false';
            doc.removeEventListener('click', onClick);
            doc.removeEventListener('input', onInput, true);
            if (inputTimerRef.current) window.clearTimeout(inputTimerRef.current);
          } catch {}
        };
      } catch {}
    };

    if (directEdit) {
      // 如果iframe已加载，则立即启用；否则等待load
      if (iframe.contentDocument?.readyState === 'complete') enable();
      else iframe.addEventListener('load', enable, { once: true });
    } else {
      cleanupRef.current?.();
      cleanupRef.current = null;
      setSelectedImg(null);
    }

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [directEdit, viewMode]);

  // 在视图从预览切换到代码时，同步一次iframe到content，确保代码视图拿到最新直改结果
  useEffect(() => {
    if (viewMode === 'code' && iframeRef.current?.contentDocument) {
      try {
        const html = iframeRef.current.contentDocument.documentElement.outerHTML;
        if (html) setContent(html);
      } catch {}
    }
  }, [viewMode]);

  const handleReplaceImage = async (file: File) => {
    if (!selectedImg) return;
    try {
      const res = await uploadsService.uploadFile(file);
      const url = (res.data as any)?.data?.file?.url || (res.data as any)?.data?.url || '';
      if (!url) return;
      // 替换iframe中的图片
      selectedImg.src = url;
      // 同步回到content
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const html = doc.documentElement.outerHTML;
        setContent(html);
      }
    } catch (e) {
      // ignore
    }
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
          projectName={projectTitle}
          initialMessages={initialChat}
          websiteId={id}
          onProjectNameChange={async (name) => {
            const finalName = (name || '').trim() || '未命名';
            setProjectTitle(finalName);
            if (currentWebsite) {
              try {
                await updateWebsite(currentWebsite.id, { title: finalName });
                toast.success('项目名称已更新');
              } catch {
                toast.error('更新项目名称失败');
              }
            } else {
              // 尚未创建网站，先更新本地标题，待首次保存时写入
              toast.success('将于首次保存时一并保存项目名称');
            }
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
                {viewMode === 'preview' && (
                  <>
                    <Button variant={directEdit ? 'default' : 'outline'} size="sm" onClick={() => setDirectEdit(v => !v)}>
                      {directEdit ? '退出直改' : '开启直改'}
                    </Button>
                    {directEdit && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleReplaceImage(f);
                            // reset input so the same file can be selected again
                            if (e.target) (e.target as HTMLInputElement).value = '';
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!selectedImg}
                          title={selectedImg ? '选择图片替换当前选中图片' : '请先点击页面中的图片以选中'}
                        >
                          替换选中图片
                        </Button>
                      </>
                    )}
                  </>
                )}
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
                    <iframe ref={iframeRef} srcDoc={content} className="w-full h-full border-0" title="网站预览" />
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
