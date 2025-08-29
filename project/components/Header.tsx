import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useRouter } from '../lib/router';
import { 
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from './ui/navigation-menu';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { 
  Sparkles, 
  Menu, 
  Github, 
  Twitter, 
  Globe,
  Zap,
  Book,
  Users,
  HelpCircle
} from 'lucide-react';

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const { navigate } = useRouter();

  const navItems = [
    {
      title: '功能',
      items: [
        { title: 'AI生成器', description: '智能网站生成', icon: <Zap className="w-4 h-4" /> },
        { title: '模板库', description: '精选网站模板', icon: <Globe className="w-4 h-4" /> },
        { title: '代码编辑', description: '在线代码编辑器', icon: <Book className="w-4 h-4" /> },
      ]
    },
    {
      title: '资源',
      items: [
        { title: '帮助中心', description: '使用指南和FAQ', icon: <HelpCircle className="w-4 h-4" /> },
        { title: '社区', description: '用户交流社区', icon: <Users className="w-4 h-4" /> },
        { title: 'API文档', description: '开发者接口文档', icon: <Book className="w-4 h-4" /> },
      ]
    }
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <button 
          onClick={() => navigate('home')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl">AI 生成器</span>
          <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">
            Beta
          </Badge>
        </button>

        {/* Desktop Navigation */}
        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            {navItems.map((section, index) => (
              <NavigationMenuItem key={index}>
                <NavigationMenuTrigger>{section.title}</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                    {section.items.map((item, itemIndex) => (
                      <li key={itemIndex}>
                        <NavigationMenuLink asChild>
                          <button
                            className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground w-full text-left"
                          >
                            <div className="flex items-center gap-2">
                              {item.icon}
                              <div className="text-sm font-medium leading-none">
                                {item.title}
                              </div>
                            </div>
                            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                              {item.description}
                            </p>
                          </button>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            ))}
            
            <NavigationMenuItem>
              <NavigationMenuLink className="px-4 py-2 hover:text-primary cursor-pointer">
                定价
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('login')}
          >
            登录
          </Button>
          <Button 
            size="sm" 
            className="bg-gradient-to-r from-primary to-primary/80"
            onClick={() => navigate('register')}
          >
            开始使用
          </Button>
        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="sm">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px]">
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 pb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl">AI 生成器</span>
              </div>

              <nav className="flex-1 space-y-6">
                {navItems.map((section, index) => (
                  <div key={index} className="space-y-3">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                      {section.title}
                    </h3>
                    <div className="space-y-2">
                      {section.items.map((item, itemIndex) => (
                        <button
                          key={itemIndex}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors w-full text-left"
                        >
                          {item.icon}
                          <div>
                            <div className="font-medium">{item.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                
                <div className="space-y-3">
                  <button className="block p-2 rounded-lg hover:bg-accent transition-colors font-medium w-full text-left">
                    定价
                  </button>
                </div>
              </nav>

              <div className="space-y-3 pt-6 border-t">
                <Button 
                  className="w-full"
                  onClick={() => {
                    navigate('register');
                    setIsOpen(false);
                  }}
                >
                  开始使用
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    navigate('login');
                    setIsOpen(false);
                  }}
                >
                  登录
                </Button>
                
                <div className="flex items-center justify-center gap-4 pt-4">
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    <Github className="w-5 h-5" />
                  </a>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    <Twitter className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}