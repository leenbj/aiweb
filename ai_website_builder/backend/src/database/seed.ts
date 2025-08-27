import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始数据库种子数据初始化...');

  try {
    // 创建默认管理员用户
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123';
    
    // 检查管理员是否已存在
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          name: '系统管理员',
          password: hashedPassword,
          role: 'admin'
        }
      });
      
      console.log(`✅ 管理员用户已创建: ${admin.email}`);
      console.log(`📧 邮箱: ${adminEmail}`);
      console.log(`🔐 密码: ${adminPassword}`);
    } else {
      console.log('⚠️  管理员用户已存在，跳过创建');
    }

    // 创建示例用户
    const testEmail = 'test@example.com';
    const testPassword = 'test123';
    
    const existingTest = await prisma.user.findUnique({
      where: { email: testEmail }
    });

    if (!existingTest) {
      const hashedTestPassword = await bcrypt.hash(testPassword, 10);
      
      const testUser = await prisma.user.create({
        data: {
          email: testEmail,
          name: '测试用户',
          password: hashedTestPassword,
          role: 'user'
        }
      });
      
      console.log(`✅ 测试用户已创建: ${testUser.email}`);
      
      // 为测试用户创建示例网站
      const sampleWebsite = await prisma.website.create({
        data: {
          userId: testUser.id,
          domain: 'example-site.local',
          title: '示例网站',
          description: '这是一个由AI生成的示例网站',
          content: '欢迎来到我的网站！这里是主页内容。',
          html: `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>示例网站</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            text-align: center;
            margin-bottom: 30px;
        }
        .hero {
            text-align: center;
            padding: 20px 0;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px;
            transition: background 0.3s;
        }
        .btn:hover {
            background: #2980b9;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }
        .feature {
            padding: 20px;
            background: #f8f9fa;
            border-radius: 5px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <h1>🚀 欢迎来到AI网站构建器</h1>
            <p>这是一个由人工智能自动生成的示例网站，展示了我们平台的强大功能。</p>
            <a href="#features" class="btn">了解更多</a>
            <a href="#contact" class="btn">联系我们</a>
        </div>

        <div class="features" id="features">
            <div class="feature">
                <h3>🎨 智能设计</h3>
                <p>AI自动生成美观的网站设计，无需设计经验</p>
            </div>
            <div class="feature">
                <h3>⚡ 快速部署</h3>
                <p>一键部署到您的域名，几分钟内上线</p>
            </div>
            <div class="feature">
                <h3>🔧 易于编辑</h3>
                <p>可视化编辑器，实时预览修改效果</p>
            </div>
        </div>

        <div id="contact">
            <h2>联系我们</h2>
            <p>如果您对我们的AI网站构建器感兴趣，请随时与我们联系。</p>
            <p>📧 邮箱: contact@ai-builder.com</p>
            <p>🌐 网站: https://ai-builder.com</p>
        </div>
    </div>

    <script>
        // 简单的平滑滚动
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            });
        });
    </script>
</body>
</html>
          `,
          css: `/* 自定义样式 */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
}

.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 80px 0;
  text-align: center;
}

.btn {
  transition: all 0.3s ease;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.2);
}
`,
          js: `// 页面交互脚本
console.log('示例网站已加载');

// 添加页面加载动画
document.addEventListener('DOMContentLoaded', function() {
    const container = document.querySelector('.container');
    if (container) {
        container.style.opacity = '0';
        container.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            container.style.transition = 'all 0.6s ease';
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        }, 100);
    }
});

// 特性卡片悬停效果
document.querySelectorAll('.feature').forEach(feature => {
    feature.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
        this.style.transition = 'transform 0.3s ease';
    });
    
    feature.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});
`,
          status: 'draft'
        }
      });
      
      console.log(`✅ 示例网站已创建: ${sampleWebsite.domain}`);
    } else {
      console.log('⚠️  测试用户已存在，跳过创建');
    }

    // 创建基础服务器配置
    const serverConfigs = [
      {
        key: 'nginx_sites_path',
        value: '/etc/nginx/sites-available',
        description: 'Nginx 站点配置文件路径'
      },
      {
        key: 'nginx_sites_enabled_path',
        value: '/etc/nginx/sites-enabled',
        description: 'Nginx 启用站点路径'
      },
      {
        key: 'websites_root_path',
        value: '/var/www/sites',
        description: '网站文件根目录'
      },
      {
        key: 'ssl_certificates_path',
        value: '/etc/letsencrypt/live',
        description: 'SSL证书存储路径'
      },
      {
        key: 'max_file_size',
        value: '10485760',
        description: '最大文件上传大小 (10MB)'
      },
      {
        key: 'allowed_file_types',
        value: '.jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.zip',
        description: '允许上传的文件类型'
      }
    ];

    for (const config of serverConfigs) {
      await prisma.serverConfig.upsert({
        where: { key: config.key },
        update: { value: config.value, description: config.description },
        create: config
      });
    }
    
    console.log('✅ 服务器基础配置已创建');

    // 显示统计信息
    const userCount = await prisma.user.count();
    const websiteCount = await prisma.website.count();
    const configCount = await prisma.serverConfig.count();

    console.log('\n📊 数据库统计:');
    console.log(`👥 用户数量: ${userCount}`);
    console.log(`🌐 网站数量: ${websiteCount}`);
    console.log(`⚙️  配置项数量: ${configCount}`);

    console.log('\n🎉 数据库种子数据初始化完成!');
    console.log('\n📝 默认账户信息:');
    console.log(`管理员: ${adminEmail} / ${adminPassword}`);
    console.log(`测试用户: ${testEmail} / ${testPassword}`);

  } catch (error) {
    console.error('❌ 种子数据初始化失败:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });