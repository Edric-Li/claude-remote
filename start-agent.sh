#!/bin/bash

# AI Orchestra Agent 启动脚本
# 使用方法: ./start-agent.sh

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 默认配置
SERVER_URL="http://localhost:3000"
AGENT_NAME="Agent-$$"
AUTH_TOKEN="AIO-A703-5E3A-FD99-00E2"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    AI Orchestra Agent Worker${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case $1 in
    -s|--server)
      SERVER_URL="$2"
      shift 2
      ;;
    -n|--name)
      AGENT_NAME="$2"
      shift 2
      ;;
    -k|--key)
      AUTH_TOKEN="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  -s, --server <url>   Server URL (default: http://localhost:3000)"
      echo "  -n, --name <name>    Agent name (default: Agent-<pid>)"
      echo "  -k, --key <key>      Authentication key"
      echo "  -h, --help           Show this help message"
      echo ""
      echo "Example:"
      echo "  $0 --key AIO-A703-5E3A-FD99-00E2"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use -h or --help for usage information"
      exit 1
      ;;
  esac
done

# 显示配置信息
echo -e "${GREEN}Configuration:${NC}"
echo -e "  ${YELLOW}Server URL:${NC} $SERVER_URL"
echo -e "  ${YELLOW}Agent Name:${NC} $AGENT_NAME"
echo -e "  ${YELLOW}Auth Token:${NC} ${AUTH_TOKEN:0:8}...${AUTH_TOKEN: -4}"
echo ""

# 切换到 agent 目录
cd packages/agent

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
fi

# 设置环境变量并启动
echo -e "${GREEN}Starting agent...${NC}"
echo ""

export SERVER_URL="$SERVER_URL"
export AGENT_NAME="$AGENT_NAME"
export AUTH_TOKEN="$AUTH_TOKEN"
export CAPABILITIES="claude-code,cursor,qucoder"

# 使用 tsx 直接运行 TypeScript
npx tsx src/agent-worker.ts