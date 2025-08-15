#!/bin/bash

# AI Orchestra PM2 Setup Script
# 用于设置和管理 PM2 进程的脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖项..."
    
    # 检查 PM2
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 未安装，正在安装..."
        npm install -g pm2
        log_success "PM2 安装完成"
    else
        log_success "PM2 已安装: $(pm2 --version)"
    fi
    
    # 检查 pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm 未安装，请先安装 pnpm"
        exit 1
    else
        log_success "pnpm 已安装: $(pnpm --version)"
    fi
}

# 构建项目
build_project() {
    log_info "构建项目..."
    pnpm build
    log_success "项目构建完成"
}

# 创建日志目录
create_log_dirs() {
    log_info "创建日志目录..."
    mkdir -p logs
    log_success "日志目录创建完成"
}

# 启动服务
start_services() {
    log_info "启动 AI Orchestra 服务..."
    
    # 停止现有进程（如果存在）
    pm2 delete all 2>/dev/null || true
    
    # 启动新进程
    pm2 start ecosystem.config.js --env production
    
    # 保存 PM2 配置
    pm2 save
    
    # 设置开机自启
    pm2 startup
    
    log_success "服务启动完成"
}

# 显示状态
show_status() {
    log_info "服务状态:"
    pm2 status
    pm2 logs --lines 10
}

# 主函数
main() {
    log_info "开始设置 AI Orchestra PM2 环境..."
    
    check_dependencies
    create_log_dirs
    build_project
    start_services
    show_status
    
    log_success "AI Orchestra PM2 设置完成！"
    echo ""
    echo "可用命令:"
    echo "  pm2 status          - 查看服务状态"
    echo "  pm2 logs            - 查看实时日志"
    echo "  pm2 restart all     - 重启所有服务"
    echo "  pm2 stop all        - 停止所有服务"
    echo "  pm2 delete all      - 删除所有服务"
    echo "  pm2 monit           - 监控界面"
}

# 运行主函数
main "$@"