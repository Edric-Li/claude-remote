# PM2 使用指南

AI Orchestra 项目已配置为使用 PM2 进程管理器，替代了 concurrently。这样可以避免 Claude 频繁启动进程，提供更好的进程管理体验。

## 🚀 快速开始

### 开发模式

```bash
# 启动开发环境（替代原来的 pnpm dev）
pnpm dev

# 或者使用专门的管理脚本
pnpm run pm2:dev-mgr start
```

### 生产模式

```bash
# 首次设置（安装 PM2、构建项目、启动服务）
pnpm run pm2:setup

# 启动生产环境
pnpm run pm2:start
```

## 📋 常用命令

### 开发环境管理

```bash
# 启动开发环境
pnpm dev
pnpm run pm2:dev-mgr start

# 停止开发环境
pnpm run pm2:dev:stop
pnpm run pm2:dev-mgr stop

# 重启开发环境
pnpm run pm2:dev:restart
pnpm run pm2:dev-mgr restart

# 查看运行状态
pnpm run pm2:dev:status
pnpm run pm2:dev-mgr status

# 查看日志
pnpm run pm2:dev:logs
pnpm run pm2:dev-mgr logs

# 实时跟踪日志
pnpm run pm2:dev-mgr logs-tail

# 健康检查
pnpm run pm2:dev:health
pnpm run pm2:dev-mgr health

# 监控界面
pnpm run pm2:monit
pnpm run pm2:dev-mgr monitor
```

### 生产环境管理

```bash
# 启动生产环境
pnpm run pm2:start

# 停止所有进程
pnpm run pm2:stop

# 重启所有进程
pnpm run pm2:restart

# 重载所有进程（零停机时间）
pnpm run pm2:reload

# 查看状态
pnpm run pm2:status

# 查看日志
pnpm run pm2:logs

# 监控界面
pnpm run pm2:monit
```

### 维护命令

```bash
# 清理日志
pnpm run pm2:clean
pnpm run pm2:flush

# 强制杀死所有进程
pnpm run pm2:kill

# 保存当前进程列表
pnpm run pm2:save
```

## 🌐 服务地址

- **Web前端**: http://localhost:3001
- **API服务**: http://localhost:3000

## 📂 配置文件

- `ecosystem.config.js` - 生产环境配置
- `ecosystem.dev.config.js` - 开发环境配置
- `scripts/pm2-setup.sh` - 生产环境设置脚本
- `scripts/pm2-dev.sh` - 开发环境管理脚本

## 📝 日志位置

日志文件存储在 `logs/` 目录下：

```
logs/
├── server-dev-error.log      # 开发服务器错误日志
├── server-dev-out.log        # 开发服务器输出日志
├── server-dev-combined.log   # 开发服务器合并日志
├── web-dev-error.log         # 开发前端错误日志
├── web-dev-out.log           # 开发前端输出日志
├── web-dev-combined.log      # 开发前端合并日志
└── agent-dev-*.log           # Agent相关日志
```

## 🔧 高级用法

### 直接使用 PM2 命令

```bash
# 查看所有进程
pm2 list

# 查看特定进程详情
pm2 show ai-orchestra-server-dev

# 重启特定进程
pm2 restart ai-orchestra-server-dev

# 停止特定进程
pm2 stop ai-orchestra-web-dev

# 删除进程
pm2 delete ai-orchestra-server-dev

# 实时日志
pm2 logs ai-orchestra-server-dev --lines 100

# CPU 和内存监控
pm2 monit
```

### 环境变量配置

修改 `ecosystem.dev.config.js` 或 `ecosystem.config.js` 中的 `env` 部分来配置环境变量。

## 🆚 对比优势

### 使用 PM2 vs Concurrently

| 特性 | PM2 | Concurrently |
|------|-----|--------------|
| 进程管理 | ✅ 完整的进程生命周期管理 | ❌ 基础的同时运行 |
| 日志管理 | ✅ 结构化日志，可查看历史 | ❌ 只有实时输出 |
| 监控 | ✅ 内置监控界面 | ❌ 无监控功能 |
| 自动重启 | ✅ 崩溃自动重启 | ❌ 进程崩溃需手动重启 |
| 资源监控 | ✅ CPU、内存监控 | ❌ 无资源监控 |
| 热重载 | ✅ 支持 | ✅ 支持 |
| 独立控制 | ✅ 可独立启停各服务 | ❌ 只能整体控制 |

## 🚫 避免 Claude 频繁启动

现在使用 PM2 后，Claude 不会频繁启动新进程，因为：

1. **进程持久化**: PM2 进程在后台持续运行
2. **状态检查**: 启动前检查是否已有进程在运行
3. **优雅重启**: 使用 `pm2 restart` 而非重新启动
4. **进程隔离**: 每个服务独立管理，互不影响

## 💡 最佳实践

1. **开发时使用** `pnpm dev` 启动
2. **生产部署使用** `pnpm run pm2:setup`
3. **定期检查状态** `pnpm run pm2:status`
4. **监控资源使用** `pnpm run pm2:monit`
5. **定期清理日志** `pnpm run pm2:clean`

## 🔍 故障排除

### 进程启动失败
```bash
# 检查详细错误信息
pm2 logs ai-orchestra-server-dev --err

# 检查配置文件
node -c ecosystem.dev.config.js
```

### 端口占用
```bash
# 查看端口使用情况
lsof -i :3000
lsof -i :3001

# 强制停止所有进程
pnpm run pm2:kill
```

### 清理环境
```bash
# 完全重置 PM2 环境
pm2 kill
pm2 cleardump
pnpm run pm2:clean
```