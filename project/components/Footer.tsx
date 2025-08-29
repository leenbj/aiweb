import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { 
  Sparkles, 
  Github, 
  Twitter, 
  Linkedin, 
  Mail,
  Heart
} from 'lucide-react';

export function Footer() {
  const footerSections = [
    {
      title: '产品',
      links: [
        { name: 'AI生成器', href: '#' },
        { name: '模板库', href: '#' },
        { name: '代码编辑器', href: '#' },
        { name: 'API接口', href: '#' },
      ]
    },
    {
      title: '资源',
      links: [
        { name: '帮助中心', href: '#' },
        { name: '使用指南', href: '#' },
        { name: 'API文档', href: '#' },
        { name: '更新日志', href: '#' },
      ]
    },
    {
      title: '社区',
      links: [
        { name: '用户论坛', href: '#' },
        { name: '开发者社区', href: '#' },
        { name: '案例展示', href: '#' },
        { name: '合作伙伴', href: '#' },
      ]
    },
    {
      title: '公司',
      links: [
        { name: '关于我们', href: '#' },
        { name: '加入团队', href: '#' },
        { name: '新闻动态', href: '#' },
        { name: '联系我们', href: '#' },
      ]
    }
  ];

  const socialLinks = [
    { name: 'GitHub', icon: <Github className="w-5 h-5" />, href: '#' },
    { name: 'Twitter', icon: <Twitter className="w-5 h-5" />, href: '#' },
    { name: 'LinkedIn', icon: <Linkedin className="w-5 h-5" />, href: '#' },
    { name: 'Email', icon: <Mail className="w-5 h-5" />, href: '#' },
  ];

  return (
    <footer className="bg-muted/30 border-t">
      <div className="container mx-auto px-4 py-12">
        {/* Newsletter Section */}
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-8 mb-12">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h3 className="text-2xl font-bold">获取最新更新</h3>
            <p className="text-muted-foreground">
              订阅我们的通讯，第一时间了解新功能和使用技巧
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="输入您的邮箱地址"
                className="flex-1 px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Button className="px-6">
                订阅
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              我们承诺不会向第三方分享您的邮箱地址
            </p>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 mb-8">
          {/* Brand Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl">AI 生成器</span>
              <Badge variant="secondary" className="ml-2">
                Beta
              </Badge>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              利用先进的人工智能技术，让网站创建变得简单高效。
              无论是个人博客还是企业官网，都能在几分钟内完成。
            </p>
            
            {/* Social Links */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                  aria-label={social.name}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links Sections */}
          {footerSections.map((section, index) => (
            <div key={index} className="space-y-3">
              <h4 className="font-medium">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="mb-8" />

        {/* Bottom Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>© 2024 AI生成器. 保留所有权利.</span>
            <span className="hidden sm:inline">|</span>
            <span className="flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-red-500" /> by AI Team
            </span>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              隐私政策
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              服务条款
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              Cookie政策
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}