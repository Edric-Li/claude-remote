# AI Orchestra - 分布式 AI CLI 工具调度系统

🎼 **Orchestrate Your AI Workers** - 一个分布式调度系统，用于管理和协调多个 AI CLI 工具（如 Claude Code、Cursor、Qucoder 等）的执行。

## 🌟 核心特性

- **分布式架构**：支持多个 Agent 同时工作，实现任务的分布式处理
- **多工具支持**：集成 Claude Code、Cursor、Qucoder 等主流 AI 编码工具
- **仓库管理**：支持 Git 仓库的自动克隆、缓存和工作区隔离
- **认证安全**：基于 JWT 的身份认证和 Agent 密钥验证
- **实时通信**：使用 WebSocket 实现实时任务分配和状态同步
- **Web 管理界面**：现代化的管理后台，支持 Agent、仓库、任务管理

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 一键启动所有服务

```bash
./start-system.sh
```

这会同时启动：

- 📡 Server (端口 3000)
- 🌐 Web UI (端口 5173)
- 📊 管理后台 (http://localhost:5173/admin)

### 3. 连接 Agent

在管理后台创建 Agent 后，使用生成的密钥连接：

```bash
./start-agent.sh --key YOUR-SECRET-KEY --name YOUR-AGENT-NAME
```

## 📦 项目结构

```
ai-orchestra/
├── packages/
│   ├── server/         # 后端服务（NestJS）
│   ├── web/           # Web 界面（React + TypeScript）
│   ├── agent/         # Agent Worker（Node.js）
│   └── client/        # 客户端 SDK
├── start-system.sh    # 一键启动脚本
├── start-agent.sh     # Agent 启动脚本
└── CLAUDE.md         # 开发规范
```

## 🔧 功能特性

### Agent 管理

- 创建和管理多个 Agent
- 生成唯一的安全密钥
- 实时监控 Agent 状态
- 配置 Worker 数量和能力

### 仓库管理

- 添加 Git 仓库配置
- 支持多种认证方式（GitHub、GitLab、Bitbucket）
- 自动克隆和缓存
- 工作区隔离机制

### 任务调度

- 智能任务分配
- 任务队列管理
- 失败重试机制
- 执行结果追踪

## 🛠 技术栈

- **后端**：NestJS + TypeORM + Socket.io + SQLite/PostgreSQL
- **前端**：React + TypeScript + Vite + shadcn/ui + Zustand
- **Agent**：Node.js + Socket.io-client + Simple-git
- **认证**：JWT + bcrypt + Agent 密钥验证

## 📖 文档

- [安装指南](./INSTALL_GUIDE.md)
- [管理员指南](./ADMIN_GUIDE.md)
- [Agent 快速入门](./AGENT_QUICKSTART.md)
- [连接 Agent](./CONNECT_AGENT.md)
- [项目总结](./PROJECT_SUMMARY.md)
- [开发规范](./CLAUDE.md)

## 📄 许可证

MIT License
