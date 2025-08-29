import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { 
  Zap, 
  Palette, 
  Smartphone, 
  Code, 
  Globe, 
  Shield,
  Clock,
  Lightbulb
} from 'lucide-react';

const features = [
  {
    icon: <Zap className="w-6 h-6" />,
    title: '快速生成',
    description: '只需几分钟即可生成完整的网站代码',
    color: 'bg-yellow-500/10 text-yellow-600'
  },
  {
    icon: <Palette className="w-6 h-6" />,
    title: '智能设计',
    description: 'AI自动匹配最佳的设计方案和配色',
    color: 'bg-purple-500/10 text-purple-600'
  },
  {
    icon: <Smartphone className="w-6 h-6" />,
    title: '响应式布局',
    description: '自动适配各种设备屏幕尺寸',
    color: 'bg-blue-500/10 text-blue-600'
  },
  {
    icon: <Code className="w-6 h-6" />,
    title: '高质量代码',
    description: '生成的代码结构清晰，易于维护',
    color: 'bg-green-500/10 text-green-600'
  },
  {
    icon: <Globe className="w-6 h-6" />,
    title: 'SEO优化',
    description: '内置SEO最佳实践，提升搜索排名',
    color: 'bg-indigo-500/10 text-indigo-600'
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: '安全可靠',
    description: '遵循最新的安全标准和最佳实践',
    color: 'bg-red-500/10 text-red-600'
  }
];

const stats = [
  { label: '已生成网站', value: '10,000+' },
  { label: '用户满意度', value: '98%' },
  { label: '平均生成时间', value: '3分钟' },
  { label: '支持模板', value: '50+' }
];

export function FeatureSection() {
  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-12">
      {/* Features Grid */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold">为什么选择我们的AI生成器？</h2>
          <p className="text-muted-foreground">
            强大的AI技术，让网站创建变得简单高效
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${feature.color}`}>
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-8">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">数据说话</h3>
            <p className="text-muted-foreground">
              看看我们的AI生成器为用户带来的价值
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it Works */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold">如何使用</h3>
          <p className="text-muted-foreground">
            简单三步，即可获得专业网站
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Lightbulb className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>1. 描述需求</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                用自然语言描述您想要的网站功能和设计风格
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>2. AI生成</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                AI分析您的需求，自动生成完整的网站代码
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>3. 即时部署</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                下载代码或一键部署，立即拥有您的专属网站
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hero Image Section */}
      <div className="bg-gradient-to-br from-primary/5 via-transparent to-primary/5 rounded-2xl p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit">
              AI 驱动的未来
            </Badge>
            <h3 className="text-3xl font-bold">
              让创意无限，让技术简单
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              我们的AI生成器结合了最新的人工智能技术和网页设计最佳实践，
              为您提供快速、专业、个性化的网站解决方案。
              无论您是初学者还是专业开发者，都能轻松创建出色的网站。
            </p>
          </div>
          
          <div className="relative">
            <ImageWithFallback 
              src="https://images.unsplash.com/photo-1634910409614-71a507e13588?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhaSUyMGFydGlmaWNpYWwlMjBpbnRlbGxpZ2VuY2UlMjByb2JvdHxlbnwxfHx8fDE3NTYzNDY0NDl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
              alt="AI Technology"
              className="w-full h-64 object-cover rounded-lg shadow-lg"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  );
}