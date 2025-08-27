# 部署指南

本文档提供AI Website Builder的完整部署指南。

## 🎯 部署架构

```
用户 → Nginx (Reverse Proxy) → Node.js API Server
                ↓
    静态网站文件 (Generated Sites) → PostgreSQL Database
```

## 📋 系统要求

### 服务器要求
- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **内存**: 最少2GB RAM (推荐4GB+)
- **存储**: 最少20GB SSD (推荐50GB+)
- **CPU**: 最少2核心 (推荐4核心+)
- **网络**: 稳定的互联网连接

### 软件要求
- Node.js 18+
- PostgreSQL 12+
- Nginx 1.18+
- Git
- Let's Encrypt (certbot)

## 🚀 快速部署

### 1. 一键服务器初始化

```bash
# 下载项目
git clone https://github.com/yourusername/ai-website-builder.git
cd ai-website-builder

# 运行服务器初始化脚本 (需要root权限)
sudo chmod +x server-scripts/setup-server.sh
sudo ./server-scripts/setup-server.sh
```

这个脚本会自动：
- ✅ 安装所有必要的软件包
- ✅ 创建应用用户和目录结构
- ✅ 配置PostgreSQL数据库
- ✅ 设置Nginx反向代理
- ✅ 配置防火墙和安全设置
- ✅ 设置systemd服务
- ✅ 配置日志轮转和监控

### 2. 部署应用

```bash
# 部署应用代码
sudo chmod +x server-scripts/deploy.sh
sudo ./server-scripts/deploy.sh
```

部署脚本会：
- ✅ 拉取最新代码
- ✅ 安装依赖并构建项目
- ✅ 运行数据库迁移
- ✅ 启动所有服务
- ✅ 配置域名和SSL

## ⚙️ 手动部署 (详细步骤)

如果你需要更多控制或自定义配置，可以按照以下步骤手动部署：

### 1. 系统准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装必要软件
sudo apt install -y nodejs npm postgresql postgresql-contrib nginx git certbot python3-certbot-nginx
```

### 2. 创建数据库

```bash
# 切换到postgres用户
sudo -u postgres psql

# 在PostgreSQL中执行
CREATE DATABASE ai_website_builder;
CREATE USER website_builder WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ai_website_builder TO website_builder;
\q
```

### 3. 克隆并配置项目

```bash
# 创建应用目录
sudo mkdir -p /home/website-builder
sudo useradd -r -m -s /bin/bash website-builder
sudo chown -R website-builder:website-builder /home/website-builder

# 克隆项目
cd /home/website-builder
sudo -u website-builder git clone https://github.com/yourusername/ai-website-builder.git
cd ai-website-builder
```

### 4. 安装依赖

```bash
# 安装根依赖
sudo -u website-builder npm install

# 安装后端依赖
cd backend
sudo -u website-builder npm install

# 安装前端依赖
cd ../frontend
sudo -u website-builder npm install
```

### 5. 配置环境变量

```bash
# 复制并编辑后端环境配置
cd ../backend
sudo -u website-builder cp .env.example .env
sudo -u website-builder nano .env
```

配置以下关键变量：
```env
DATABASE_URL=postgresql://website-builder:your_secure_password@localhost:5432/ai_website_builder
JWT_SECRET=your-super-secure-jwt-secret-here
OPENAI_API_KEY=your-openai-api-key
SERVER_DOMAIN=your-domain.com
SERVER_IP=your-server-ip
```

### 6. 构建项目

```bash
# 构建后端
cd backend
sudo -u website-builder npm run build

