import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Split } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { VisualEditor } from '../components/VisualEditor';
import { ResizableAIChat } from '../components/ResizableAIChat';
import { GenerationProgressBar } from '../components/ui/GenerationProgressBar';
import { useWebsiteStore } from '../store/websiteStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { Website } from '@/shared/types';

export const WebsiteEditor: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showAIChat, setShowAIChat] = useState(true);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{progress: number, stage: string}>({progress: 0, stage: ''});
  const [isGenerating, setIsGenerating] = useState(false);
  
  const {
    currentWebsite,
    getWebsite,
    updateWebsite,
    createWebsite,
    setCurrentWebsite,
    isUpdating
  } = useWebsiteStore();

  useEffect(() => {
    const loadWebsite = async () => {
      if (id) {
        try {
          setIsLoading(true);
          const website = await getWebsite(id);
          setContent(website.content || getDefaultHTML());
        } catch (error) {
          toast.error('加载网站失败');
          navigate('/');
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

  const getDefaultHTML = () => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>新网站</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8fafc;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }
        
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem 0;
            text-align: center;
        }
        
        h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            font-weight: 700;
        }
        
        .subtitle {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        main {
            padding: 4rem 0;
        }
        
        .welcome-section {
            text-align: center;
            background: white;
            padding: 3rem;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            margin-bottom: 3rem;
        }
        
        .welcome-section h2 {
            font-size: 2rem;
            color: #667eea;
            margin-bottom: 1rem;
        }
        
        .welcome-section p {
            color: #666;
            font-size: 1.1rem;
            margin-bottom: 2rem;
        }
        
        .cta-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 1.1rem;
            border-radius: 5px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }
        
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
        }
        
        .feature {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            text-align: center;
            transition: transform 0.2s;
        }
        
        .feature:hover {
            transform: translateY(-5px);
        }
        
        .feature h3 {
            color: #667eea;
            margin-bottom: 1rem;
            font-size: 1.3rem;
        }
        
        .feature p {
            color: #666;
            line-height: 1.6;
        }
        
        footer {
            background: #333;
            color: white;
            text-align: center;
            padding: 2rem 0;
            margin-top: 4rem;
        }
        
        @media (max-width: 768px) {
            h1 {
                font-size: 2rem;
            }
            
            .welcome-section {
                padding: 2rem 1rem;
            }
            
            .features {
                grid-template-columns: 1fr;
                gap: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <header>
        <div class="container">
            <h1>欢迎来到您的新网站</h1>
            <p class="subtitle">开始用AI构建一些令人惊叹的东西</p>
        </div>
    </header>

    <main>
        <div class="container">
            <section class="welcome-section">
                <h2>准备好创建了吗？</h2>
                <p>这是您的空白画布。使用AI聊天来描述您想要构建的内容，或者直接开始编辑。</p>
                <button class="cta-button">开始使用</button>
            </section>

            <div class="features">
                <div class="feature">
                    <h3>🤖 AI驱动</h3>
                    <p>用自然语言描述您的愿景，看着AI用现代、响应式设计将其实现。</p>
                </div>
                
                <div class="feature">
                    <h3>🎨 可视化编辑器</h3>
                    <p>直接点击和编辑任何元素。通过我们直观的可视化编辑工具实时查看您的更改。</p>
                </div>
                
                <div class="feature">
                    <h3>🚀 一键部署</h3>
                    <p>通过自动域名设置、SSL证书和全球CDN即时部署您的网站。</p>
                </div>
            </div>
        </div>
    </main>

    <footer>
        <div class="container">
            <p>&copy; 2024 AI网站构建器。用❤️和AI构建。</p>
        </div>
    </footer>
</body>
</html>`;
  };

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
        navigate(`/editor/${newWebsite.id}`);
      }
    } catch (error) {
      toast.error('保存网站失败');
    }
  };

  const handleWebsiteGenerated = (newWebsite: Website, newContent: string) => {
    console.log('WebsiteEditor: handleWebsiteGenerated called with:', {
      websiteId: newWebsite?.id,
      websiteTitle: newWebsite?.title,
      contentLength: newContent?.length,
      preview: newContent?.substring(0, 200) + '...',
      isFullHTML: newContent?.includes('<!DOCTYPE') || newContent?.includes('<html'),
      hasBody: newContent?.includes('<body'),
      hasStyle: newContent?.includes('<style') || newContent?.includes('.css')
    });
    
    console.log('WebsiteEditor: Setting content and website state');
    console.log('WebsiteEditor: Full content:', newContent);
    setContent(newContent);
    setCurrentWebsite(newWebsite);
    navigate(`/editor/${newWebsite.id}`, { replace: true });
  };

  const handleWebsiteUpdated = (newContent: string) => {
    console.log('WebsiteEditor: handleWebsiteUpdated called with:', { 
      contentLength: newContent?.length,
      preview: newContent?.substring(0, 200) + '...',
      isFullHTML: newContent?.includes('<!DOCTYPE') || newContent?.includes('<html'),
      hasBody: newContent?.includes('<body'),
      hasStyle: newContent?.includes('<style') || newContent?.includes('.css')
    });
    
    // 确保内容不为空且有效
    if (!newContent || newContent.trim() === '') {
      console.warn('WebsiteEditor: Received empty content, ignoring update');
      return;
    }
    
    console.log('WebsiteEditor: Setting content to state');
    setContent(newContent);
    
    // Force update of the current website state
    if (currentWebsite) {
      console.log('WebsiteEditor: Updating current website state');
      setCurrentWebsite({
        ...currentWebsite,
        content: newContent,
        updatedAt: new Date()
      });
    }
  };

  const handleGenerationProgress = (progress: number, stage: string) => {
    setGenerationProgress({ progress, stage });
    setIsGenerating(progress < 100);
  };

  const handleCodeStreamUpdate = (code: string) => {
    // 实时更新代码显示（用于Code视图中的实时代码生成展示）
    console.log('WebsiteEditor: Real-time code update:', {
      codeLength: code?.length,
      preview: code?.substring(0, 100) + '...'
    });

    // 更新内容，让用户在Code视图中看到实时生成的代码
    setContent(code);
  };

  const handleGenerationStart = () => {
    console.log('WebsiteEditor: Generation started');
    setIsGenerating(true);
    setGenerationProgress({ progress: 0, stage: '开始生成...' });
  };

  const handleGenerationEnd = () => {
    console.log('WebsiteEditor: Generation ended');
    setIsGenerating(false);
    setGenerationProgress({ progress: 100, stage: '生成完成' });
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">加载网站编辑器...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* 全局生成进度条 */}
      <GenerationProgressBar
        progress={generationProgress.progress}
        stage={generationProgress.stage}
        currentCode={content}
        isVisible={isGenerating}
        estimatedTotal={8000}
      />
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {currentWebsite ? currentWebsite.title : t('website.title')}
            </h1>
            {currentWebsite && (
              <span className="text-sm text-gray-500">
                {currentWebsite.domain}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAIChat(!showAIChat)}
              className={`p-2 rounded-lg transition-colors ${
                showAIChat 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title={showAIChat ? '隐藏AI聊天' : '显示AI聊天'}
            >
              <Split className="h-5 w-5" />
            </button>
            
            <button
              onClick={handleSave}
              disabled={isUpdating}
              className="btn btn-primary"
            >
              {isUpdating ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">保存中...</span>
                </>
              ) : (
                t('common.save')
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Editor */}
        <div className={`flex-1 ${showAIChat ? 'mr-0' : ''}`}>
          <VisualEditor
            content={content}
            onContentChange={handleContentChange}
            onSave={handleSave}
            isGenerating={isGenerating}
            generationProgress={generationProgress}
          />
        </div>

        {/* AI Chat Panel */}
        {showAIChat && (
          <ResizableAIChat
            websiteId={currentWebsite?.id}
            onWebsiteGenerated={handleWebsiteGenerated}
            onWebsiteUpdated={handleWebsiteUpdated}
            onGenerationProgress={handleGenerationProgress}
            onCodeStreamUpdate={handleCodeStreamUpdate}
            onGenerationStart={handleGenerationStart}
            onGenerationEnd={handleGenerationEnd}
            minWidth={280}
            maxWidth={800}
            defaultWidth={400}
          />
        )}
      </div>
    </div>
  );
};