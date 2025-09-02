import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/Button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useAuth } from '@/lib/auth';
import { useRouter, type Route } from '@/lib/router';
import {
  Sparkles,
  LayoutDashboard,
  Code,
  Settings,
  BarChart3,
  Globe,
  Rocket,
  LogOut,
  User,
  Crown,
  ChevronRight,
  ChevronLeft,
  Menu
} from 'lucide-react';

const navigation = [
  {
    name: '控制面板',
    route: 'dashboard' as Route,
    icon: LayoutDashboard,
    description: '总览和快速操作'
  },
  {
    name: 'AI 编辑器',
    route: 'editor' as Route,
    icon: Code,
    description: '创建和编辑网站'
  },
  {
    name: '网站管理',
    route: 'websites' as Route,
    icon: Globe,
    description: '管理您的网站'
  },
  {
    name: '部署管理',
    route: 'deploy' as Route,
    icon: Rocket,
    description: '发布和托管'
  },
  {
    name: 'Token统计',
    route: 'tokens' as Route,
    icon: BarChart3,
    description: 'Token消耗与费用'
  },
  {
    name: '设置',
    route: 'settings' as Route,
    icon: Settings,
    description: '账户和偏好设置'
  }
];

interface DashboardSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function DashboardSidebar({ isCollapsed, onToggle }: DashboardSidebarProps) {
  const { user, logout } = useAuth();
  const { currentRoute, navigate } = useRouter();

  // 键盘快捷键支持 (Ctrl/Cmd + B)
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        onToggle();
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [onToggle]);

  const handleLogout = () => {
    logout();
    navigate('home');
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'pro':
        return <Badge className="bg-black text-white">Pro</Badge>;
      case 'enterprise':
        return <Badge className="bg-gray-800 text-white">Enterprise</Badge>;
      default:
        return <Badge className="bg-gray-200 text-gray-700 border border-gray-300">Free</Badge>;
    }
  };

  const NavigationItem = ({ item }: { item: typeof navigation[0] }) => {
    const isActive = currentRoute === item.route;
    const Icon = item.icon;

    if (isCollapsed) {
      return (
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div>
                <motion.button
                  onClick={() => navigate(item.route)}
                  className={`w-full flex items-center justify-center p-3 rounded-lg transition-colors group ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                </motion.button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {item.description}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <motion.button
        onClick={() => navigate(item.route)}
        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors group ${
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium">{item.name}</div>
          <div className={`text-xs ${
            isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
          }`}>
            {item.description}
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 transition-transform ${
          isActive ? 'rotate-90' : 'group-hover:translate-x-1'
        }`} />
      </motion.button>
    );
  };

  return (
    <motion.div 
      animate={{ width: isCollapsed ? '4rem' : '16rem' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="h-screen bg-background border-r flex flex-col relative"
    >
      {/* Toggle Button */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="absolute -right-3 top-6 z-10 w-6 h-6 p-0 rounded-full border bg-background shadow-md hover:shadow-lg transition-shadow"
          title={`${isCollapsed ? '展开' : '收起'}侧边栏 (Ctrl+B)`}
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 0 : 180 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-3 h-3" />
          </motion.div>
        </Button>
      </motion.div>

      {/* Header */}
      <div className={`border-b ${isCollapsed ? 'p-3' : 'p-6'}`}>
        <AnimatePresence mode="wait">
          {isCollapsed ? (
            <motion.div
              key="collapsed-header"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="flex justify-center"
            >
              {/* 仅显示用户头像（邮箱首字母） - 使用简单 div 保证可见性 */}
              <div className="h-8 w-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-semibold">
                {(user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="expanded-header"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg">AI 生成器</span>
              </div>

              {/* User Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-100 border border-gray-200">
                <div className="h-10 w-10 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user?.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                </div>
                {user?.plan && getPlanBadge(user.plan)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 收起时不再单独显示Logo或重复头像 */}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 space-y-2 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {navigation.map((item) => (
          <NavigationItem key={item.route} item={item} />
        ))}
      </nav>

      <Separator />

      {/* Bottom Section */}
      <div className={`space-y-3 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <AnimatePresence>
          {!isCollapsed && user?.plan === 'free' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 rounded-lg"
            >
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-purple-500" />
                <span className="font-medium text-sm">升级到 Pro</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                解锁更多功能和无限网站生成
              </p>
              <Button size="sm" className="w-full">
                立即升级
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {isCollapsed ? (
          <div className="space-y-2">
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full p-3"
                      onClick={() => navigate('settings')}
                    >
                      <User className="w-4 h-4" />
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="ml-2">
                  个人资料
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full p-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="ml-2">
                  退出登录
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate('settings')}
            >
              <User className="w-4 h-4 mr-2" />
              个人资料
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
