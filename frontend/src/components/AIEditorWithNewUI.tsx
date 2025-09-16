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
import { templateSDK, type TemplateDTO } from '@/services/templateSDK';
import { downloadTemplateZip } from '@/utils/templateDownload';

type ViewMode = 'preview' | 'code';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

interface ComposeItem {
  key: string;
  slug: string;
  name: string;
  data: any;
  schema?: any;
  templateId?: string;
}

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
  const [composeOpen, setComposeOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [composeThemeSlug, setComposeThemeSlug] = useState<string>('');
  const [pageOptions, setPageOptions] = useState<TemplateDTO[]>([]);
  const [compOptions, setCompOptions] = useState<TemplateDTO[]>([]);
  const [themeOptions, setThemeOptions] = useState<TemplateDTO[]>([]);
  const [composePage, setComposePage] = useState<TemplateDTO | null>(null);
  const [composePageData, setComposePageData] = useState<Record<string, any>>({});
  const [composeComponentsState, setComposeComponentsState] = useState<ComposeItem[]>([]);
  const [componentSearch, setComponentSearch] = useState('');
  const [composePreviewLoading, setComposePreviewLoading] = useState(false);
  const [composeError, setComposeError] = useState('');
  const composeRequestRef = useRef(0);
  const [lastExportTemplateId, setLastExportTemplateId] = useState<string | null>(null);
  const [lastExportTemplateSlug, setLastExportTemplateSlug] = useState<string>('');

  useEffect(() => {
    if (!composeOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const pages = await templateSDK.search({ type: 'page', limit: 50 });
        if (!cancelled) {
          const list = pages.items || [];
          setPageOptions(list);
          if (!composePage && list.length) {
            setComposePage(list[0]);
            setComposePageData(buildDefaultData(list[0].schemaJson));
          }
        }
      } catch {}
      try {
        const comps = await templateSDK.search({ type: 'component', limit: 120 });
        if (!cancelled) setCompOptions(comps.items || []);
      } catch {}
      try {
        const th = await templateSDK.search({ type: 'theme', limit: 50 });
        if (!cancelled) {
          setThemeOptions(th.items || []);
          if (!composeThemeSlug && th.items && th.items.length) setComposeThemeSlug(th.items[0].slug);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [composeOpen, composePage, composeThemeSlug]);
  
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

  const addComponentToCompose = (tpl: TemplateDTO) => {
    setComposeComponentsState(prev => {
      const exists = prev.find(item => item.slug === tpl.slug && item.templateId === tpl.id);
      const key = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `comp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
      const data = buildDefaultData(tpl.schemaJson);
      const next: ComposeItem = {
        key,
        slug: tpl.slug,
        name: tpl.name || tpl.slug,
        data,
        schema: tpl.schemaJson,
        templateId: tpl.id,
      };
      return exists ? [...prev, { ...next, slug: `${tpl.slug}-${key.slice(0,4)}` }] : [...prev, next];
    });
  };

  const updateComponentOrder = (key: string, delta: number) => {
    setComposeComponentsState(prev => {
      const index = prev.findIndex(item => item.key === key);
      if (index === -1) return prev;
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const removeComponentFromCompose = (key: string) => {
    setComposeComponentsState(prev => prev.filter(item => item.key !== key));
  };

  const updateComponentData = (key: string, data: any) => {
    setComposeComponentsState(prev => prev.map(item => (item.key === key ? { ...item, data } : item)));
  };

  const handleExportTemplate = async () => {
    try {
      if (!lastExportTemplateId) throw new Error('请先组合页面模板以生成可导出的版本');
      await downloadTemplateZip(lastExportTemplateId, lastExportTemplateSlug || 'template');
      toast.success('已开始下载模板 ZIP');
    } catch (err: any) {
      toast.error(err?.message || '导出失败');
    }
  };

  // 若未保存过网站，构造一个保存流程
  const ensureWebsiteSaved = async () => {
    if (currentWebsite?.id) return currentWebsite.id;
    const title = projectTitle || '新网站';
    const domain = `site-${Date.now()}.com`;
    const newWebsite = await createWebsite({ title, description: '通过AI编辑器创建', domain });
    await updateWebsite(newWebsite.id, { content });
    try { localStorage.setItem('editing-website-id', newWebsite.id); } catch {}
    window.history.pushState({}, '', `/editor/${newWebsite.id}`);
    return newWebsite.id;
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

  useEffect(() => {
    if (!composeOpen) return;
    if (!composePage?.slug) return;
    const current = ++composeRequestRef.current;
    setComposePreviewLoading(true);
    (async () => {
      try {
        const body = {
          page: { slug: composePage.slug, data: composePageData },
          components: composeComponentsState.map((item, idx) => ({
            slot: item.slug || `slot-${idx}`,
            slug: item.slug,
            data: item.data,
          })),
          theme: composeThemeSlug || undefined,
        };
        const result = await templateSDK.compose(body);
        if (composeRequestRef.current === current) {
          setContent(result.html);
          setViewMode('preview');
          setComposeError('');
          if (composePage.id) {
            setLastExportTemplateId(composePage.id);
            setLastExportTemplateSlug(composePage.slug);
          }
        }
      } catch (err: any) {
        if (composeRequestRef.current === current) {
          setComposeError(err?.message || '组合预览失败');
        }
      } finally {
        if (composeRequestRef.current === current) {
          setComposePreviewLoading(false);
        }
      }
    })();
  }, [composeOpen, composePage, composeComponentsState, composePageData, composeThemeSlug]);

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
                <Button variant="outline" size="sm" onClick={() => setComposeOpen(true)}>
                  从模板组合预览
                </Button>
                <Button variant="outline" size="sm" onClick={async () => { const savedId = await ensureWebsiteSaved(); setBuildOpen(true); }}>
                  构建并预览
                </Button>
                <Button variant="outline" size="sm" className="border-gray-200" onClick={handleExportTemplate} disabled={!lastExportTemplateId}>
                  <Download className="w-4 h-4 mr-2" />
                  导出 ZIP
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

      <div className="flex-1 min-h-0 overflow-auto bg-white">
          <Tabs value={viewMode} className="h-full flex flex-col min-h-0">
            <TabsContent value="preview" className="flex-1 min-h-0 p-0 m-0">
              <div className="h-full w-full overflow-auto">
                {isGenerating ? (
                  // 生成时显示动画
                  <GenerationAnimation />
                ) : content ? (
                  // 有内容时显示iframe预览 - 无外框
                  <div className={`w-full h-full transition-all duration-300`}>
                    <iframe ref={iframeRef} srcDoc={buildPreviewDoc(content)} className="w-full h-full border-0 block bg-white" title="网站预览" />
                  </div>
                ) : (
                  // 无内容时显示静态占位符
                  <StaticPreviewPlaceholder />
                )}
              </div>
            </TabsContent>
            <TabsContent value="code" className="flex-1 min-h-0 p-4 m-0">
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
        {composeOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setComposeOpen(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 overflow-y-auto max-h-[90vh]" onClick={(e)=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-lg font-medium">模板组合预览</div>
                  <div className="text-xs text-gray-500">选择页面与组件，实时生成预览</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setComposeOpen(false)}>关闭</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm mb-1">页面模板</label>
                    <select
                      value={composePage?.slug || ''}
                      onChange={(e) => {
                        const slug = e.target.value;
                        const tpl = pageOptions.find(p => p.slug === slug) || null;
                        setComposePage(tpl);
                        setComposePageData(buildDefaultData(tpl?.schemaJson));
                      }}
                      className="border rounded px-3 py-2 w-full"
                    >
                      <option value="">请选择页面模板</option>
                      {pageOptions.map(p => (
                        <option key={p.id} value={p.slug}>{p.name || p.slug}</option>
                      ))}
                    </select>
                  </div>
                  {composePage?.schemaJson && (
                    <div className="border rounded p-3">
                      <div className="text-sm font-medium mb-2">页面数据</div>
                      <SchemaEditor
                        schema={composePage.schemaJson}
                        value={composePageData}
                        onChange={setComposePageData}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm mb-1">主题（可选）</label>
                    <select value={composeThemeSlug} onChange={e=>setComposeThemeSlug(e.target.value)} className="border rounded px-3 py-2 w-full">
                      <option value="">使用默认主题</option>
                      {themeOptions.map(t => (
                        <option key={t.id} value={t.slug}>{t.name || t.slug}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm mb-1">添加组件</label>
                    <input
                      value={componentSearch}
                      onChange={e=>setComponentSearch(e.target.value)}
                      className="border rounded px-3 py-2 w-full"
                      placeholder="搜索组件名称或 slug"
                    />
                  </div>
                  <div className="max-h-64 overflow-auto border rounded p-2 space-y-1">
                    {compOptions
                      .filter(c => {
                        if (!componentSearch) return true;
                        const keyword = componentSearch.toLowerCase();
                        return (c.slug || '').toLowerCase().includes(keyword) || (c.name || '').toLowerCase().includes(keyword);
                      })
                      .map(c => (
                        <div key={c.id} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                          <div className="truncate" title={c.slug}>{c.name || c.slug}</div>
                          <Button variant="ghost" size="sm" onClick={() => addComponentToCompose(c)}>添加</Button>
                        </div>
                      ))}
                    {compOptions.length === 0 && (
                      <div className="text-xs text-gray-500">暂无组件，请先导入 ZIP</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">已选组件</div>
                  {composePreviewLoading && <div className="text-xs text-blue-600">生成预览中…</div>}
                </div>
                {composeError && <div className="text-xs text-red-500">{composeError}</div>}
                {composeComponentsState.length === 0 && (
                  <div className="text-xs text-gray-500 border border-dashed border-gray-200 rounded p-4 text-center">尚未选择组件</div>
                )}
                <div className="space-y-3">
                  {composeComponentsState.map((item, index) => (
                    <div key={item.key} className="border rounded p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.slug}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => updateComponentOrder(item.key, -1)} disabled={index === 0}>上移</Button>
                          <Button variant="ghost" size="sm" onClick={() => updateComponentOrder(item.key, 1)} disabled={index === composeComponentsState.length - 1}>下移</Button>
                          <Button variant="ghost" size="sm" onClick={() => removeComponentFromCompose(item.key)}>删除</Button>
                        </div>
                      </div>
                      {item.schema ? (
                        <SchemaEditor
                          schema={item.schema}
                          value={item.data}
                          onChange={(val) => updateComponentData(item.key, val)}
                        />
                      ) : (
                        <div className="text-xs text-gray-500">该组件无结构化 schema</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {buildOpen && (
          <BuildPreviewModal
            html={content}
            websiteId={id}
            onClose={() => setBuildOpen(false)}
          />
        )}
      </div>

      {/* 代码生成浮动窗口 */}
      {/* 已移除悬浮代码窗口，滚动展示在对话区域内实现 */}
    </div>
  );
}

function buildDefaultData(schema?: any): any {
  if (!schema) return {};
  if (schema.default !== undefined) return schema.default;
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case 'object': {
      const props = schema.properties || {};
      const result: Record<string, any> = {};
      Object.keys(props).forEach((key) => {
        result[key] = buildDefaultData(props[key]);
      });
      return result;
    }
    case 'array': {
      const itemSchema = schema.items || { type: 'string' };
      if (itemSchema.type === 'object') {
        return [buildDefaultData(itemSchema)];
      }
      return [];
    }
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'string':
      return '';
    default:
      return {};
  }
}

interface SchemaEditorProps {
  schema: any;
  value: any;
  onChange: (value: any) => void;
}

function SchemaEditor({ schema, value, onChange }: SchemaEditorProps) {
  return <div className="space-y-2">{renderSchemaFields(schema, value, onChange)}</div>;
}

function renderSchemaFields(schema: any, value: any, onChange: (value: any) => void, path = ''): React.ReactNode {
  if (!schema) return null;
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (type === 'object') {
    const props = schema.properties || {};
    const current = (value && typeof value === 'object') ? value : {};
    return Object.keys(props).map((key) => {
      const childSchema = props[key];
      const childValue = current[key] ?? buildDefaultData(childSchema);
      const handleChildChange = (val: any) => {
        onChange({ ...current, [key]: val });
      };
      return (
        <div key={`${path}.${key}`} className="space-y-1">
          <label className="text-xs text-gray-600">{childSchema?.title || key}</label>
          {renderSchemaFields(childSchema, childValue, handleChildChange, `${path}.${key}`)}
        </div>
      );
    });
  }
  if (type === 'array') {
    const itemsSchema = schema.items || { type: 'string' };
    const currentArray = Array.isArray(value) ? value : buildDefaultData(schema);
    if (itemsSchema.type === 'object') {
      return (
        <textarea
          className="w-full border rounded px-2 py-1 text-xs font-mono"
          rows={4}
          value={JSON.stringify(currentArray, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value || '[]');
              onChange(Array.isArray(parsed) ? parsed : currentArray);
            } catch {
              onChange(currentArray);
            }
          }}
        />
      );
    }
    return (
      <textarea
        className="w-full border rounded px-2 py-1 text-xs font-mono"
        rows={3}
        value={(currentArray || []).join('\n')}
        onChange={(e) => {
          const lines = e.target.value.split(/\n+/).map(line => line.trim()).filter(Boolean);
          onChange(lines);
        }}
      />
    );
  }
  if (type === 'boolean') {
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
        <span>{schema.description || '启用'}</span>
      </label>
    );
  }
  if (type === 'number' || type === 'integer') {
    return (
      <input
        type="number"
        className="border rounded px-2 py-1 w-full text-sm"
        value={value ?? 0}
        onChange={e => onChange(Number(e.target.value))}
      />
    );
  }
  if (schema.enum && Array.isArray(schema.enum)) {
    return (
      <select
        className="border rounded px-2 py-1 w-full text-sm"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">请选择</option>
        {schema.enum.map((opt: any) => (
          <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      className="border rounded px-2 py-1 w-full text-sm"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={schema.description || ''}
    />
  );
}

function buildPreviewDoc(input: string) {
  const baseStyle = '<style>html,body{margin:0!important;padding:0!important;background:#fff;}body{padding-top:8px !important;}*{box-sizing:border-box;}</style>';
  const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1" />';
  try {
    const hasHtml = /<html[\s>]/i.test(input);
    const hasHead = /<head[\s>]/i.test(input);
    if (hasHtml) {
      // 在 </head> 前注入基础样式与 viewport；若无 <head>，插入一个
      if (hasHead) {
        return input.replace(/<head(.*?)>/i, (m) => `${m}${viewport}${baseStyle}`);
      }
      return input.replace(/<html(.*?)>/i, (m) => `${m}<head>${viewport}${baseStyle}</head>`);
    }
    // 非完整文档，包裹骨架
    return `<!DOCTYPE html><html lang="zh-CN"><head>${viewport}${baseStyle}</head><body>${input}</body></html>`;
  } catch {
    return input;
  }
}

function BuildPreviewModal({ html, websiteId, onClose }: { html: string; websiteId: string; onClose: () => void }) {
  const [assetsBase, setAssetsBase] = React.useState('');
  const [fingerprint, setFingerprint] = React.useState(true);
  const [items, setItems] = React.useState<{from: string; to: string; enabled: boolean}[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // 解析 html 的资源引用，生成初始映射
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // 自动推断 assetsBase: 从第一个 /uploads/u_*/imp_*/ 前缀推断
      const anySrc = doc.querySelector('[src], [href]') as any;
      if (anySrc) {
        const val = anySrc.getAttribute('src') || anySrc.getAttribute('href');
        const m = val && val.match(/^(\/uploads\/u_[^/]+\/imp_[^/]+\/)?.*$/);
        if (m && m[1]) setAssetsBase(m[1]);
      }
      const refs = new Set<string>();
      doc.querySelectorAll('link[rel="stylesheet"][href], script[src], img[src]').forEach((el) => {
        const attr = (el as HTMLLinkElement).href ? 'href' : 'src';
        const val = (el as any).getAttribute(attr);
        if (!val) return;
        if (/^https?:/i.test(val) || /^data:/i.test(val)) return; // 忽略外链
        refs.add(val);
      });
      const list: {from:string; to:string; enabled:boolean}[] = [];
      refs.forEach((ref) => {
        if (ref.startsWith('/uploads/')) {
          list.push({ from: ref, to: ref.replace(/^\//,''), enabled: true });
        } else if (/^(static|assets)\//.test(ref)) {
          // 需要 assetsBase 拼接源路径
          list.push({ from: ref, to: ref, enabled: true });
        }
      });
      setItems(list);
    } catch {}
  }, [html]);

  const build = async () => {
    if (!websiteId) {
      alert('请先保存网站，生成网站ID后再构建');
      return;
    }
    setLoading(true);
    try {
      // 规范化 assets 列表，拼接 assetsBase
      const assets = items.filter(i=>i.enabled).map(i => ({
        from: i.from.startsWith('/uploads/') ? i.from : (assetsBase ? assetsBase.replace(/\/?$/,'/') + i.from : i.from),
        to: i.to,
      }));
      // 附加 Authorization
      let headers: any = { 'Content-Type': 'application/json' };
      try {
        const raw = localStorage.getItem('auth-storage');
        if (raw) {
          const obj = JSON.parse(raw);
          const token = obj?.state?.token;
          if (token) headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {}
      const res = await fetch(`/api/websites/${websiteId}/build-static`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pages: [{ path: 'index.html', rawHtml: html }],
          assets,
          sitemap: true,
          robots: true,
          fingerprint,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '构建失败');
      const url = data.previewUrl as string;
      if (url) window.open(url, '_blank');
      onClose();
    } catch (e:any) {
      alert(e?.message || '构建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-5" onClick={(e)=>e.stopPropagation()}>
        <div className="text-lg font-medium mb-3">构建并预览</div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm w-28">资源基准</label>
            <input value={assetsBase} onChange={e=>setAssetsBase(e.target.value)} className="flex-1 border rounded px-3 py-2" placeholder="例如：/uploads/u_用户ID/imp_xxxx/" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm w-28">指纹化</label>
            <input type="checkbox" checked={fingerprint} onChange={e=>setFingerprint(e.target.checked)} />
          </div>
          <div>
            <div className="text-sm mb-1">资源映射</div>
            <div className="max-h-60 overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 w-16">启用</th>
                    <th className="p-2">来源 from</th>
                    <th className="p-2">目标 to</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 text-center"><input type="checkbox" checked={it.enabled} onChange={e=>{
                        const next=[...items]; next[idx]={...it, enabled:e.target.checked}; setItems(next);
                      }} /></td>
                      <td className="p-2">
                        <input className="w-full border rounded px-2 py-1" value={it.from} onChange={e=>{
                          const next=[...items]; next[idx]={...it, from:e.target.value}; setItems(next);
                        }} />
                      </td>
                      <td className="p-2">
                        <input className="w-full border rounded px-2 py-1" value={it.to} onChange={e=>{
                          const next=[...items]; next[idx]={...it, to:e.target.value}; setItems(next);
                        }} />
                      </td>
                    </tr>
                  ))}
                  {items.length===0 && (
                    <tr><td colSpan={3} className="p-3 text-center text-gray-500">未发现可映射的资源（仅处理 /uploads/* 与 static/*, assets/*）</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={build} disabled={loading}>{loading? '构建中…' : '构建并打开预览'}</Button>
        </div>
      </div>
    </div>
  );
}
