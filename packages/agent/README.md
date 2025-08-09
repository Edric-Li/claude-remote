# AI Orchestra Agent Worker

Agent Worker 是 AI Orchestra 系统的核心执行组件，负责接收任务、管理仓库缓存、创建隔离工作区并执行 AI CLI 工具。

## 特性

- 🔄 **智能仓库缓存** - 自动克隆和缓存仓库，避免重复下载
- 🏗️ **工作区隔离** - 每个任务在独立的工作区执行，互不干扰
- 🔐 **安全认证** - 支持多种 Git 认证方式（GitHub PAT、GitLab Token 等）
- 🚀 **多工具支持** - 支持 Claude Code、Cursor CLI、QuCoder 等 AI 工具
- 🧹 **自动清理** - 自动清理过期工作区，节省磁盘空间

## 安装

```bash
cd packages/agent
pnpm install
```

## 使用方法

### 1. 基本启动

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm build
pnpm start
```

### 2. 环境变量配置

```bash
# 服务器地址
export SERVER_URL=http://localhost:3000

# Worker 名称
export AGENT_NAME=Worker-1

# 认证令牌（如果需要）
export AUTH_TOKEN=your-auth-token

# 支持的工具（逗号分隔）
export CAPABILITIES=claude-code,cursor,qucoder

# 加密密钥（用于解密仓库凭据）
export ENCRYPTION_KEY=your-encryption-key
```

### 3. 测试运行

```bash
# 运行测试 Worker
pnpm tsx src/test-worker.ts
```

## 架构设计

### 仓库管理流程

```
1. 接收任务（包含仓库配置）
   ↓
2. 检查本地缓存
   ├─ 存在：更新代码（可选）
   └─ 不存在：克隆仓库
   ↓
3. 创建隔离工作区
   ↓
4. 复制代码到工作区
   ↓
5. 执行 AI CLI 工具
   ↓
6. 返回执行结果
   ↓
7. 清理工作区
```

### 目录结构

```
~/.ai-orchestra/
├── cache/              # 仓库缓存目录
│   ├── repo-abc123/    # 缓存的仓库
│   └── repo-def456/
└── workspaces/         # 工作区目录
    ├── task-123-xxx/   # 任务工作区
    └── task-456-yyy/
```

## 命令行交互

Worker 运行时支持以下命令：

- `status` - 显示 Worker 状态
- `workspace` - 显示当前工作区信息
- `clean` - 清理过期工作区
- `help` - 显示帮助信息

## API

### AgentWorker

主要的 Worker 类，处理任务执行和仓库管理。

```typescript
const worker = new AgentWorker({
  serverUrl: 'http://localhost:3000',
  name: 'Worker-1',
  token: 'auth-token',
  capabilities: ['claude-code', 'cursor']
})

await worker.start()
```

### RepositoryManager

仓库管理服务，处理克隆、缓存和工作区创建。

```typescript
const manager = new RepositoryManager('/path/to/base/dir')

// 确保仓库在缓存中
await manager.ensureRepository(config)

// 创建工作区
const workspace = await manager.createWorkspace(config, taskId)

// 清理工作区
await manager.cleanupWorkspace(workspaceId)
```

## 安全注意事项

1. **凭据加密** - 所有仓库凭据都使用 AES-256-CBC 加密存储
2. **工作区隔离** - 每个任务在独立工作区执行
3. **自动清理** - 完成后自动清理工作区
4. **权限控制** - 仅访问授权的仓库

## 故障排查

### 连接失败

```bash
# 检查服务器是否运行
curl http://localhost:3000/health

# 检查网络连接
ping localhost
```

### 仓库克隆失败

```bash
# 检查 Git 配置
git config --list

# 测试仓库访问
git ls-remote https://github.com/user/repo.git
```

### 工作区权限问题

```bash
# 检查目录权限
ls -la ~/.ai-orchestra/

# 修复权限
chmod -R 755 ~/.ai-orchestra/
```

## 开发

### 运行测试

```bash
pnpm test
```

### 构建

```bash
pnpm build
```

### 清理

```bash
pnpm clean
```

## License

MIT