#!/bin/bash

# AI Orchestra PM2 开发环境管理脚本
# 专门用于开发环境的 PM2 进程管理

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

log_cmd() {
    echo -e "${PURPLE}[CMD]${NC} $1"
}

# 显示帮助信息
show_help() {
    echo -e "${CYAN}AI Orchestra PM2 开发环境管理工具${NC}"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  start       启动开发环境 (默认)"
    echo "  stop        停止开发环境"
    echo "  restart     重启开发环境"
    echo "  status      查看运行状态"
    echo "  logs        查看实时日志"
    echo "  logs-tail   实时跟踪日志"
    echo "  monitor     打开监控界面"
    echo "  kill        强制杀死所有进程"
    echo "  clean       清理日志文件"
    echo "  health      健康检查"
    echo "  help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 start    # 启动开发环境"
    echo "  $0 logs     # 查看日志"
    echo "  $0 health   # 检查服务健康状态"
}

# 创建日志目录
create_log_dirs() {
    mkdir -p logs
}

# 检查 PM2 是否安装
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 未安装，请先安装: npm install -g pm2"
        exit 1
    fi
}

# 启动开发环境
start_dev() {
    log_info "启动 AI Orchestra 开发环境..."
    
    # 检查是否已经运行
    if pm2 list | grep -q "ai-orchestra.*online"; then
        log_warning "检测到已有运行中的进程，先停止它们..."
        stop_dev
        sleep 2
    fi
    
    create_log_dirs
    
    log_cmd "pm2 start ecosystem.dev.config.js"
    pm2 start ecosystem.dev.config.js
    
    log_success "开发环境启动完成！"
    
    # 显示状态
    sleep 1
    show_status
    
    echo ""
    log_info "服务地址:"
    echo "  🌐 Web前端: http://localhost:3001"
    echo "  🚀 API服务: http://localhost:3000"
    echo ""
    log_info "管理命令:"
    echo "  pnpm run pm2:logs:dev  # 查看日志"
    echo "  pnpm run pm2:status    # 查看状态"
    echo "  pnpm run pm2:monit     # 监控界面"
}

# 停止开发环境
stop_dev() {
    log_info "停止 AI Orchestra 开发环境..."
    
    log_cmd "pm2 stop ecosystem.dev.config.js"
    pm2 stop ecosystem.dev.config.js 2>/dev/null || true
    
    log_success "开发环境已停止"
}

# 重启开发环境
restart_dev() {
    log_info "重启 AI Orchestra 开发环境..."
    
    log_cmd "pm2 restart ecosystem.dev.config.js"
    pm2 restart ecosystem.dev.config.js
    
    log_success "开发环境重启完成"
    show_status
}

# 显示状态
show_status() {
    log_info "当前运行状态:"
    pm2 status
}

# 查看日志
show_logs() {
    log_info "显示开发环境日志 (最近50行):"
    pm2 logs ai-orchestra-server-dev ai-orchestra-web-dev --lines 50
}

# 实时跟踪日志
tail_logs() {
    log_info "实时跟踪开发环境日志 (Ctrl+C 退出):"
    pm2 logs ai-orchestra-server-dev ai-orchestra-web-dev
}

# 监控界面
show_monitor() {
    log_info "打开 PM2 监控界面 (Ctrl+C 退出):"
    pm2 monit
}

# 强制杀死进程
kill_all() {
    log_warning "强制杀死所有 AI Orchestra 进程..."
    
    log_cmd "pm2 delete all"
    pm2 delete all 2>/dev/null || true
    
    log_success "所有进程已被杀死"
}

# 清理日志
clean_logs() {
    log_info "清理日志文件..."
    
    log_cmd "pm2 flush"
    pm2 flush
    
    if [ -d "logs" ]; then
        log_cmd "rm -f logs/*"
        rm -f logs/*
    fi
    
    log_success "日志文件已清理"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    # 检查进程状态
    if ! pm2 list | grep -q "ai-orchestra.*online"; then
        log_error "没有运行中的 AI Orchestra 进程"
        return 1
    fi
    
    # 检查端口
    if command -v nc &> /dev/null; then
        if nc -z localhost 3000; then
            log_success "API服务 (端口3000) 正常"
        else
            log_error "API服务 (端口3000) 无响应"
        fi
        
        if nc -z localhost 3001; then
            log_success "Web前端 (端口3001) 正常"
        else
            log_warning "Web前端 (端口3001) 可能仍在启动中..."
        fi
    else
        log_warning "nc 命令不可用，跳过端口检查"
    fi
    
    # 检查内存使用
    echo ""
    log_info "内存使用情况:"
    pm2 list | grep -E "(ai-orchestra|memory)"
    
    log_success "健康检查完成"
}

# 主函数
main() {
    check_pm2
    
    case "${1:-start}" in
        start)
            start_dev
            ;;
        stop)
            stop_dev
            ;;
        restart)
            restart_dev
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        logs-tail)
            tail_logs
            ;;
        monitor|monit)
            show_monitor
            ;;
        kill)
            kill_all
            ;;
        clean)
            clean_logs
            ;;
        health)
            health_check
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"