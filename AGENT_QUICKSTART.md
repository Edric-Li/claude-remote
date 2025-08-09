# AI Orchestra Agent 快速启动指南

## 使用你的密钥连接 Agent

你的 Agent 密钥是：`AIO-A703-5E3A-FD99-00E2`

## 方法 1：使用启动脚本（推荐）

在项目根目录运行：

```bash
# 使用默认配置
./start-agent.sh --key AIO-A703-5E3A-FD99-00E2

# 或者自定义 Agent 名称
./start-agent.sh --key AIO-A703-5E3A-FD99-00E2 --name "My-Agent"

# 连接到远程服务器
./start-agent.sh --key AIO-A703-5E3A-FD99-00E2 --server http://your-server:3000
```

## 方法 2：使用 NPX 直接运行

在项目根目录运行：

```bash
cd packages/agent

# 安装依赖（首次运行）
npm install

# 设置环境变量并启动
SERVER_URL=http://localhost:3000 \
AGENT_NAME=My-Agent \
AUTH_TOKEN=AIO-A703-5E3A-FD99-00E2 \
npx tsx src/agent-worker.ts
```

## 方法 3：使用 npm 脚本

在 packages/agent 目录下：

```bash
cd packages/agent

# 使用环境变量启动
AUTH_TOKEN=AIO-A703-5E3A-FD99-00E2 npm run start:dev
```

## 方法 4：创建 .env 文件（持久配置）

在 packages/agent 目录创建 `.env` 文件：

```env
SERVER_URL=http://localhost:3000
AGENT_NAME=My-Agent
AUTH_TOKEN=AIO-A703-5E3A-FD99-00E2
CAPABILITIES=claude-code,cursor,qucoder
```

然后运行：

```bash
npm run start:dev
```

## Agent 命令

Agent 启动后，你可以使用以下命令：

- `status` - 显示 Agent 状态
- `workspace` - 显示当前工作区信息
- `clean` - 清理旧的工作区
- `help` - 显示帮助信息

## 验证连接

Agent 成功连接后，你会看到：

```
✅ Connected to server
Agent ID: xxxxx-xxxx-xxxx-xxxx
Agent Name: My-Agent

🤖 Worker ready to receive tasks
```

## 故障排除

### 连接失败

1. 确保服务器正在运行：
```bash
cd packages/server
npm run start:dev
```

2. 检查服务器地址是否正确（默认 http://localhost:3000）

3. 确认密钥是否正确

### 认证失败

如果看到 "Authentication failed" 错误，请：

1. 检查密钥是否正确
2. 在管理后台确认 Agent 是否已创建
3. 确认 Agent 状态是否为启用

### 端口冲突

如果 3000 端口被占用，可以修改服务器端口：

```bash
# 服务器端
PORT=3001 npm run start:dev

# Agent 端
SERVER_URL=http://localhost:3001 ./start-agent.sh --key YOUR-KEY
```

## 测试 Agent

1. 打开管理后台：http://localhost:5173/admin
2. 进入 "Agent 管理" 页面
3. 确认你的 Agent 显示为 "connected" 状态
4. 创建一个测试任务来验证 Agent 工作正常

## 安全注意事项

- 请妥善保管你的 Agent 密钥
- 不要在公共代码库中提交包含密钥的配置文件
- 定期更换密钥以确保安全

## 需要帮助？

- 查看完整文档：[README.md](README.md)
- 报告问题：创建 GitHub Issue
- 联系支持：admin@ai-orchestra.com