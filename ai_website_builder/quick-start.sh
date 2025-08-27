#!/bin/bash

# AI网站构建器一键启动测试脚本
# 快速启动本地开发环境并运行基础测试

set -e  # 遇到错误立即退出

echo "🚀 AI 网站构建器一键启动测试"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 检查项目是否已经配置
check_setup() {
    echo -e "${BLUE}检查项目配置状态...${NC}"
    
    if [ ! -f "backend/.env" ]; then
        echo -e "${YELLOW}⚠️  后端环境配置不存在${NC}"
        echo -e "${BLUE}正在从模板创建...${NC}"
        
        if [ -f ".env.example" ]; then
            cp .env.example backend/.env
            echo -e "${GREEN}✅ 已从模板创建后端环境配置${NC}"
        else
            echo -e "${RED}❌ 找不到环境配置模板${NC}"
            echo "请先运行 ./local-deploy.sh 进行完整部署"
            exit 1
        fi
    fi
    
    if [ ! -f "frontend/.env" ]; then
        echo -e "${BLUE}创建前端环境配置...${NC}"
        cat > frontend/.env << 'EOF'
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3002
VITE_APP_NAME=AI 网站构建器
VITE_APP_VERSION=1.0.0
VITE_MAX_FILE_SIZE=10485760
VITE_ALLOWED_FILE_TYPES=.jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.zip
EOF
        echo -e "${GREEN}✅ 前端环境配置已创建${NC}"
    fi
    
    echo -e "${GREEN}✅ 项目配置检查完成${NC}"
}

# 检查并启动数据库
check_database() {
    echo -e "${BLUE}检查数据库连接...${NC}"
    
    # 检查 Docker PostgreSQL
    if command -v docker &> /dev/null; then
        if ! docker ps | grep -q "ai-builder-postgres"; then
            echo -e "${YELLOW}⚠️  PostgreSQL Docker 容器未运行${NC}"
            echo -e "${BLUE}正在启动 PostgreSQL 容器...${NC}"
            
            # 停止可能存在的容器
            docker stop ai-builder-postgres 2>/dev/null || true
            docker rm ai-builder-postgres 2>/dev/null || true
            
            # 启动新容器
            docker run -d \
                --name ai-builder-postgres \
                -e POSTGRES_DB=ai_website_builder \
                -e POSTGRES_USER=ai_builder \
                -e POSTGRES_PASSWORD=ai_builder_pass \
                -p 5432:5432 \
                -v ai_builder_data:/var/lib/postgresql/data \
                postgres:15-alpine
            
            echo -e "${BLUE}等待数据库启动...${NC}"
            sleep 15
        else
            echo -e "${GREEN}✅ PostgreSQL Docker 容器正在运行${NC}"
        fi
    fi
    
    # 测试数据库连接
    for i in {1..30}; do
        if PGPASSWORD=ai_builder_pass psql -h localhost -U ai_builder -d ai_website_builder -c "SELECT 1;" &> /dev/null; then
            echo -e "${GREEN}✅ 数据库连接成功${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo -e "${RED}❌ 数据库连接失败${NC}"
    echo "请检查 PostgreSQL 是否正确安装并运行"
    return 1
}

# 快速安装依赖
quick_install() {
    echo -e "${BLUE}检查并安装依赖...${NC}"
    
    # 检查根目录依赖
    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}安装根目录依赖...${NC}"
        npm install --silent
    fi
    
    # 检查前端依赖
    if [ ! -d "frontend/node_modules" ]; then
        echo -e "${BLUE}安装前端依赖...${NC}"
        cd frontend && npm install --silent && cd ..
    fi
    
    # 检查后端依赖
    if [ ! -d "backend/node_modules" ]; then
        echo -e "${BLUE}安装后端依赖...${NC}"
        cd backend && npm install --silent && cd ..
    fi
    
    echo -e "${GREEN}✅ 依赖检查完成${NC}"
}

# 数据库迁移和种子数据
setup_db_schema() {
    echo -e "${BLUE}设置数据库结构...${NC}"
    
    cd backend
    
    # 生成 Prisma 客户端
    npx prisma generate > /dev/null 2>&1
    
    # 检查是否需要迁移
    if ! npx prisma migrate status > /dev/null 2>&1; then
        echo -e "${BLUE}运行数据库迁移...${NC}"
        npx prisma migrate dev --name init > /dev/null 2>&1
    else
        echo -e "${GREEN}✅ 数据库迁移已是最新${NC}"
    fi
    
    # 运行种子数据
    if [ -f "src/database/seed.ts" ]; then
        echo -e "${BLUE}初始化种子数据...${NC}"
        npm run db:seed > /dev/null 2>&1 || echo -e "${YELLOW}⚠️  种子数据可能已存在${NC}"
    fi
    
    cd ..
    
    echo -e "${GREEN}✅ 数据库结构设置完成${NC}"
}

# 构建项目
quick_build() {
    echo -e "${BLUE}快速构建项目...${NC}"
    
    # 只构建后端，前端在开发模式下不需要构建
    cd backend
    if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
        npm run build > /dev/null 2>&1
    fi
    cd ..
    
    echo -e "${GREEN}✅ 项目构建完成${NC}"
}

