# Claude-Remote 技术栈

## 项目结构

采用 Monorepo 架构，使用 pnpm workspaces 管理：

```
claude-remote/
├── packages/
│   ├── server/        # Server 端服务
│   ├── client/        # Agent CLI 工具
│   ├── web/          # Web 管理界面
│   ├── shared/       # 共享类型和工具
│   └── protocols/    # 通信协议定义
```

## Server 端技术栈

### 核心框架
- **nestjs** - 企业级 Node.js 框架，模块化架构
- **typescript** - 类型安全

### 通信层
- **socket.io** - WebSocket 实时通信
- **@nestjs/websockets** - NestJS WebSocket 集成

### 数据层
- **postgresql** - 主数据库
- **typeorm** - ORM 框架
- **redis** - 缓存和会话存储
- **ioredis** - Redis 客户端
- **bull** - 基于 Redis 的任务队列

### 认证授权
- **passport** - 认证中间件
- **passport-jwt** - JWT 策略
- **bcryptjs** - 密码加密

### 验证和文档
- **class-validator** - DTO 验证
- **class-transformer** - 数据转换
- **@nestjs/swagger** - API 文档生成

### 日志监控
- **winston** - 日志库
- **@nestjs/terminus** - 健康检查

## Agent 端技术栈（CLI）

### CLI 框架
- **commander** - 命令行参数解析
- **inquirer** - 交互式命令行
- **ora** - 加载动画
- **chalk** - 终端样式

### 核心功能
- **execa** - 更好的子进程管理
- **simple-git** - Git 操作
- **chokidar** - 文件系统监控
- **socket.io-client** - WebSocket 客户端

### 配置管理
- **cosmiconfig** - 灵活的配置加载
- **dotenv** - 环境变量

### 工具库
- **winston** - 日志
- **node-machine-id** - 机器标识

## Web 前端技术栈

### 核心技术
- **react** (19.x) - UI 框架
- **vite** - 构建工具
- **typescript** - 类型安全
- **react-router-dom** (v7) - 路由管理

### 样式方案
- **CSS Modules** - 样式隔离
- **postcss** - CSS 处理
- **postcss-preset-env** - 现代 CSS 特性
- **clsx** - 类名组合工具

### 状态管理
- **zustand** - 轻量级状态管理
- **@tanstack/react-query** - 服务端状态管理

### UI 组件
- **antd** - 企业级 UI 组件库
- **@ant-design/icons** - 图标库

### 编辑器和终端
- **@monaco-editor/react** - VS Code 编辑器
- **xterm** - 终端模拟器
- **xterm-addon-fit** - 终端自适应
- **xterm-addon-web-links** - 终端链接支持

### 实时功能
- **socket.io-client** - WebSocket 客户端
- **react-diff-viewer-continued** - 代码差异展示
- **react-arborist** - 文件树组件

### 数据可视化
- **recharts** - 图表库
- **@tanstack/react-virtual** - 虚拟滚动

### 工具库
- **axios** - HTTP 客户端
- **react-hook-form** - 表单管理
- **dayjs** - 日期处理
- **uuid** - UUID 生成
- **react-error-boundary** - 错误边界
- **react-hotkeys-hook** - 快捷键

### 开发工具
- **@vitejs/plugin-react** - Vite React 插件
- **typescript-plugin-css-modules** - CSS Modules 类型支持

## Shared 包技术栈

- **zod** - 运行时类型验证和模式定义
- **lodash-es** - 工具函数库（ES 模块版本）
- **uuid** - 通用唯一标识符
- **dayjs** - 轻量级日期处理

## 开发工具链

### 包管理
- **pnpm** - 高效的包管理器
- **pnpm workspaces** - Monorepo 支持

### 构建工具
- **tsup** - TypeScript 库打包工具
- **vite** - Web 应用构建
- **tsc** - TypeScript 编译器

### 代码质量
- **eslint** - 代码检查
- **@typescript-eslint/parser** - TypeScript ESLint 解析器
- **prettier** - 代码格式化
- **husky** - Git hooks
- **lint-staged** - 暂存文件检查
- **commitlint** - Commit 信息规范

### 测试工具
- **vitest** - 单元测试框架
- **@testing-library/react** - React 组件测试
- **@testing-library/user-event** - 用户交互测试
- **playwright** - E2E 测试

## 部署和运维

### 容器化
- **Docker** - 容器化部署
- **docker-compose** - 开发环境编排

### 进程管理
- **pm2** - Node.js 进程管理（生产环境）

### 反向代理
- **nginx** - 反向代理和静态资源服务

### 监控
- **@opentelemetry/api** - 可观测性（可选）
- **prom-client** - Prometheus 指标（可选）

## 版本要求

- **Node.js**: >= 20.0.0
- **pnpm**: >= 9.0.0
- **PostgreSQL**: >= 14
- **Redis**: >= 7.0
- **TypeScript**: >= 5.7.0

## 架构决策理由

### 为什么选择 NestJS？
- 模块化架构适合复杂系统
- 内置依赖注入，便于测试
- 完善的 WebSocket 支持
- 丰富的装饰器和中间件生态

### 为什么选择 React 19 + CSS Modules？
- React 19 提供更好的性能和并发特性
- CSS Modules 提供样式隔离，无运行时开销
- 避免 CSS-in-JS 的性能问题
- 与 Ant Design 兼容良好

### 为什么选择 Socket.io？
- 自动重连机制
- 房间和命名空间支持
- 跨平台兼容性好
- 丰富的事件系统

### 为什么选择 PostgreSQL + Redis？
- PostgreSQL: ACID 事务，JSON 支持，适合结构化数据
- Redis: 高性能缓存，任务队列，实时状态存储
- 两者结合满足不同场景需求