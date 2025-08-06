# Debug Guide - Agent 回复问题

## 使用 Debug Agent 测试

### 1. 确保服务正在运行

**Terminal 1:**
```bash
cd /Users/edric/Code/OpenSource/claude-remote
pnpm run dev:server
```

**Terminal 2:**
```bash
cd /Users/edric/Code/OpenSource/claude-remote
pnpm run dev:web
```

### 2. 运行 Debug Agent

**Terminal 3:**
```bash
cd /Users/edric/Code/OpenSource/claude-remote/packages/client
npx tsx src/debug-agent.ts
```

### 3. 测试步骤

1. **检查连接状态**
   - 在 Debug Agent 中输入 `status` 并回车
   - 应该看到连接状态信息

2. **测试 Socket 连接**
   - 输入 `ping` 并回车
   - 应该看到 "Socket is connected ✓"

3. **发送测试消息**
   - 从 Web 界面发送消息
   - Debug Agent 应该显示详细的接收信息

4. **发送回复**
   - 在看到 "Type your reply:" 后输入任意文本
   - 按回车发送
   - 观察详细的发送日志

## 检查点

### Server 端日志应该显示：
```
[socketId] Event: chat:reply [{agentId: 'xxx', content: 'xxx'}]
Received reply from agent xxx: xxx
Broadcasted reply to all web clients
```

### Debug Agent 应该显示：
```
📤 Sending reply...
Payload: {agentId: 'xxx', content: 'xxx'}
✅ Reply sent successfully!
```

### Web 浏览器控制台 (F12)：
```
Received chat:reply: {from: 'agent', agentId: 'xxx', content: 'xxx', timestamp: 'xxx'}
```

## 常见问题

### 1. 如果没有看到 "Reply sent"
- 检查 Socket 是否连接（使用 `status` 命令）
- 检查是否有错误信息
- 尝试重启所有服务

### 2. 如果 Server 没有收到事件
- 检查 Agent 是否成功注册
- 查看 Server 的事件日志
- 确认使用正确的事件名称

### 3. 如果 Web 没有显示回复
- 检查浏览器控制台
- 确认时间戳格式正确
- 尝试刷新页面

## 快速测试命令

在 Debug Agent 中：
1. `status` - 查看连接状态
2. `ping` - 测试 Socket 连接
3. `hello world` - 发送测试回复