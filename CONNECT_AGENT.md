# 连接 Agent 到 AI Orchestra

## 你的 Agent 信息

- **Agent 名称**: `mac`
- **密钥**: `AIO-A703-5E3A-FD99-00E2`
- **服务器地址**: `http://localhost:3000`

## 快速连接

### 方法 1：使用启动脚本（最简单）

```bash
# 在项目根目录运行
./start-agent.sh --key AIO-A703-5E3A-FD99-00E2 --name mac
```

### 方法 2：使用环境变量

```bash
cd packages/agent
AUTH_TOKEN=AIO-A703-5E3A-FD99-00E2 AGENT_NAME=mac npm run start:dev
```

### 方法 3：使用 npx

```bash
cd packages/agent
npx . --key AIO-A703-5E3A-FD99-00E2 --name mac
```

## 成功连接的标志

当 Agent 成功连接后，你会看到：

```
✅ Authentication successful
Agent ID: 7db5fab9-2f91-4d74-9072-47ac34911fc6
✅ Worker registered successfully
🤖 Worker ready to receive tasks
```

## 在管理后台查看

1. 打开管理后台：http://localhost:5173/admin
2. 进入 "Agent 管理" 页面
3. 你应该能看到名为 "mac" 的 Agent 状态为 "connected"（绿色）

## 重要说明

⚠️ **Agent 名称必须与创建时的名称完全一致**
- 你创建的 Agent 名称是 `mac`
- 连接时必须使用 `--name mac`
- 如果使用其他名称会提示 "Agent name mismatch"

## 如果需要创建新的 Agent

1. 在管理后台的 "Agent 管理" 页面
2. 点击 "创建 Agent"
3. 填写名称（例如：`my-new-agent`）
4. 保存后会生成新的密钥
5. 使用新的名称和密钥连接

## Agent 命令

连接成功后，可以在 Agent 终端输入：

- `status` - 查看 Agent 状态
- `workspace` - 查看当前工作区
- `clean` - 清理旧工作区
- `help` - 显示帮助

## 断开连接

按 `Ctrl+C` 即可优雅地断开 Agent 连接。