# AI Orchestra 管理指南

## 系统架构

AI Orchestra 采用分层架构设计：
- **主页面** (`/`): 用于日常操作，包含 Chat 和 Worker Control
- **管理后台** (`/admin`): 独立的管理界面，用于系统配置和管理

## 快速启动

### 方式1：使用启动脚本
```bash
./start-system.sh
```

### 方式2：分别启动
```bash
# 启动服务器
cd packages/server
pnpm dev

# 启动 Web 界面（新终端）
cd packages/web
pnpm dev
```

## 访问地址

- **主页面**: http://localhost:5173
- **管理后台**: http://localhost:5173/admin

## 数据库

- **类型**: SQLite
- **位置**: `packages/server/data/ai-orchestra.db`
- **自动初始化**: 服务器首次启动时自动创建

## 管理后台功能

### 1. 概览 (Overview)
- 系统状态监控
- Agent 和 Worker 统计
- 任务队列状态
- 最近活动记录

### 2. Agent 管理
- **创建 Agent**: 配置名称、描述和最大 Worker 数
- **生成密钥**: 每个 Agent 自动生成唯一密钥
- **管理操作**:
  - 编辑 Agent 配置
  - 重置密钥
  - 删除 Agent（仅限未连接状态）
- **状态显示**:
  - `pending`: 等待连接
  - `connected`: 已连接
  - `offline`: 离线

### 3. Worker 管理（开发中）
- Worker 配置和监控
- 任务分配策略
- 资源使用统计

### 4. 数据库管理
- 查看数据库信息
- 备份和恢复功能（规划中）
- 数据清理工具（规划中）

### 5. 安全设置
- 访问控制配置
- IP 白名单管理（规划中）
- 安全日志查看

## Agent 部署步骤

1. **在管理后台创建 Agent**
   - 访问 http://localhost:5173/admin
   - 点击 "Agent 管理"
   - 点击 "创建 Agent"
   - 填写信息并保存

2. **复制密钥**
   - 在 Agent 列表中找到创建的 Agent
   - 点击眼睛图标显示密钥
   - 点击复制按钮

3. **在目标机器上连接**
   ```bash
   # 安装 Agent（如果未安装）
   npm install -g @ai-orchestra/agent
   
   # 使用密钥连接
   ai-orchestra-agent start --key AIO-XXXX-XXXX-XXXX-XXXX --server http://localhost:3000
   ```

## API 端点

### Agent 管理 API
- `GET /api/agents` - 获取所有 Agent
- `POST /api/agents` - 创建新 Agent
- `GET /api/agents/:id` - 获取单个 Agent
- `PUT /api/agents/:id` - 更新 Agent
- `DELETE /api/agents/:id` - 删除 Agent
- `POST /api/agents/:id/reset-key` - 重置密钥
- `POST /api/agents/:id/disconnect` - 断开连接

## 注意事项

1. **密钥安全**: 
   - 密钥是 Agent 连接的唯一凭证
   - 请妥善保管，避免泄露
   - 如需更换，使用重置密钥功能

2. **连接限制**:
   - 同一密钥同时只能有一个连接
   - 已连接的 Agent 不能删除或编辑

3. **数据持久化**:
   - 所有配置存储在 SQLite 数据库中
   - 数据库文件位于 `packages/server/data/`
   - 建议定期备份

## 故障排除

### 数据库初始化失败
如果看到 TypeORM 相关错误，确保：
1. 已安装所有依赖 (`pnpm install`)
2. 数据目录存在 (`packages/server/data/`)
3. 有写入权限

### 无法访问管理后台
检查：
1. 服务器是否运行在 3000 端口
2. Web 界面是否运行在 5173 端口
3. 浏览器控制台是否有错误

### Agent 无法连接
验证：
1. 密钥是否正确
2. 服务器地址是否可访问
3. Agent 状态是否为 pending

## 开发计划

- [ ] Worker 完整管理功能
- [ ] 任务调度系统
- [ ] 数据库备份/恢复
- [ ] 用户认证系统
- [ ] 审计日志
- [ ] 监控仪表板
- [ ] WebSocket 实时状态