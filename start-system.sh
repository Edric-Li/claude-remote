#!/bin/bash

echo "🎼 启动 AI Orchestra 系统..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 启动服务器
echo -e "${YELLOW}▶ 启动服务器...${NC}"
cd packages/server
pnpm dev &
SERVER_PID=$!
echo -e "${GREEN}✓ 服务器已启动 (PID: $SERVER_PID)${NC}"
echo ""

# 等待服务器启动
echo "等待服务器初始化..."
sleep 3

# 检查数据库是否创建
if [ -f "data/ai-orchestra.db" ]; then
    echo -e "${GREEN}✓ 数据库已初始化: packages/server/data/ai-orchestra.db${NC}"
else
    echo -e "${YELLOW}⚠ 数据库文件未找到${NC}"
fi
echo ""

# 启动 Web 界面
echo -e "${YELLOW}▶ 启动 Web 界面...${NC}"
cd ../web
pnpm dev &
WEB_PID=$!
echo -e "${GREEN}✓ Web 界面已启动 (PID: $WEB_PID)${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 AI Orchestra 系统启动成功！${NC}"
echo ""
echo -e "${BLUE}访问地址：${NC}"
echo -e "  主页面: ${GREEN}http://localhost:5173${NC}"
echo -e "  管理后台: ${GREEN}http://localhost:5173/admin${NC}"
echo ""
echo -e "${BLUE}API 端点：${NC}"
echo -e "  服务器: ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}提示：${NC}"
echo "  - 首次访问管理后台创建 Agent"
echo "  - 使用生成的密钥连接 Agent"
echo "  - 按 Ctrl+C 停止所有服务"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 处理退出信号
cleanup() {
    echo ""
    echo -e "${YELLOW}正在停止服务...${NC}"
    kill $SERVER_PID 2>/dev/null
    kill $WEB_PID 2>/dev/null
    echo -e "${GREEN}✓ 所有服务已停止${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 保持脚本运行
wait