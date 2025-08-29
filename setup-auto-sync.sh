#!/bin/bash

# 自动同步设置脚本
# 设置Git hooks实现自动同步

set -e

echo "🔧 设置GitHub自动同步..."

# 检查是否存在.git目录
if [ ! -d ".git" ]; then
    echo "❌ 错误：这不是一个Git仓库"
    exit 1
fi

# 创建hooks目录（如果不存在）
mkdir -p .git/hooks

# 创建pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# 自动同步pre-commit hook
echo "🔄 检测到代码更改，准备同步到GitHub..."

# 获取当前时间
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# 设置默认提交消息
COMMIT_MESSAGE="自动同步: $TIMESTAMP"

# 如果有命令行参数，使用它作为提交消息
if [ ! -z "$GIT_COMMIT_MESSAGE" ]; then
    COMMIT_MESSAGE="$GIT_COMMIT_MESSAGE"
fi

echo "📝 提交消息: $COMMIT_MESSAGE"

# 检查是否有需要提交的文件
if git diff --cached --quiet; then
    echo "⚠️  没有暂存的文件需要提交"
    exit 0
fi

echo "✅ pre-commit hook执行完成"
EOF

# 创建post-commit hook
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash

# 自动同步post-commit hook
echo "🚀 提交完成，正在推送代码到GitHub..."

# 推送到远程仓库
if git push origin main 2>/dev/null; then
    echo "✅ 代码已成功推送到GitHub"
else
    echo "❌ 推送失败，请手动推送"
    echo "运行: git push origin main"
fi
EOF

# 给hooks添加执行权限
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/post-commit

echo "✅ Git hooks已设置完成！"
echo ""
echo "📋 自动同步功能说明："
echo "1. 现在每次提交代码时会自动推送"
echo "2. 如果推送失败，会显示错误信息"
echo "3. 您也可以使用 ./sync-to-github.sh 手动同步"
echo ""
echo "🔍 测试同步功能："
echo "运行: echo 'test' > test.txt && git add test.txt && git commit -m '测试自动同步'"
