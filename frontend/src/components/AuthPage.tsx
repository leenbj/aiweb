import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/Input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { useAuth } from '@/lib/auth';
import { useRouter } from '@/lib/router';
import { 
  Sparkles, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Github, 
  Chrome,
  Mail,
  Lock,
  User
} from 'lucide-react';

interface AuthPageProps {
  mode: 'login' | 'register';
}

export function AuthPage({ mode }: AuthPageProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register } = useAuth();
  const { navigate } = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'register') {
        if (formData.password !== formData.confirmPassword) {
          setError('密码不一致');
          return;
        }
        const success = await register(formData.email, formData.password, formData.name);
        if (success) {
          navigate('dashboard');
        } else {
          setError('注册失败，请重试');
        }
      } else {
        const success = await login(formData.email, formData.password);
        if (success) {
          navigate('dashboard');
        } else {
          setError('邮箱或密码错误');
        }
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md relative">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          onClick={() => navigate('home')}
          className="absolute -top-16 left-0 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Card className="shadow-2xl border-none bg-background/80 backdrop-blur-sm">
            <CardHeader className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold">AI 生成器</span>
              </div>
              
              <div>
                <CardTitle className="text-2xl">
                  {mode === 'login' ? '欢迎回来' : '开始您的AI之旅'}
                </CardTitle>
                <p className="text-muted-foreground mt-2">
                  {mode === 'login' 
                    ? '登录到您的账户，继续创建精彩网站' 
                    : '注册账户，立即体验AI网站生成的魅力'
                  }
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Social Login */}
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="w-full">
                  <Github className="w-4 h-4 mr-2" />
                  GitHub
                </Button>
                <Button variant="outline" className="w-full">
                  <Chrome className="w-4 h-4 mr-2" />
                  Google
                </Button>
              </div>

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                  或使用邮箱{mode === 'login' ? '登录' : '注册'}
                </span>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="name">姓名</Label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="请输入您的姓名"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="pl-10 bg-white border-gray-300 focus:border-gray-400"
                        required
                      />
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="请输入您的邮箱"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="pl-10 bg-white border-gray-300 focus:border-gray-400"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="请输入密码"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="pl-10 pr-10 bg-white border-gray-300 focus:border-gray-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {mode === 'register' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="confirmPassword">确认密码</Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="请再次输入密码"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className="pl-10 bg-white border-gray-300 focus:border-gray-400"
                        required
                      />
                    </div>
                  </motion.div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg"
                  >
                    {error}
                  </motion.div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      {mode === 'login' ? '登录中...' : '注册中...'}
                    </div>
                  ) : (
                    mode === 'login' ? '登录' : '注册'
                  )}
                </Button>
              </form>

              {/* Switch Mode */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {mode === 'login' ? '还没有账户？' : '已有账户？'}
                  <button
                    onClick={() => navigate(mode === 'login' ? 'register' : 'login')}
                    className="text-primary hover:underline ml-1"
                  >
                    {mode === 'login' ? '立即注册' : '立即登录'}
                  </button>
                </p>
              </div>

              {mode === 'login' && (
                <div className="text-center">
                  <button className="text-sm text-primary hover:underline">
                    忘记密码？
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
