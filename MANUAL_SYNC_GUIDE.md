# 手动同步到GitHub指南

自动同步机制已关闭，现在需要手动同步代码到GitHub仓库。

## 📋 当前状态
- ✅ 项目已连接到GitHub仓库: `https://github.com/leenbj/AIWebify.git`
- ✅ Git仓库正常工作
- ❌ 自动同步功能已关闭

## 🚀 手动同步步骤

### 方法1: 完整同步流程
```bash
# 1. 添加所有更改到暂存区
git add .

# 2. 提交更改（请使用有意义的提交消息）
git commit -m "你的提交消息"

# 3. 推送到GitHub
git push origin main
```

### 方法2: 一步到位同步
```bash
# 添加并提交所有更改，然后推送
git add . && git commit -m "更新内容描述" && git push origin main
```

### 方法3: 只推送已暂存的更改
```bash
# 如果已经添加了文件到暂存区
git commit -m "你的提交消息"
git push origin main
```

## 📊 查看同步状态

```bash
# 查看工作区状态
git status

# 查看最后几次提交
git log --oneline -5

# 查看分支状态
git branch -a

# 查看远程仓库信息
git remote -v
```

## 🛠️ 故障排除

### 提交失败
```bash
# 检查是否有未解决的冲突
git status

# 如果有冲突，解决后再提交
# 编辑冲突文件，删除冲突标记（<<<<<<<，=======，>>>>>>>）
# 然后重新添加和提交
git add <conflict-file>
git commit -m "解决冲突"
```

### 推送失败
```bash
# 检查网络连接
ping github.com

# 检查远程仓库配置
git remote -v

# 重新设置远程仓库
git remote set-url origin https://github.com/leenbj/AIWebify.git

# 强制推送（谨慎使用）
git push -f origin main
```

### 权限问题
```bash
# 检查SSH配置
ssh -T git@github.com

# 如果需要，更新SSH密钥
# 1. 生成新的SSH密钥
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# 2. 添加到ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_rsa

# 3. 复制公钥到GitHub
cat ~/.ssh/id_rsa.pub
# 然后将输出内容添加到GitHub的SSH Keys设置中
```

## 📝 最佳实践

1. **频繁提交**: 建议每个功能或修复完成后及时提交
2. **清晰的提交消息**: 使用描述性的提交消息
   ```bash
   # 好的提交消息示例
   git commit -m "feat: 添加用户登录功能"
   git commit -m "fix: 修复登录页面的样式问题"
   git commit -m "docs: 更新README安装说明"

   # 不好的提交消息示例
   git commit -m "update"
   git commit -m "fix bug"
   git commit -m "修改了一些东西"
   ```

3. **定期推送**: 不要积累太多未推送的提交
4. **检查状态**: 提交前用`git status`检查更改

## 🔄 如果需要重新启用自动同步

如果将来需要重新启用自动同步功能，请运行：

```bash
# 重新启用自动同步（需要重新创建相关文件）
# 具体步骤请参考之前的AUTO_SYNC_README.md文档
```

## 📞 获取帮助

如果遇到同步问题：
1. 检查网络连接是否正常
2. 确认GitHub仓库权限是否正确
3. 验证SSH密钥是否有效
4. 查看Git状态和错误信息

## 📈 提交历史

查看项目提交历史：
```bash
# 查看最近10次提交
git log --oneline -10

# 查看某个文件的修改历史
git log --oneline <filename>

# 查看提交的详细统计
git shortlog -sn
```
