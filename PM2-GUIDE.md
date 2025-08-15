# AI Orchestra PM2 部署指南

本指南介绍如何使用 PM2 管理 AI Orchestra 项目的各个服务。

## 快速开始

### 1. 安装 PM2

```bash
# 全局安装 PM2
npm install -g pm2

# 或使用 pnpm
pnpm add -g pm2
```

### 2. 初始化环境

```bash
# 使用自动化脚本（推荐）
make pm2-setup

# 或手动执行
pnpm install
pnpm build
mkdir -p logs
```

### 3. 启动服务

```bash
# 生产环境
make pm2-start
# 或
pnpm run pm2:start

# 开发环境
make pm2-dev
# 或
pm2 start ecosystem.dev.config.js
```

## PM2 配置文件

项目包含两个 PM2 配置文件：

### 生产环境：`ecosystem.config.js`

- **ai-orchestra-server**: 后端 API 服务 (端口 3000)
- **ai-orchestra-web**: 前端 Web 服务 (端口 3001)  
- **ai-orchestra-agent**: AI 代理工作进程

### 开发环境：`ecosystem.dev.config.js`

- 使用 `pnpm run dev:*` 命令启动
- 启用文件监控和自动重启
- 开发友好的日志配置

## 可用命令

### 使用 Make（推荐）

```bash
make help              # 显示所有可用命令
make pm2-setup         # 初始化 PM2 环境
make pm2-start         # 启动生产环境
make pm2-dev           # 启动开发环境
make pm2-stop          # 停止所有服务
make pm2-restart       # 重启所有服务
make pm2-delete        # 删除所有服务
make pm2-status        # 查看状态
make pm2-logs          # 查看日志
make pm2-monit         # 监控界面
```

### 使用 npm/pnpm 脚本

```bash
pnpm run pm2:setup     # 初始化环境
pnpm run pm2:start     # 启动生产环境
pnpm run pm2:dev       # 启动开发环境
pnpm run pm2:stop      # 停止服务
pnpm run pm2:restart   # 重启服务
pnpm run pm2:delete    # 删除服务
pnpm run pm2:status    # 查看状态
pnpm run pm2:logs      # 查看日志
pnpm run pm2:monit     # 监控界面
```

### 直接使用 PM2 命令

```bash
# 启动
pm2 start ecosystem.config.js --env production
pm2 start ecosystem.dev.config.js

# 管理
pm2 status
pm2 logs
pm2 monit
pm2 restart all
pm2 stop all
pm2 delete all

# 单个服务管理
pm2 restart ai-orchestra-server
pm2 logs ai-orchestra-web
pm2 stop ai-orchestra-agent
```

## 日志管理

### 日志文件位置

```
logs/
├── server-error.log       # 服务端错误日志
├── server-out.log         # 服务端输出日志
├── server-combined.log    # 服务端合并日志
├── web-error.log          # Web 错误日志
├── web-out.log            # Web 输出日志
├── web-combined.log       # Web 合并日志
├── agent-error.log        # Agent 错误日志
├── agent-out.log          # Agent 输出日志
└── agent-combined.log     # Agent 合并日志
```

### 日志查看命令

```bash
# 实时日志
pm2 logs

# 指定行数
pm2 logs --lines 50

# 特定服务
pm2 logs ai-orchestra-server

# 清空日志
pm2 flush
```

## 开机自启动

```bash
# 保存当前进程列表
pm2 save

# 生成启动脚本
pm2 startup

# 按提示执行生成的命令（通常需要 sudo）
```

## 监控和管理

### Web 监控界面

```bash
# 安装 PM2 Plus（可选）
pm2 install pm2-server-monit

# 本地监控界面
pm2 monit
```

### 内存和 CPU 限制

配置文件中已设置：
- Server: 1GB 内存限制
- Web/Agent: 512MB 内存限制
- 超出限制自动重启

## 故障排除

### 常见问题

1. **端口占用**
   ```bash
   lsof -i :3000  # 检查端口占用
   ```

2. **权限问题**
   ```bash
   sudo chown -R $USER:$GROUP ~/.pm2
   ```

3. **日志权限**
   ```bash
   mkdir -p logs
   chmod 755 logs
   ```

4. **构建失败**
   ```bash
   pnpm clean
   pnpm install
   pnpm build
   ```

### 重置 PM2

```bash
pm2 kill           # 杀死 PM2 守护进程
pm2 resurrect      # 恢复保存的进程
```

## 部署流程

### 生产部署

1. 构建项目
   ```bash
   pnpm build
   ```

2. 启动服务
   ```bash
   make pm2-start
   ```

3. 验证状态
   ```bash
   make pm2-status
   ```

### 更新部署

1. 停止服务
   ```bash
   make pm2-stop
   ```

2. 更新代码
   ```bash
   git pull
   pnpm install
   pnpm build
   ```

3. 重启服务
   ```bash
   make pm2-start
   ```

## 环境变量

可在 `ecosystem.config.js` 中配置环境变量：

```javascript
env: {
  NODE_ENV: 'production',
  PORT: 3000,
  DATABASE_URL: 'postgresql://...',
  // 其他环境变量
}
```

## 集群模式

如需要集群模式，修改配置文件：

```javascript
{
  name: 'ai-orchestra-server',
  script: './packages/server/dist/main.js',
  instances: 'max',  // 或指定数量如 4
  exec_mode: 'cluster'
}
```

## 总结

通过 PM2 配置，AI Orchestra 项目现在支持：

- ✅ 生产环境和开发环境分离
- ✅ 自动重启和错误恢复
- ✅ 日志管理和监控
- ✅ 内存限制和性能优化
- ✅ 开机自启动
- ✅ 便捷的命令行管理

使用 `make help` 查看所有可用命令，开始管理你的 AI Orchestra 服务！