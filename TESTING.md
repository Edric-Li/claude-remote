# Claude Remote MVP 测试指南

## 手动测试步骤

### 1. 启动所有服务

打开三个终端窗口：

**终端 1 - 启动 Server：**
```bash
pnpm run dev:server
```
应该看到：`🚀 Server is running on http://localhost:3000`

**终端 2 - 启动 Web 界面：**
```bash
pnpm run dev:web
```
应该看到：`➜  Local:   http://localhost:5173/`

**终端 3 - 启动 Agent：**
```bash
cd packages/client
pnpm run dev -- start --name "Agent-1"
```
应该看到：
- `✔ Connected to server`
- `Agent ID: xxx`
- `Agent Name: Agent-1`

### 2. 测试聊天功能

1. 在浏览器打开 http://localhost:5173
2. 检查左侧是否显示 "Agent-1" 并标记为 "Online"
3. 在底部输入框输入消息，点击 Send 或按 Enter
4. 查看 Agent 终端，应该收到消息
5. 在 Agent 终端输入回复并按 Enter
6. 查看 Web 界面是否显示 Agent 的回复

### 3. 测试多 Agent

启动第二个 Agent（新终端）：
```bash
cd packages/client
pnpm run dev -- start --name "Agent-2" --server http://localhost:3000
```

测试：
- 两个 Agent 都应该显示在 Web 界面
- 点击特定 Agent 可以单独发送消息
- 不选择 Agent 时会广播到所有 Agent

## 自动化测试

### 运行 E2E 测试

```bash
# 运行所有测试
pnpm test:e2e

# 使用 UI 模式调试
pnpm test:e2e:ui
```

## 测试检查点

✅ **连通性测试**
- [ ] Server 正常启动
- [ ] Web 界面正常加载
- [ ] Agent 能成功连接
- [ ] WebSocket 连接稳定

✅ **功能测试**
- [ ] Agent 注册和在线状态显示
- [ ] 发送消息到所有 Agent
- [ ] 发送消息到特定 Agent
- [ ] Agent 回复消息
- [ ] 断线重连功能

✅ **UI 测试**
- [ ] Agent 列表正确显示
- [ ] 连接状态指示器
- [ ] 消息时间戳
- [ ] 空状态提示
- [ ] 键盘快捷键（Enter 发送）

## 常见问题

### 1. 前端启动失败
如果看到依赖错误，运行：
```bash
pnpm install
```

### 2. 端口被占用
- Server 默认使用 3000 端口
- Web 默认使用 5173 端口

修改端口：
```bash
# Server
PORT=3001 pnpm run dev:server

# Agent 连接到不同端口
pnpm run dev -- start --server http://localhost:3001
```

### 3. Agent 连接失败
检查：
- Server 是否正在运行
- 防火墙是否阻止连接
- Server URL 是否正确

## 性能测试

测试多个 Agent 同时连接：
```bash
# 启动 5 个 Agent
for i in {1..5}; do
  pnpm run dev -- start --name "Agent-$i" &
done
```

观察：
- 消息延迟
- CPU/内存使用
- WebSocket 连接稳定性