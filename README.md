# AI Website Builder

一个强大的AI驱动网站构建系统，支持自然语言对话生成网页、可视化编辑和本地服务器部署。

## ✨ 核心功能

- **🤖 AI对话构建** - 使用自然语言与AI对话生成HTML/CSS/JS网页
- **🎛️ 智能提示词** - 三种独立提示词配置（对话、生成、编辑），个性化AI行为
- **🎨 可视化编辑器** - 点击编辑元素，拖拽调整，实时修改
- **👁️ 实时预览** - 即时显示修改效果，支持响应式预览
- **🚀 一键部署** - 自动部署到本地服务器，配置Nginx和SSL
- **🌐 域名管理** - 支持多域名绑定和DNS解析检查
- **🔒 安全部署** - 自动SSL证书申请和安全配置

## 🏗️ 技术栈

### 前端
- **React 18** + **TypeScript** + **Vite** - 现代前端开发
- **TailwindCSS** - 快速UI样式开发
- **Zustand** - 轻量级状态管理
- **React Query** - 服务器状态管理
- **Monaco Editor** - 代码编辑器
- **Framer Motion** - 动画效果

### 后端
- **Node.js** + **Express** + **TypeScript** - 高性能API服务
- **Prisma** + **PostgreSQL** - 现代数据库ORM
- **JWT** + **bcrypt** - 安全认证
- **OpenAI/Claude API** - AI集成
- **WebSocket** - 实时通信

### 服务器
- **Nginx** - 反向代理和静态文件服务
- **Let's Encrypt** - 免费SSL证书
- **PostgreSQL** - 生产级数据库
- **systemd** - 服务管理

## 🚀 快速开始

### 1. 系统要求

- Node.js 18+ 
- PostgreSQL 12+
- Git

### 2. 本地开发环境

```bash
# 克隆项目
git clone https://github.com/leenbj/aiweb.git
cd aiweb

# 安装依赖
npm run install:all

# 配置环境变量
cp .env.example backend/.env
# 编辑 backend/.env 文件，填入必要的配置

# 设置数据库
cd backend
npx prisma migrate dev
npx prisma generate

# 启动开发服务器
cd ..
npm run dev
```

访问：
- 前端界面: http://localhost:3000
- API接口: http://localhost:3001
- API文档: http://localhost:3001/health

### 3. 生产环境部署

#### 服务器初始化

```bash
# 在服务器上运行（需要root权限）
sudo ./server-scripts/setup-server.sh
```

这个脚本会自动：
- 安装必需的软件包（Nginx, PostgreSQL, Node.js等）
- 创建应用用户和目录
- 配置防火墙和安全设置
- 设置定期备份和监控
- 配置systemd服务

#### 应用部署

```bash
# 部署应用（在服务器上运行）
sudo ./server-scripts/deploy.sh [repository-url] [branch]
```

部署脚本会：
- 拉取最新代码
- 安装依赖并构建
- 运行数据库迁移
- 启动服务
- 配置反向代理

## 📁 项目结构

```
ai-website-builder/
├── frontend/                 # React前端应用
│   ├── src/
│   │   ├── components/      # 可复用组件
│   │   ├── pages/          # 页面组件
│   │   ├── store/          # 状态管理
│   │   ├── services/       # API服务
│   │   └── utils/          # 工具函数
│   ├── public/             # 静态资源
│   └── package.json
│
├── backend/                  # Node.js后端API
│   ├── src/
│   │   ├── routes/         # API路由
│   │   ├── services/       # 业务逻辑
│   │   ├── constants/      # 系统常量（含默认提示词）
│   │   ├── middleware/     # 中间件
│   │   ├── database/       # 数据库配置
│   │   └── utils/          # 工具函数
│   ├── prisma/             # 数据库模型和迁移
│   └── package.json
│
├── shared/                   # 共享类型定义
│   └── types.ts
│
├── server-scripts/           # 服务器管理脚本
│   ├── setup-server.sh     # 服务器初始化
│   ├── deploy.sh           # 应用部署
│   └── backup.sh           # 备份脚本
│
└── nginx-templates/          # Nginx配置模板
    ├── default.conf
    └── ssl.conf
```

## 🎯 使用指南

### 智能提示词配置

