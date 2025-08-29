#!/bin/bash

# GitHub自动同步脚本
# 用法: ./sync-to-github.sh "提交消息"

set -e  # 遇到错误立即退出

# 检查是否有未提交的更改
if git diff --quiet && git diff --staged --quiet; then
    echo "✅ 没有需要提交的更改"
    exit 0
fi

# 如果没有提供提交消息，使用默认消息
COMMIT_MESSAGE=${1:-"自动同步代码更新"}

echo "🔄 开始同步代码到GitHub..."

# 添加所有更改
echo "📁 添加文件到暂存区..."
git add .

# 检查是否有文件需要提交
if git diff --staged --quiet; then
    echo "✅ 没有需要提交的更改"
    exit 0
fi

# 提交更改
echo "💾 提交更改..."
git commit -m "$COMMIT_MESSAGE"

# 推送到GitHub
echo "🚀 推送代码到GitHub..."
git push origin main

echo "✅ 代码同步完成！"
echo "📊 同步统计:"
git log --oneline -5