# 构建前端
cd ../frontend
sudo -u website-builder npm run build
```

### 7. 运行数据库迁移

```bash
cd ../backend
sudo -u website-builder npx prisma migrate deploy
sudo -u website-builder npx prisma generate
```

### 8. 配置Nginx

```bash
# 创建Nginx配置
sudo nano /etc/nginx/sites-available/ai-website-builder
```

Nginx配置示例：
```nginx
# 管理后台
server {
    listen 80;
    server_name admin.your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 用户网站托管
server {
    listen 80 default_server;
    server_name _;
    
    root /var/www/sites/$host;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 如果网站不存在，显示默认页面
    error_page 404 /404.html;
    location = /404.html {
        root /var/www/html;
        internal;
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/ai-website-builder /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 9. 创建systemd服务

后端服务：
```bash
sudo nano /etc/systemd/system/ai-website-builder-backend.service
```

```ini
[Unit]
Description=AI Website Builder Backend
After=network.target postgresql.service

[Service]
Type=simple
User=website-builder
WorkingDirectory=/home/website-builder/ai-website-builder/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=production
EnvironmentFile=/home/website-builder/ai-website-builder/backend/.env

[Install]
WantedBy=multi-user.target
```

前端服务：
```bash
sudo nano /etc/systemd/system/ai-website-builder-frontend.service
```

```ini
[Unit]
Description=AI Website Builder Frontend
After=network.target

[Service]
Type=simple
User=website-builder
WorkingDirectory=/home/website-builder/ai-website-builder/frontend
ExecStart=/usr/bin/npx serve -s dist -l 3000
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 10. 启动服务

```bash
# 重新加载systemd
sudo systemctl daemon-reload

# 启动并启用服务
sudo systemctl enable ai-website-builder-backend
sudo systemctl enable ai-website-builder-frontend
sudo systemctl start ai-website-builder-backend
sudo systemctl start ai-website-builder-frontend

# 检查状态
sudo systemctl status ai-website-builder-backend
sudo systemctl status ai-website-builder-frontend
```

## 🔒 SSL配置

### 自动SSL (推荐)

```bash
# 申请SSL证书
sudo certbot --nginx -d admin.your-domain.com

# 设置自动续期
sudo crontab -e
# 添加以下行：
0 12 * * * /usr/bin/certbot renew --quiet
```

### 通配符SSL

```bash
# 申请通配符证书
sudo certbot certonly --manual --preferred-challenges dns -d "*.your-domain.com" -d "your-domain.com"

# 手动配置Nginx使用通配符证书
```

## 📊 监控和维护

### 1. 日志管理

```bash
# 查看应用日志
sudo journalctl -u ai-website-builder-backend -f
sudo journalctl -u ai-website-builder-frontend -f

# 查看Nginx日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 2. 性能监控

```bash
# 安装htop和iotop
sudo apt install htop iotop

# 监控系统资源
htop
iotop

# 检查磁盘使用
df -h
du -sh /var/www/sites/*
```

### 3. 数据库维护

```bash
# 备份数据库
sudo -u postgres pg_dump ai_website_builder > backup.sql

# 恢复数据库
sudo -u postgres psql ai_website_builder < backup.sql

# 查看数据库大小
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('ai_website_builder'));"
```

### 4. 自动备份

创建备份脚本：
```bash
sudo nano /usr/local/bin/backup-websites.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/ai-website-builder"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR/$DATE"

# 备份数据库
sudo -u postgres pg_dump ai_website_builder > "$BACKUP_DIR/$DATE/database.sql"

# 备份网站文件
rsync -av /var/www/sites/ "$BACKUP_DIR/$DATE/sites/"

# 删除30天前的备份
find "$BACKUP_DIR" -type d -name "20*" -mtime +30 -exec rm -rf {} \;
```

设置定时任务：
```bash
sudo chmod +x /usr/local/bin/backup-websites.sh
sudo crontab -e
# 添加每天凌晨2点备份
0 2 * * * /usr/local/bin/backup-websites.sh
```

## 🔧 故障排除

### 常见问题

1. **服务无法启动**
   ```bash
   # 检查日志
   sudo journalctl -u ai-website-builder-backend -n 50
   
   # 检查端口占用
   sudo netstat -tlnp | grep :3001
   
   # 检查权限
   sudo chown -R website-builder:website-builder /home/website-builder/ai-website-builder
   ```

2. **数据库连接失败**
   ```bash
   # 检查PostgreSQL状态
   sudo systemctl status postgresql
   
   # 测试数据库连接
   sudo -u website-builder psql -h localhost -U website-builder -d ai_website_builder
   
   # 检查防火墙
   sudo ufw status
   ```

3. **Nginx配置错误**
   ```bash
   # 测试配置
   sudo nginx -t
   
   # 重新加载配置
   sudo systemctl reload nginx
   
   # 检查错误日志
   sudo tail -f /var/log/nginx/error.log
   ```

4. **SSL证书问题**
   ```bash
   # 检查证书状态
   sudo certbot certificates
   
   # 手动续期
   sudo certbot renew --dry-run
   
   # 重新申请证书
   sudo certbot delete
   sudo certbot --nginx -d your-domain.com
   ```

### 性能优化

1. **数据库优化**
   ```bash
   # 优化PostgreSQL配置
   sudo nano /etc/postgresql/12/main/postgresql.conf
   
   # 添加以下配置（根据服务器配置调整）
   shared_buffers = 256MB
   effective_cache_size = 1GB
   work_mem = 4MB
   maintenance_work_mem = 64MB
   ```

2. **Nginx优化**
   ```bash
   # 启用gzip压缩和缓存
   sudo nano /etc/nginx/nginx.conf
   
   # 在http块中添加
   gzip on;
   gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
   
   # 设置客户端缓存
   location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

3. **应用优化**
   ```bash
   # 使用PM2管理Node.js进程
   sudo npm install -g pm2
   
   # 启动应用
   cd /home/website-builder/ai-website-builder/backend
   sudo -u website-builder pm2 start dist/index.js --name "ai-backend"
   sudo -u website-builder pm2 save
   sudo -u website-builder pm2 startup
   ```

## 🔄 更新部署

```bash
# 拉取最新代码
cd /home/website-builder/ai-website-builder
sudo -u website-builder git pull origin main

# 安装新依赖
cd backend && sudo -u website-builder npm install
cd ../frontend && sudo -u website-builder npm install

# 运行数据库迁移
cd ../backend && sudo -u website-builder npx prisma migrate deploy

# 构建项目
sudo -u website-builder npm run build
cd ../frontend && sudo -u website-builder npm run build

# 重启服务
sudo systemctl restart ai-website-builder-backend
sudo systemctl restart ai-website-builder-frontend
```

## 📞 技术支持

如果遇到部署问题，请：

1. 检查[故障排除](#故障排除)部分
2. 查看项目[Issues](https://github.com/yourusername/ai-website-builder/issues)
3. 联系技术支持团队

---

**注意**: 确保在生产环境中更改所有默认密码和密钥，并定期更新系统和依赖包。