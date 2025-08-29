import React, { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Sparkles, Zap, Globe, Smartphone, Users, ShoppingCart } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  prompt: string;
  icon: React.ReactNode;
  category: string;
}

const templates: Template[] = [
  {
    id: '1',
    name: '企业官网',
    description: '专业的企业门户网站',
    prompt: '创建一个现代化的企业官网，包含公司介绍、产品展示、新闻动态和联系我们页面',
    icon: <Globe className="w-5 h-5" />,
    category: 'business'
  },
  {
    id: '2',
    name: '电商平台',
    description: '在线购物商城',
    prompt: '设计一个电商购物网站，包含商品展示、购物车、用户登录和支付功能',
    icon: <ShoppingCart className="w-5 h-5" />,
    category: 'ecommerce'
  },
  {
    id: '3',
    name: '移动应用',
    description: '响应式移动端应用',
    prompt: '创建一个移动优先的响应式应用，具有现代化的UI设计和流畅的用户体验',
    icon: <Smartphone className="w-5 h-5" />,
    category: 'mobile'
  },
  {
    id: '4',
    name: '社交平台',
    description: '用户互动社区',
    prompt: '构建一个社交媒体平台，包含用户资料、动态发布、评论互动和好友系统',
    icon: <Users className="w-5 h-5" />,
    category: 'social'
  }
];

export function AIGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setProgress(0);
    setGeneratedResult(null);

    // 模拟生成过程
    const steps = [
      { progress: 20, message: '分析需求...' },
      { progress: 40, message: '设计架构...' },
      { progress: 60, message: '生成代码...' },
      { progress: 80, message: '优化样式...' },
      { progress: 100, message: '生成完成！' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setProgress(step.progress);
    }

    // 模拟生成结果
    setGeneratedResult(`
      基于您的需求 "${prompt}"，我已经生成了一个完整的网站。
      
      生成内容包括：
      ✅ 响应式页面布局
      ✅ 现代化UI组件
      ✅ 交互功能实现
      ✅ 移动端适配
      ✅ 优化的用户体验
      
      您可以继续修改需求或下载生成的代码。
    `);
    
    setIsGenerating(false);
  };

  const handleTemplateSelect = (template: Template) => {
    setPrompt(template.prompt);
  };

  const clearAll = () => {
    setPrompt('');
    setGeneratedResult(null);
    setProgress(0);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AI 网站生成器
          </h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          使用人工智能技术，只需描述您的需求，即可快速生成专业的网站。支持多种类型的网站模板和自定义需求。
        </p>
      </div>

      <Tabs defaultValue="generator" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generator" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            智能生成
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            模板库
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generator" className="space-y-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>描述您的网站需求</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="请详细描述您想要创建的网站类型、功能需求、设计风格等..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] resize-none"
                disabled={isGenerating}
              />
              
              <div className="flex gap-3">
                <Button 
                  onClick={handleGenerate} 
                  disabled={!prompt.trim() || isGenerating}
                  className="flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGenerating ? '生成中...' : '开始生成'}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={clearAll}
                  disabled={isGenerating}
                >
                  清空
                </Button>
              </div>

              {/* Progress */}
              {isGenerating && (
                <div className="space-y-2">
                  <Progress value={progress} className="w-full" />
                  <p className="text-sm text-muted-foreground text-center">
                    正在生成您的网站... {progress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generated Result */}
          {generatedResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-green-500" />
                  生成结果
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-line text-sm">
                    {generatedResult}
                  </pre>
                </div>
                
                <div className="flex gap-3 mt-4">
                  <Button>
                    下载代码
                  </Button>
                  <Button variant="outline">
                    在线预览
                  </Button>
                  <Button variant="outline">
                    继续编辑
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card 
                key={template.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleTemplateSelect(template)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {template.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1">
                        {template.category}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-3">
                    {template.description}
                  </p>
                  <p className="text-xs bg-muted p-2 rounded border-l-4 border-primary">
                    {template.prompt}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}