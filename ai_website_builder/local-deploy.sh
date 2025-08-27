#!/bin/bash

# AI网站构建器本地部署脚本
# 一键设置本地开发和测试环境

set -e  # 遇到错误立即退出

echo "🚀 开始部署 AI 网站构建器本地环境..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查必要工具
check_prerequisites() {
    echo -e "${BLUE}检查系统依赖...${NC}"
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js 未安装。请先安装 Node.js 18+${NC}"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//')
    REQUIRED_VERSION="18.0.0"
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then 
        echo -e "${RED}❌ Node.js 版本过低，需要 18.0.0+，当前版本: $NODE_VERSION${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Node.js 版本检查通过: $NODE_VERSION${NC}"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm 未安装${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ npm 已安装: $(npm -v)${NC}"
    
    # 检查 Docker (可选，用于 PostgreSQL)
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        echo -e "${GREEN}✅ Docker 已安装并运行: $(docker --version)${NC}"
        DOCKER_AVAILABLE=true
    else
        if command -v docker &> /dev/null; then
            echo -e "${YELLOW}⚠️  Docker 已安装但未运行，将使用本地 PostgreSQL${NC}"
        else
            echo -e "${YELLOW}⚠️  Docker 未安装，将使用本地 PostgreSQL${NC}"
        fi
        DOCKER_AVAILABLE=false
    fi
    
    # 检查 PostgreSQL
    if ! command -v psql &> /dev/null && [ "$DOCKER_AVAILABLE" = false ]; then
        echo -e "${RED}❌ PostgreSQL 未安装且 Docker 不可用${NC}"
        echo "请安装 PostgreSQL 或 Docker"
        exit 1
    fi
    
    if command -v psql &> /dev/null; then
        echo -e "${GREEN}✅ PostgreSQL 已安装: $(psql --version)${NC}"
    fi
}

# 创建环境配置文件
setup_env() {
    echo -e "${BLUE}设置环境配置...${NC}"
    
    if [ ! -f backend/.env ]; then
        cat > backend/.env << EOF
# 数据库配置
DATABASE_URL="postgresql://ai_builder:ai_builder_pass@localhost:5432/ai_website_builder"

# JWT 密钥
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# AI 服务配置 (可选，在设置页面配置)
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
DEEPSEEK_API_KEY=""

# 服务器配置
PORT=3001
NODE_ENV=development

# 文件上传路径
UPLOAD_PATH="./uploads"

# 网站部署路径 (本地测试用)
WEBSITES_PATH="./websites"

# CORS 配置
CORS_ORIGIN="http://localhost:3000"

# 速率限制配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# WebSocket 配置
WS_PORT=3002
EOF
        echo -e "${GREEN}✅ 后端环境配置已创建${NC}"
    else
        echo -e "${YELLOW}⚠️  后端环境配置已存在，跳过创建${NC}"
    fi
    
    if [ ! -f frontend/.env ]; then
        cat > frontend/.env << EOF
# API 配置
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3002

# 应用配置
VITE_APP_NAME="AI 网站构建器"
VITE_APP_VERSION="1.0.0"

# 上传限制
VITE_MAX_FILE_SIZE=10485760
VITE_ALLOWED_FILE_TYPES=".jpg,.jpeg,.png,.gif,.webp,.svg"
EOF
        echo -e "${GREEN}✅ 前端环境配置已创建${NC}"
    else
        echo -e "${YELLOW}⚠️  前端环境配置已存在，跳过创建${NC}"
    fi
}

# 数据库设置
setup_database() {
    echo -e "${BLUE}设置数据库...${NC}"
    echo -e "${BLUE}使用本地 PostgreSQL...${NC}"
    
    # 检查PostgreSQL服务是否运行
    if ! brew services list | grep postgresql | grep -q started; then
        echo -e "${BLUE}启动 PostgreSQL 服务...${NC}"
        brew services start postgresql@14 || brew services start postgresql
    fi
    
    # 等待PostgreSQL启动
    sleep 3
    
    # 创建数据库和用户
    echo -e "${BLUE}创建数据库和用户...${NC}"
    
    # 尝试连接到默认数据库创建用户和数据库
    psql postgres << 'EOF' 2>/dev/null || true
-- 创建用户 (如果不存在)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ai_builder') THEN
        CREATE USER ai_builder WITH PASSWORD 'ai_builder_pass';
        RAISE NOTICE '用户 ai_builder 已创建';
    ELSE
        RAISE NOTICE '用户 ai_builder 已存在';
    END IF;
END
$$;

-- 创建数据库 (如果不存在)
SELECT 'CREATE DATABASE ai_website_builder OWNER ai_builder'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ai_website_builder')\gexec

-- 授权
GRANT ALL PRIVILEGES ON DATABASE ai_website_builder TO ai_builder;
ALTER USER ai_builder CREATEDB;
EOF

    echo -e "${GREEN}✅ 本地 PostgreSQL 数据库已设置${NC}"
    
    # 等待数据库连接可用
    echo -e "${BLUE}测试数据库连接...${NC}"
    for i in {1..30}; do
        if PGPASSWORD=ai_builder_pass psql -h localhost -U ai_builder -d ai_website_builder -c "SELECT 1;" &> /dev/null; then
            echo -e "${GREEN}✅ 数据库连接成功${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
}

# 安装依赖
install_dependencies() {
    echo -e "${BLUE}安装项目依赖...${NC}"
    
    # 根目录依赖
    echo -e "${BLUE}安装根目录依赖...${NC}"
    npm install
    
    # 前端依赖
    echo -e "${BLUE}安装前端依赖...${NC}"
    cd frontend
    npm install
    cd ..
    
    # 后端依赖
    echo -e "${BLUE}安装后端依赖...${NC}"
    cd backend
    npm install
    cd ..
    
    echo -e "${GREEN}✅ 所有依赖安装完成${NC}"
}

# 数据库迁移
setup_database_schema() {
    echo -e "${BLUE}设置数据库表结构...${NC}"
    
    cd backend
    
    # 生成 Prisma 客户端
    npx prisma generate
    
    # 运行数据库迁移
    npx prisma migrate dev --name init
    
    # 种子数据 (如果有)
    if [ -f "src/database/seed.ts" ]; then
        npm run db:seed
        echo -e "${GREEN}✅ 种子数据已插入${NC}"
    fi
    
    cd ..
    
    echo -e "${GREEN}✅ 数据库表结构设置完成${NC}"
}

# 构建项目
build_project() {
    echo -e "${BLUE}构建项目...${NC}"
    
    # 构建后端
    cd backend
    npm run build
    cd ..
    
    # 构建前端
    cd frontend
    npm run build
    cd ..
    
    echo -e "${GREEN}✅ 项目构建完成${NC}"
}

# 创建启动脚本
create_start_script() {
    cat > start.sh << 'EOF'
#!/bin/bash

echo "🚀 启动 AI 网站构建器..."

# 检查数据库连接
echo "检查数据库连接..."
if ! PGPASSWORD=ai_builder_pass psql -h localhost -U ai_builder -d ai_website_builder -c "SELECT 1;" &> /dev/null; then
    echo "❌ 数据库连接失败"
    echo "请确保 PostgreSQL 正在运行"
    echo "如果使用 Docker，请运行: docker start ai-builder-postgres"
    exit 1
fi

echo "✅ 数据库连接正常"

# 启动服务
echo "启动前后端服务..."
npm run dev

EOF
    chmod +x start.sh
    echo -e "${GREEN}✅ 启动脚本已创建${NC}"
}

# 创建停止脚本
create_stop_script() {
    cat > stop.sh << 'EOF'
#!/bin/bash

echo "🛑 停止 AI 网站构建器服务..."

# 停止开发服务器
pkill -f "vite"
pkill -f "nodemon"
pkill -f "tsx"

# 如果使用 Docker，可以选择停止数据库
read -p "是否停止 Docker PostgreSQL 容器? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker stop ai-builder-postgres
    echo "✅ PostgreSQL 容器已停止"
fi

echo "✅ 服务已停止"

EOF
    chmod +x stop.sh
    echo -e "${GREEN}✅ 停止脚本已创建${NC}"
}

# 创建测试脚本
create_test_script() {
    cat > test.sh << 'EOF'
#!/bin/bash

echo "🧪 运行 AI 网站构建器测试..."

# 检查服务状态
echo "检查服务状态..."

# 检查后端
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ 后端服务正常 (http://localhost:3001)"
else
    echo "❌ 后端服务无响应"
fi

# 检查前端
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ 前端服务正常 (http://localhost:3000)"
else
    echo "❌ 前端服务无响应"
fi

# 检查数据库
if PGPASSWORD=ai_builder_pass psql -h localhost -U ai_builder -d ai_website_builder -c "SELECT COUNT(*) FROM users;" &> /dev/null; then
    echo "✅ 数据库连接正常"
else
    echo "❌ 数据库连接失败"
fi

# 运行后端测试 (如果有)
if [ -f "backend/package.json" ] && grep -q "test" backend/package.json; then
    echo "运行后端测试..."
    cd backend
    npm test || echo "⚠️  后端测试失败或未配置"
    cd ..
fi

# 运行前端测试 (如果有)
if [ -f "frontend/package.json" ] && grep -q "test" frontend/package.json; then
    echo "运行前端测试..."
    cd frontend
    npm test || echo "⚠️  前端测试失败或未配置"
    cd ..
fi

echo "🎉 测试完成"

EOF
    chmod +x test.sh
    echo -e "${GREEN}✅ 测试脚本已创建${NC}"
}

# 显示使用说明
show_usage() {
    echo
    echo -e "${GREEN}🎉 部署完成！${NC}"
    echo
    echo -e "${BLUE}使用方法：${NC}"
    echo -e "  ${GREEN}启动服务：${NC}    ./start.sh"
    echo -e "  ${GREEN}停止服务：${NC}    ./stop.sh"
    echo -e "  ${GREEN}运行测试：${NC}    ./test.sh"
    echo
    echo -e "${BLUE}访问地址：${NC}"
    echo -e "  ${GREEN}前端界面：${NC}    http://localhost:3000"
    echo -e "  ${GREEN}后端API：${NC}     http://localhost:3001"
    echo
    echo -e "${BLUE}默认管理员账户（需要注册后创建）：${NC}"
    echo -e "  ${GREEN}邮箱：${NC}        admin@example.com"
    echo -e "  ${GREEN}密码：${NC}        admin123"
    echo
    echo -e "${BLUE}数据库连接信息：${NC}"
    echo -e "  ${GREEN}主机：${NC}        localhost:5432"
    echo -e "  ${GREEN}数据库：${NC}      ai_website_builder"
    echo -e "  ${GREEN}用户名：${NC}      ai_builder"
    echo -e "  ${GREEN}密码：${NC}        ai_builder_pass"
    echo
    echo -e "${YELLOW}注意事项：${NC}"
    echo "  • 首次使用前请在设置页面配置AI服务的API密钥"
    echo "  • 支持的AI服务：OpenAI、Anthropic Claude、DeepSeek"
    echo "  • 本地部署默认只能从localhost访问"
    echo "  • 生产部署请修改环境配置中的安全设置"
    echo
}

# 主执行流程
main() {
    echo -e "${GREEN}=== AI 网站构建器本地部署脚本 ===${NC}"
    echo
    
    check_prerequisites
    setup_env
    setup_database
    install_dependencies
    setup_database_schema
    build_project
    create_start_script
    create_stop_script
    create_test_script
    
    show_usage
}

# 执行主函数
main "$@"