# 测试步骤 - Agent 回复功能

## 1. 启动服务

### Terminal 1 - 启动 Server:
```bash
cd /Users/edric/Code/OpenSource/claude-remote
pnpm run dev:server
```

### Terminal 2 - 启动 Web:
```bash
cd /Users/edric/Code/OpenSource/claude-remote
pnpm run dev:web
```

## 2. 测试简化版 Agent

### Terminal 3 - 运行测试 Agent:
```bash
cd /Users/edric/Code/OpenSource/claude-remote/packages/client
npx tsx src/test-agent.ts
```

### 测试流程:
1. 打开浏览器访问 http://localhost:5173
2. 检查是否看到 "Simple Test Agent" 在线
3. 在 Web 界面发送消息
4. 在 Agent 终端查看是否收到消息
5. 在 Agent 终端输入 `test` 并按回车
6. 检查 Web 界面是否显示 "Test reply from agent!"

## 3. 测试正式版 Agent

如果简化版工作正常，测试正式版:

### Terminal 3 - 运行正式 Agent:
```bash
cd /Users/edric/Code/OpenSource/claude-remote/packages/client
pnpm run dev -- start --name "Official-Agent"
```

## 4. 调试检查点

### Server 控制台应该显示:
- `Client connected: xxx`
- `Agent registered: xxx`
- `Received reply from agent xxx: xxx`
- `Broadcasted reply to all web clients`

### Web 浏览器控制台 (F12) 应该显示:
- `Received chat:reply: {from: 'agent', ...}`

### Agent 终端应该显示:
- `✅ Connected to server`
- `📨 Received: [消息内容]`
- `✅ Reply sent`

## 5. 可能的问题

1. **如果 Agent 无法连接**
   - 检查 Server 是否正在运行
   - 检查端口 3000 是否被占用

2. **如果收不到消息**
   - 检查 Agent 是否成功注册
   - 刷新 Web 页面重试

3. **如果回复无法发送**
   - 使用简化版 Agent 测试
   - 检查 Socket 连接状态

4. **如果 Web 不显示回复**
   - 打开浏览器控制台查看日志
   - 检查时间戳格式是否正确