#!/bin/bash

# 端口清理脚本 - AI Website Builder
# 用于清理端口3000和3001，确保前后端能正常启动

echo "🔍 检查端口占用情况..."

# 检查端口3000
echo "检查端口3000:"
PORT_3000_PIDS=$(lsof -ti :3000)
if [ ! -z "$PORT_3000_PIDS" ]; then
    echo "发现占用端口3000的进程: $PORT_3000_PIDS"
    echo "🔧 杀死端口3000的进程..."
    kill -9 $PORT_3000_PIDS
    echo "✅ 端口3000已清理"
else
    echo "✅ 端口3000空闲"
fi

# 检查端口3001
echo "检查端口3001:"
PORT_3001_PIDS=$(lsof -ti :3001)
if [ ! -z "$PORT_3001_PIDS" ]; then
    echo "发现占用端口3001的进程: $PORT_3001_PIDS"
    echo "🔧 杀死端口3001的进程..."
    kill -9 $PORT_3001_PIDS
    echo "✅ 端口3001已清理"
else
    echo "✅ 端口3001空闲"
fi

echo ""
echo "🎉 端口清理完成！"
echo "📝 现在可以启动服务："
echo "   后端: cd backend && npm run dev  (端口3001)"
echo "   前端: cd frontend && npm run dev (端口3000)"
echo ""









