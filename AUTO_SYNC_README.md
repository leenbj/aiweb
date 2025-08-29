# GitHub自动同步指南

本项目已配置自动同步到GitHub仓库的功能。

## 📋 当前状态
- ✅ Git仓库已初始化
- ✅ 已连接到GitHub仓库: `https://github.com/leenbj/AIWebify.git`
- ✅ 最新代码已推送
- ✅ GitHub Actions部署工作流已配置

## 🚀 自动同步功能

### 方法1: 使用自动同步脚本
```bash
# 自动同步所有更改
./sync-to-github.sh

# 自定义提交消息
./sync-to-github.sh "修复了某个bug"
```

### 方法2: 设置Git Hooks自动同步
```bash
# 启用自动同步（每次提交都会自动推送）
./setup-auto-sync.sh

# 之后每次提交都会自动推送
git add .
git commit -m "你的提交消息"
# 代码会自动推送到GitHub
```

### 方法3: 手动同步
```bash
# 传统方式
git add .
git commit -m "提交消息"
git push origin main
```

## 🔧 GitHub Actions部署

项目已配置GitHub Actions自动部署：

- **触发条件**: 推送到main分支
- **部署位置**: 服务器 `/var/www/ai-webify`
- **功能**: 自动构建和重启服务

### 配置部署密钥

要在GitHub中启用自动部署，需要设置以下密钥：

1. 进入GitHub仓库设置
2. 选择 "Secrets and variables" → "Actions"
3. 添加以下密钥：
   - `SERVER_HOST`: 服务器IP地址
   - `SERVER_USERNAME`: 服务器用户名
   - `SERVER_SSH_KEY`: SSH私钥
   - `SERVER_PORT`: SSH端口（可选，默认为22）

## 📊 查看同步状态

```bash
# 查看最后几次提交
git log --oneline -5

# 查看远程仓库状态
git remote -v

# 检查是否有未同步的更改
git status
```

## 🛠️ 故障排除

### 推送失败
```bash
# 检查远程仓库配置
git remote -v

# 重新设置远程仓库
git remote set-url origin https://github.com/leenbj/AIWebify.git

# 强制推送（如果需要）
git push -f origin main
```

### 权限问题
```bash
# 检查SSH配置
ssh -T git@github.com

# 如果需要生成新的SSH密钥
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
```

## 📝 使用建议

1. **定期提交**: 建议每次完成一个功能后及时提交
2. **清晰的提交消息**: 使用有意义的提交消息
3. **分支管理**: 重要功能建议使用分支开发
4. **定期备份**: 虽然GitHub提供了版本控制，但建议定期备份重要数据

## 🎯 自动化工作流

项目包含以下自动化功能：

- **代码检查**: 每次推送都会运行linter检查
- **自动部署**: 推送到main分支后自动部署到服务器
- **依赖管理**: 自动安装和更新依赖
- **构建优化**: 自动构建前端资源

## 📞 支持

如果遇到同步问题，请检查：
1. 网络连接是否正常
2. GitHub仓库权限是否正确
3. SSH密钥是否有效
4. 服务器配置是否正确
