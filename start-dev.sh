#!/bin/bash

# 启动 AI Orchestra 开发环境

echo "🚀 启动 AI Orchestra 开发环境..."

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ 请先安装 pnpm: npm install -g pnpm"
    exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
pnpm install

# 启动服务
echo "🎯 启动服务..."
echo ""
echo "📌 服务地址："
echo "   - Web UI: http://localhost:5173"
echo "   - API Server: http://localhost:3000"
echo "   - WebSocket: ws://localhost:3000"
echo ""
echo "📝 使用说明："
echo "   1. 在 Web UI 创建管理员账号"
echo "   2. 在仓库管理中添加 Git 仓库"
echo "   3. 在新终端运行 Agent Worker："
echo "      cd packages/agent && pnpm dev"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 启动服务端和前端
pnpm dev