# 启动服务
start_services() {
    echo -e "${BLUE}启动开发服务器...${NC}"
    
    # 检查端口占用
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}⚠️  端口 3001 已被占用，尝试停止现有进程...${NC}"
        pkill -f "nodemon" || pkill -f "node.*3001" || true
        sleep 2
    fi
    
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}⚠️  端口 3000 已被占用，尝试停止现有进程...${NC}"
        pkill -f "vite" || pkill -f "dev" || true
        sleep 2
    fi
    
    echo -e "${GREEN}🎉 启动开发服务器...${NC}"
    echo -e "${BLUE}前端地址: http://localhost:3000${NC}"
    echo -e "${BLUE}后端地址: http://localhost:3001${NC}"
    echo ""
    echo -e "${YELLOW}按 Ctrl+C 停止所有服务${NC}"
    echo ""
    
    # 启动开发服务器
    npm run dev
}

# 运行基础测试
run_tests() {
    echo -e "${BLUE}运行基础测试...${NC}"
    
    # 等待服务启动
    echo -e "${BLUE}等待服务启动完成...${NC}"
    sleep 5
    
    # 测试后端健康检查
    echo -e "${BLUE}测试后端服务...${NC}"
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 后端服务正常${NC}"
    else
        echo -e "${RED}❌ 后端服务无响应${NC}"
        return 1
    fi
    
    # 测试前端
    echo -e "${BLUE}测试前端服务...${NC}"
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 前端服务正常${NC}"
    else
        echo -e "${RED}❌ 前端服务无响应${NC}"
        return 1
    fi
    
    # 测试数据库连接
    echo -e "${BLUE}测试数据库连接...${NC}"
    if PGPASSWORD=ai_builder_pass psql -h localhost -U ai_builder -d ai_website_builder -c "SELECT COUNT(*) FROM users;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 数据库连接正常${NC}"
    else
        echo -e "${RED}❌ 数据库连接失败${NC}"
        return 1
    fi
    
    echo -e "${GREEN}🎉 所有基础测试通过！${NC}"
    return 0
}

# 显示启动信息
show_startup_info() {
    echo
    echo -e "${GREEN}🚀 AI 网站构建器启动成功！${NC}"
    echo
    echo -e "${BLUE}=== 访问地址 ===${NC}"
    echo -e "🌐 前端界面: ${GREEN}http://localhost:3000${NC}"
    echo -e "🔧 后端API:  ${GREEN}http://localhost:3001${NC}"
    echo
    echo -e "${BLUE}=== 默认测试账户 ===${NC}"
    echo -e "📧 管理员: ${GREEN}admin@example.com${NC} / ${GREEN}admin123${NC}"
    echo -e "👤 测试用户: ${GREEN}test@example.com${NC} / ${GREEN}test123${NC}"
    echo
    echo -e "${BLUE}=== 使用提示 ===${NC}"
    echo -e "1. 首次使用需要在设置页面配置 AI 服务的 API 密钥"
    echo -e "2. 支持 OpenAI、Anthropic Claude、DeepSeek 等AI服务"
    echo -e "3. 可以通过自然语言或可视化编辑器创建网站"
    echo -e "4. 创建的网站可以部署到指定域名"
    echo
    echo -e "${PURPLE}按 Ctrl+C 可停止所有服务${NC}"
    echo
}

# 清理函数
cleanup() {
    echo
    echo -e "${YELLOW}正在停止服务...${NC}"
    
    # 停止开发服务器
    pkill -f "vite" 2>/dev/null || true
    pkill -f "nodemon" 2>/dev/null || true
    pkill -f "tsx" 2>/dev/null || true
    
    echo -e "${GREEN}✅ 服务已停止${NC}"
    exit 0
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 主函数
main() {
    echo -e "${PURPLE}=== AI 网站构建器一键启动 ===${NC}"
    echo
    
    # 如果传入 --test 参数，只运行测试
    if [ "$1" = "--test" ]; then
        echo -e "${BLUE}运行测试模式...${NC}"
        run_tests
        exit $?
    fi
    
    # 如果传入 --build 参数，只构建项目
    if [ "$1" = "--build" ]; then
        echo -e "${BLUE}运行构建模式...${NC}"
        quick_build
        exit $?
    fi
    
    # 标准启动流程
    check_setup
    check_database || exit 1
    quick_install
    setup_db_schema
    quick_build
    show_startup_info
    start_services
}

# 帮助信息
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "AI 网站构建器一键启动脚本"
    echo
    echo "用法:"
    echo "  ./quick-start.sh           # 启动完整开发环境"
    echo "  ./quick-start.sh --test    # 仅运行测试检查"
    echo "  ./quick-start.sh --build   # 仅构建项目"
    echo "  ./quick-start.sh --help    # 显示帮助信息"
    echo
    echo "功能:"
    echo "  • 自动检查和配置环境"
    echo "  • 启动 PostgreSQL 数据库（Docker）"
    echo "  • 安装必要依赖"
    echo "  • 运行数据库迁移和种子数据"
    echo "  • 构建并启动前后端服务"
    echo "  • 运行基础健康检查"
    echo
    echo "访问地址:"
    echo "  前端: http://localhost:3000"
    echo "  后端: http://localhost:3001"
    echo
    exit 0
fi

# 执行主函数
main "$@"