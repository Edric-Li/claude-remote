# AI Orchestra 安装与使用指南

## 快速开始

### 1. 安装依赖
```bash
pnpm install
```

### 2. 启动服务

#### 启动服务器（必需）
```bash
pnpm run dev:server
```
服务器默认运行在: **http://localhost:3000**

#### 启动 Web 界面（可选）
```bash
pnpm run dev:web
```
Web 界面运行在: **http://localhost:5173**

## Agent 客户端安装

### 方法一：全局安装（推荐）

1. 构建客户端
```bash
cd packages/client
npm run build
```

2. 创建全局链接
```bash
cd packages/client
npm run link
# 或
npm link
```

3. 验证安装
```bash
# 应该能看到以下命令
which ai-orchestra-agent
which ai-orchestra-worker
```

4. 全局使用
```bash
# 在任何目录下都可以运行
ai-orchestra-agent start --name "MyAgent"
ai-orchestra-worker
```

### 方法二：本地运行

在 `packages/client` 目录下运行：

```bash
# 简单测试（无需认证）
npm run test:simple

# 带认证的 Agent
npm run test:auth -- --name mac --key AIO-A703-5E3A-FD99-00E2

# 自动回复测试
npm run test:auto
```

## 连接已创建的 Agent

如果你已经在管理后台创建了 Agent（例如名为 "mac"，密钥为 "AIO-A703-5E3A-FD99-00E2"），使用以下方式连接：

### 使用认证脚本
```bash
cd packages/client

# 使用 npm script
npm run test:auth -- --name mac --key AIO-A703-5E3A-FD99-00E2

# 或直接使用 tsx
npx tsx src/agent-auth.ts \
  --name mac \
  --key AIO-A703-5E3A-FD99-00E2 \
  --server http://localhost:3000
```

## 服务器配置

### 环境变量
创建 `.env` 文件：
```bash
cp .env.example .env
```

默认配置：
```env
# 服务器端口
PORT=3000

# 数据库
DATABASE_TYPE=sqlite
DATABASE_URL=./data/ai-orchestra.db

# 前端 API 地址
VITE_API_BASE_URL=http://localhost:3000
```

### 修改服务器端口
如果需要修改默认端口：

1. 修改 `.env` 文件
```env
PORT=3210  # 改为你想要的端口
VITE_API_BASE_URL=http://localhost:3210
```

2. 重启服务器
```bash
pnpm run dev:server
```

3. 连接时指定新端口
```bash
npx tsx src/agent-auth.ts \
  --name mac \
  --key YOUR-KEY \
  --server http://localhost:3210
```

## Web 界面功能

启动 Web 界面后，你可以：

1. **查看服务器 URL**
   - 页面顶部显示当前服务器地址
   - 点击复制按钮可快速复制

2. **管理 Agent**
   - 左侧边栏显示所有连接的 Agent
   - 点击 Agent 可进行单独对话
   - 不选择时广播到所有 Agent

3. **管理后台**
   - 点击右上角"管理后台"按钮
   - 创建新的 Agent
   - 查看 Agent 密钥
   - 管理 Worker 配置

## 常见问题

### Q: 连接错误 "xhr poll error"
**A**: 检查以下几点：
1. 服务器是否正在运行
2. 端口是否正确（默认 3000）
3. 防火墙是否阻止连接

### Q: 如何查看当前服务器地址？
**A**: 
1. 查看服务器启动日志
2. 在 Web 界面顶部查看
3. 检查 `.env` 文件中的 PORT 配置

### Q: 如何卸载全局链接？
**A**: 
```bash
cd packages/client
npm run unlink
# 或
npm unlink
```

### Q: Agent 认证失败
**A**: 
1. 确认 Agent 名称和密钥正确
2. 在管理后台检查 Agent 是否存在
3. 查看服务器日志了解详细错误

## 开发调试

### 查看调试信息
```bash
# Agent 端调试
DEBUG=1 npx tsx src/agent-auth.ts --name test --key xxx

# 查看 Socket.io 调试信息
DEBUG=socket.io* npm run dev:server
```

### 性能测试
启动多个 Agent 进行压力测试：
```bash
# 启动 5 个自动回复 Agent
for i in {1..5}; do
  npm run test:agent:auto &
  sleep 1
done
```

## 架构说明

```
AI Orchestra
├── Server (NestJS)          # 端口 3000
│   ├── WebSocket Gateway    # 实时通信
│   ├── REST API            # HTTP 接口
│   └── SQLite Database     # 数据存储
│
├── Web Interface (React)    # 端口 5173
│   ├── Agent 管理
│   ├── 聊天界面
│   └── Worker 控制
│
└── Agent Client (Node.js)   # 连接到 3000
    ├── 认证连接
    ├── 消息收发
    └── Worker 执行
```

## 下一步

1. 在管理后台创建更多 Agent
2. 部署到生产环境
3. 配置 HTTPS 和域名
4. 设置负载均衡