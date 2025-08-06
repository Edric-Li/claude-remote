# 调试 Agent 回复问题

## 测试步骤

1. **启动 Server（查看日志）**
```bash
pnpm run dev:server
```

2. **启动 Web（打开浏览器控制台）**
```bash
pnpm run dev:web
```
- 打开 http://localhost:5173
- 按 F12 打开浏览器控制台

3. **启动 Agent**
```bash
cd packages/client
pnpm run dev -- start --name "Test-Agent"
```

4. **测试流程**
- 在 Web 界面发送消息
- 检查 Agent 终端是否收到消息
- 在 Agent 终端输入回复
- 检查以下日志：

## 应该看到的日志

### Server 日志：
```
Received reply from agent xxx: [回复内容]
Broadcasted reply to all web clients
```

### 浏览器控制台：
```
Received chat:reply: {from: 'agent', agentId: 'xxx', content: '...', timestamp: ...}
```

### Web 界面：
- 应该显示 Agent 的回复消息

## 可能的问题

1. **如果 Server 没有收到回复**
   - 检查 Agent 是否正确连接
   - 检查 Agent 的 socket.emit 是否执行

2. **如果 Server 收到但 Web 没收到**
   - 检查 Web 的 WebSocket 连接状态
   - 检查是否有多个 Web 客户端连接

3. **如果 Web 收到但不显示**
   - 检查消息过滤逻辑
   - 检查 React 组件是否正确渲染

## 快速修复

如果仍有问题，尝试：
1. 刷新 Web 页面
2. 重启所有服务
3. 清除浏览器缓存