系统支持三种独立的提示词配置，让AI更好地理解您的需求：

1. **对话聊天提示词**
   - 控制AI在日常对话中的回复风格和专业度
   - 自定义AI的角色和语气（专业顾问、创意助手等）
   - 设定回复的详细程度和专业领域重点

2. **网站生成提示词**
   - 控制AI生成新网站时的设计理念和技术规范
   - 指定设计风格偏好（现代简约、复古风格等）
   - 定义技术栈要求和响应式设计标准

3. **网站编辑提示词**
   - 控制AI编辑现有网站时的修改策略
   - 定义修改的保守程度和需要保留的元素
   - 设定代码优化标准

**配置方法**：在用户设置页面中，分别为三种场景配置专属提示词，自定义提示词将完全覆盖系统默认值。

### AI对话构建网页

1. **创建新网站**
   - 在仪表板点击"新建网站"
   - 输入网站标题和域名
   - 开始与AI对话

2. **自然语言指令示例**
   ```
   "创建一个现代风格的个人博客首页，包含导航栏、文章列表和侧边栏"
   "添加一个联系表单，使用蓝色主题"
   "让标题更大一些，并添加阴影效果"
   "优化移动端显示效果"
   ```

### 可视化编辑

1. **元素选择** - 点击任何页面元素进行选择
2. **内联编辑** - 双击文本元素直接编辑内容  
3. **样式调整** - 在属性面板调整颜色、字体、间距等
4. **响应式预览** - 切换设备视图查看不同屏幕效果

### 部署管理

1. **域名配置**
   - 设置域名DNS指向服务器IP
   - 系统自动检测DNS解析状态

2. **SSL证书**
   - DNS解析成功后自动申请Let's Encrypt证书
   - 自动配置HTTPS重定向

3. **部署监控**
   - 实时查看部署状态和日志
   - 自动重启失败的服务

## 🔧 配置选项

### 环境变量说明

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `AI_PROVIDER` | AI服务提供商 (openai/anthropic) | openai |
| `OPENAI_API_KEY` | OpenAI API密钥 | - |
| `ANTHROPIC_API_KEY` | Anthropic API密钥 | - |
| `DATABASE_URL` | PostgreSQL连接字符串 | - |
| `JWT_SECRET` | JWT签名密钥 | - |
| `SERVER_DOMAIN` | 服务器域名 | localhost |
| `SITES_PATH` | 网站文件存储路径 | /var/www/sites |

### Nginx配置

系统会为每个网站自动生成Nginx配置，包括：
- HTTP到HTTPS重定向
- 静态文件缓存
- Gzip压缩
- 安全头设置

## 🛡️ 安全特性

- **JWT身份验证** - 安全的用户认证机制
- **密码加密** - 使用bcrypt加密存储密码
- **CSRF保护** - 防止跨站请求伪造攻击
- **SQL注入防护** - 使用Prisma ORM防止SQL注入
- **文件权限控制** - 严格的服务器文件权限管理
- **SSL/TLS加密** - 自动HTTPS证书配置

## 📊 监控和维护

### 日志管理
```bash
# 查看应用日志
journalctl -u ai-website-builder-backend -f

# 查看Nginx日志
tail -f /var/log/nginx/access.log
```

### 数据备份
```bash
# 手动备份
/usr/local/bin/backup-websites.sh

# 查看备份文件
ls -la /var/backups/ai-website-builder/
```

### 性能监控
```bash
# 系统资源监控
/usr/local/bin/monitor-websites.sh

# 查看系统状态
systemctl status ai-website-builder-backend
```

## 🤝 贡献指南

1. Fork本项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 📄 许可证

本项目基于MIT许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙋 支持

如果您遇到问题或有建议：

1. 查看 [常见问题](docs/FAQ.md)
2. 搜索或创建 [Issues](https://github.com/leenbj/aiweb/issues)
3. 查看 [文档](docs/)

## 🎉 感谢

- [OpenAI](https://openai.com) - GPT API支持
- [Anthropic](https://anthropic.com) - Claude API支持
- [Vercel](https://vercel.com) - 部署平台
- 所有贡献者和社区成员

---

**AI Website Builder** - 让每个人都能轻松创建专业网站 🚀