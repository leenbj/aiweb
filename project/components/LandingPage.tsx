import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Header } from './Header';
import { Footer } from './Footer';
import { useRouter } from '../lib/router';
import { 
  Sparkles, 
  Zap, 
  Code, 
  Smartphone, 
  Globe, 
  ArrowRight,
  Check,
  Star,
  Users,
  Clock,
  Shield
} from 'lucide-react';

const features = [
  {
    icon: <Zap className="w-8 h-8" />,
    title: '秒级生成',
    description: '使用先进AI技术，快速生成高质量网站代码',
    color: 'from-yellow-500 to-orange-500'
  },
  {
    icon: <Code className="w-8 h-8" />,
    title: '智能编码',
    description: '自动优化代码结构，确保最佳性能和可维护性',
    color: 'from-blue-500 to-purple-500'
  },
  {
    icon: <Smartphone className="w-8 h-8" />,
    title: '响应式设计',
    description: '自适应各种设备尺寸，完美的移动端体验',
    color: 'from-green-500 to-teal-500'
  },
  {
    icon: <Globe className="w-8 h-8" />,
    title: '一键部署',
    description: '集成多种部署方案，轻松发布到全球',
    color: 'from-purple-500 to-pink-500'
  }
];

const stats = [
  { icon: <Users className="w-6 h-6" />, value: '50K+', label: '用户选择' },
  { icon: <Clock className="w-6 h-6" />, value: '100K+', label: '网站生成' },
  { icon: <Star className="w-6 h-6" />, value: '99%', label: '满意度' },
  { icon: <Shield className="w-6 h-6" />, value: '24/7', label: '技术支持' }
];

const testimonials = [
  {
    name: '张小明',
    role: '创业者',
    content: '几分钟就完成了我的企业官网，效果超出预期！',
    avatar: '👨‍💻'
  },
  {
    name: '李小花',
    role: '设计师',
    content: 'AI生成的设计很专业，为我节省了大量时间。',
    avatar: '👩‍🎨'
  },
  {
    name: '王小强',
    role: '开发者',
    content: '代码质量很高，完全可以用于生产环境。',
    avatar: '👨‍💼'
  }
];

export function LandingPage() {
  const { navigate } = useRouter();
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-background min-h-screen flex items-center">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        
        <div className="container mx-auto px-4 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
              >
                <Badge variant="secondary" className="mb-4">
                  🚀 AI 驱动的网站生成器
                </Badge>
                <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                  用 <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">AI</span> 创造
                  <br />
                  完美网站
                </h1>
              </motion.div>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="text-xl text-muted-foreground leading-relaxed"
              >
                只需描述您的想法，AI 将为您生成专业、响应式的网站。
                从概念到部署，只需几分钟。
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-primary to-primary/80 text-lg px-8 py-3"
                  onClick={() => navigate('register')}
                >
                  开始免费使用
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-3"
                  onClick={() => navigate('login')}
                >
                  查看演示
                </Button>
              </motion.div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.8 }}
                className="grid grid-cols-2 lg:grid-cols-4 gap-6"
              >
                {stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.05 }}
                    className="text-center"
                  >
                    <div className="flex items-center justify-center mb-2 text-primary">
                      {stat.icon}
                    </div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="relative">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1750056393300-102f7c4b8bc2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWIlMjBkZXZlbG9wbWVudCUyMGRlc2lnbiUyMG1vY2t1cHxlbnwxfHx8fDE3NTY0MzQzNjR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="AI Website Generator"
                  className="w-full h-[600px] object-cover rounded-2xl shadow-2xl"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
                
                {/* Floating Elements */}
                <motion.div
                  animate={{ y: [-10, 10, -10] }}
                  transition={{ repeat: Infinity, duration: 4 }}
                  className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg"
                >
                  <Sparkles className="w-6 h-6 text-primary" />
                </motion.div>
                
                <motion.div
                  animate={{ y: [10, -10, 10] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg"
                >
                  <Code className="w-6 h-6 text-green-500" />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <h2 className="text-4xl font-bold">强大功能，简单易用</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              我们的AI技术让专业网站开发变得人人可及
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                <Card className="h-full border-none shadow-lg bg-gradient-to-br from-background to-muted/50">
                  <CardContent className="p-6 text-center space-y-4">
                    <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-r ${feature.color} flex items-center justify-center text-white`}>
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center space-y-4 mb-16"
          >
            <h2 className="text-4xl font-bold">用户真实反馈</h2>
            <p className="text-xl text-muted-foreground">
              看看他们如何使用我们的产品
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <motion.div
              key={currentTestimonial}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="text-center p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-none">
                <CardContent className="space-y-6">
                  <div className="text-6xl mb-4">
                    {testimonials[currentTestimonial].avatar}
                  </div>
                  <blockquote className="text-2xl font-medium leading-relaxed">
                    "{testimonials[currentTestimonial].content}"
                  </blockquote>
                  <div>
                    <div className="font-bold text-lg">
                      {testimonials[currentTestimonial].name}
                    </div>
                    <div className="text-muted-foreground">
                      {testimonials[currentTestimonial].role}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <div className="flex justify-center gap-2 mt-8">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentTestimonial ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary to-primary/80">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h2 className="text-4xl lg:text-5xl font-bold text-primary-foreground">
              准备开始了吗？
            </h2>
            <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto">
              加入数万名用户，体验 AI 驱动的网站创建革命
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="secondary"
                className="text-lg px-8 py-3"
                onClick={() => navigate('register')}
              >
                免费开始使用
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-3 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => navigate('login')}
              >
                已有账户？登录
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}