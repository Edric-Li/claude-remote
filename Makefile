# AI Orchestra PM2 管理 Makefile

.PHONY: help install build clean pm2-setup pm2-start pm2-dev pm2-stop pm2-restart pm2-delete pm2-status pm2-logs pm2-monit

# 默认目标
help:
	@echo "AI Orchestra PM2 管理命令:"
	@echo "  make install     - 安装依赖"
	@echo "  make build       - 构建项目"
	@echo "  make clean       - 清理构建产物"
	@echo ""
	@echo "PM2 管理命令:"
	@echo "  make pm2-setup   - 初始化 PM2 环境（首次使用）"
	@echo "  make pm2-start   - 启动生产环境服务"
	@echo "  make pm2-dev     - 启动开发环境服务"
	@echo "  make pm2-stop    - 停止所有服务"
	@echo "  make pm2-restart - 重启所有服务"
	@echo "  make pm2-delete  - 删除所有服务"
	@echo "  make pm2-status  - 查看服务状态"
	@echo "  make pm2-logs    - 查看实时日志"
	@echo "  make pm2-monit   - 打开监控界面"

# 基础命令
install:
	@echo "安装依赖..."
	pnpm install

build:
	@echo "构建项目..."
	pnpm build

clean:
	@echo "清理构建产物..."
	pnpm -r clean
	rm -rf logs

# PM2 管理命令
pm2-setup:
	@echo "初始化 PM2 环境..."
	./scripts/pm2-setup.sh

pm2-start:
	@echo "启动生产环境服务..."
	mkdir -p logs
	pm2 start ecosystem.config.js --env production

pm2-dev:
	@echo "启动开发环境服务..."
	mkdir -p logs
	pm2 start ecosystem.dev.config.js

pm2-stop:
	@echo "停止所有服务..."
	pm2 stop all

pm2-restart:
	@echo "重启所有服务..."
	pm2 restart all

pm2-delete:
	@echo "删除所有服务..."
	pm2 delete all

pm2-status:
	@echo "查看服务状态..."
	pm2 status

pm2-logs:
	@echo "查看实时日志..."
	pm2 logs

pm2-monit:
	@echo "打开监控界面..."
	pm2 monit