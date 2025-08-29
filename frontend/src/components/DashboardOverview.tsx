import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { useAuth } from '../lib/auth';
import { useRouter } from '../lib/router';
import {
  Plus,
  Code,
  Globe,
  Rocket,
  TrendingUp,
  Users,
  Clock,
  Sparkles,
  Eye,
  Download,
  Share
} from 'lucide-react';

const stats = [
  {
    title: '已创建网站',
    value: 12,
    change: '+3',
    changeType: 'positive' as const,
    icon: Globe,
    color: 'from-blue-500 to-purple-500'
  },
  {
    title: '页面访问量',
    value: 1247,
    change: '+12%',
    changeType: 'positive' as const,
    icon: Eye,
    color: 'from-green-500 to-teal-500'
  },
  {
    title: '活跃项目',
    value: 3,
    change: '+1',
    changeType: 'positive' as const,
    icon: Code,
    color: 'from-purple-500 to-pink-500'
  },
  {
    title: '本月生成次数',
    value: 28,
    change: '+8',
    changeType: 'positive' as const,
    icon: Sparkles,
    color: 'from-yellow-500 to-orange-500'
  }
];

const recentWebsites = [
  {
    id: '1',
    name: '个人作品集',
    description: '展示个人项目和技能的作品集网站',
    status: 'published' as const,
    lastUpdated: '2 小时前',
    views: 128,
    domain: 'portfolio.ai-generated.com'
  },
  {
    id: '2',
    name: '企业官网',
    description: '现代化的企业门户网站',
    status: 'draft' as const,
    lastUpdated: '1 天前',
    views: 0,
    domain: null
  },
  {
    id: '3',
    name: '电商平台',
    description: '在线购物商城网站',
    status: 'published' as const,
    lastUpdated: '3 天前',
    views: 856,
    domain: 'shop.ai-generated.com'
  }
];

const quickActions = [
  {
    title: '创建新网站',
    description: '使用AI快速生成专业网站',
    icon: Plus,
    action: 'editor' as const,
    color: 'from-primary to-primary/80'
  },
  {
    title: '管理网站',
    description: '查看和编辑已创建的网站',
    icon: Globe,
    action: 'websites' as const,
    color: 'from-blue-500 to-purple-500'
  },
  {
    title: '部署项目',
    description: '发布网站到生产环境',
    icon: Rocket,
    action: 'deploy' as const,
    color: 'from-green-500 to-teal-500'
  }
];

export function DashboardOverview() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [hoveredStat, setHoveredStat] = useState<number | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">已发布</Badge>;
      case 'draft':
        return <Badge variant="secondary">草稿</Badge>;
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  const getPlanLimits = (plan: string) => {
    switch (plan) {
      case 'free':
        return { websites: 3, monthlyGenerations: 50 };
      case 'pro':
        return { websites: 25, monthlyGenerations: 500 };
      case 'enterprise':
        return { websites: -1, monthlyGenerations: -1 };
      default:
        return { websites: 3, monthlyGenerations: 50 };
    }
  };

  const limits = getPlanLimits(user?.plan || 'free');

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">欢迎回来，{user?.name}</h1>
          <p className="text-muted-foreground mt-1">
            继续您的AI网站创建之旅
          </p>
        </div>
        <Button
          onClick={() => navigate('editor')}
          className="bg-gradient-to-r from-primary to-primary/80"
        >
          <Plus className="w-4 h-4 mr-2" />
          创建新网站
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const isHovered = hoveredStat === index;

          return (
            <motion.div
              key={index}
              onHoverStart={() => setHoveredStat(index)}
              onHoverEnd={() => setHoveredStat(null)}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          stat.changeType === 'positive' 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {stat.change}
                        </span>
                      </div>
                    </div>
                    <motion.div
                      animate={{
                        scale: isHovered ? 1.1 : 1,
                        rotate: isHovered ? 10 : 0
                      }}
                      className={`w-12 h-12 rounded-lg bg-gradient-to-r ${stat.color} flex items-center justify-center`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold mb-4">快速操作</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon;

            return (
              <motion.div
                key={index}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(action.action)}
                >
                  <CardContent className="p-6 text-center space-y-4">
                    <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-r ${action.color} flex items-center justify-center`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold">{action.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {action.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Recent Websites */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">最近的网站</h2>
          <Button 
            variant="outline" 
            onClick={() => navigate('websites')}
          >
            查看全部
          </Button>
        </div>
        
        <div className="grid gap-4">
          {recentWebsites.map((website, index) => (
            <motion.div
              key={website.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold">{website.name}</h3>
                        {getStatusBadge(website.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {website.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {website.lastUpdated}
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {website.views} 次访问
                        </div>
                        {website.domain && (
                          <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {website.domain}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Share className="w-4 h-4" />
                      </Button>
                      <Button size="sm">
                        编辑
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Usage Limits */}
      {user?.plan === 'free' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">使用限制</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>网站数量</span>
                <span>{recentWebsites.length} / {limits.websites}</span>
              </div>
              <Progress value={(recentWebsites.length / limits.websites) * 100} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>本月生成次数</span>
                <span>28 / {limits.monthlyGenerations}</span>
              </div>
              <Progress value={(28 / limits.monthlyGenerations) * 100} />
            </div>
            <Button className="w-full bg-gradient-to-r from-purple-500 to-blue-500">
              升级到 Pro 解锁更多功能
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}