import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { User, Bot, Crown, Sparkles } from 'lucide-react';

export function AvatarShowcase() {
  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">头像组件展示</h1>
        <p className="text-muted-foreground">展示不同变体和尺寸的头像组件</p>
      </div>

      {/* Size Variants */}
      <Card>
        <CardHeader>
          <CardTitle>尺寸变体</CardTitle>
          <CardDescription>不同尺寸的头像展示</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="text-center space-y-2">
              <Avatar variant="user" size="sm">
                <AvatarFallback variant="user">小</AvatarFallback>
              </Avatar>
              <Badge variant="outline">小 (sm)</Badge>
            </div>
            <div className="text-center space-y-2">
              <Avatar variant="user" size="md">
                <AvatarFallback variant="user">中</AvatarFallback>
              </Avatar>
              <Badge variant="outline">中 (md)</Badge>
            </div>
            <div className="text-center space-y-2">
              <Avatar variant="user" size="lg">
                <AvatarFallback variant="user">大</AvatarFallback>
              </Avatar>
              <Badge variant="outline">大 (lg)</Badge>
            </div>
            <div className="text-center space-y-2">
              <Avatar variant="user" size="xl">
                <AvatarFallback variant="user">特</AvatarFallback>
              </Avatar>
              <Badge variant="outline">特大 (xl)</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Style Variants */}
      <Card>
        <CardHeader>
          <CardTitle>样式变体</CardTitle>
          <CardDescription>不同角色和风格的头像</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center space-y-2">
              <Avatar variant="default" size="lg">
                <AvatarFallback variant="default">
                  <User className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">默认</div>
                <Badge variant="outline">default</Badge>
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <Avatar variant="user" size="lg">
                <AvatarFallback variant="user">用</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">用户</div>
                <Badge variant="outline">user</Badge>
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <Avatar variant="ai" size="lg">
                <AvatarFallback variant="ai">
                  <Bot className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">AI助手</div>
                <Badge className="bg-gray-100 text-gray-800">ai</Badge>
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <Avatar variant="premium" size="lg">
                <AvatarFallback variant="premium">
                  <Crown className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">高级用户</div>
                <Badge className="bg-primary/10 text-primary">premium</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>状态指示器</CardTitle>
          <CardDescription>带有在线状态的头像</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-6">
            <div className="text-center space-y-2">
              <Avatar variant="user" size="lg" showStatus={true} status="online">
                <AvatarFallback variant="user">在</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">在线</div>
                <Badge className="bg-green-100 text-green-800">online</Badge>
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <Avatar variant="user" size="lg" showStatus={true} status="busy">
                <AvatarFallback variant="user">忙</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">忙碌</div>
                <Badge className="bg-gray-100 text-gray-700">busy</Badge>
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <Avatar variant="user" size="lg" showStatus={true} status="offline">
                <AvatarFallback variant="user">离</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">离线</div>
                <Badge className="bg-gray-100 text-gray-600">offline</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-world Examples */}
      <Card>
        <CardHeader>
          <CardTitle>实际应用示例</CardTitle>
          <CardDescription>在实际界面中的使用场景</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* User Profile */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar variant="premium" size="lg" showStatus={true} status="online">
                <AvatarFallback variant="premium">李</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">李明 (Pro用户)</div>
                <div className="text-sm text-muted-foreground">liming@example.com</div>
              </div>
              <Badge className="bg-gradient-to-r from-primary to-gray-700 text-primary-foreground">Pro</Badge>
            </div>

            {/* Chat Message */}
            <div className="flex items-start gap-3">
              <Avatar variant="ai" size="md" showStatus={true} status="online">
                <AvatarFallback variant="ai">
                  <Bot className="size-3" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="bg-muted rounded-lg p-3">
                  <div className="font-medium mb-1">AI 助手</div>
                  <p className="text-sm">您好！我是您的AI助手，随时为您提供帮助。</p>
                </div>
              </div>
            </div>

            {/* Team Member */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar variant="user" size="md" showStatus={true} status="online">
                  <AvatarFallback variant="user">王</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">王小明</div>
                  <div className="text-sm text-muted-foreground">前端开发工程师</div>
                </div>
              </div>
              <Badge variant="secondary">团队成员</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}