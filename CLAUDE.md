# AI Orchestra 开发规范

本文档定义了 AI Orchestra 项目的编码规范和最佳实践。所有贡献者都应遵循这些规范。

## 1. TypeScript 规范

### 类型定义
- 优先使用 `interface` 而非 `type`（除非需要联合类型）
- 禁止使用 `any`，必要时使用 `unknown`
- 所有函数必须声明返回类型
- 使用严格模式（`strict: true`）

```typescript
// ✅ 好的做法
interface UserProps {
  name: string
  age: number
}

function getUser(id: string): Promise<User> {
  // ...
}

// ❌ 避免
type UserProps = {
  name: string
  age: any  // 避免 any
}
```

### 枚举和常量
- 使用 `const enum` 或对象常量代替普通枚举
- 常量使用 UPPER_SNAKE_CASE

```typescript
// ✅ 推荐
const enum Status {
  PENDING = 'pending',
  ACTIVE = 'active'
}

export const API_ENDPOINTS = {
  USERS: '/api/users',
  TASKS: '/api/tasks'
} as const
```

## 2. React 规范

### 组件规范
- 只使用函数组件和 Hooks
- 组件文件名使用 PascalCase
- Props 接口命名为 `ComponentNameProps`
- 自定义 Hook 以 `use` 开头

```typescript
// ✅ 好的做法
interface TaskListProps {
  tasks: Task[]
  onSelect: (id: string) => void
}

export function TaskList({ tasks, onSelect }: TaskListProps) {
  // ...
}
```

### 性能优化
- 避免内联函数和对象
- 使用 `React.memo`、`useMemo`、`useCallback` 优化重渲染
- 大型列表使用虚拟滚动

## 3. 文件和目录规范

### 命名规则
```
components/
  TaskList.tsx          # 组件文件 - PascalCase
  TaskList.module.css   # 样式文件
  TaskList.test.tsx     # 测试文件

utils/
  dateHelper.ts         # 工具函数 - camelCase
  constants.ts          # 常量文件

types/
  index.ts             # 类型定义
```

### 文件组织
- 每个文件单一职责
- 相关文件就近放置
- 公共组件放 `shared/components/`
- 页面组件放 `pages/` 或 `views/`

## 4. 代码行数限制

### 文件长度
- 单个文件不超过 **300 行**
- React 组件文件不超过 **200 行**
- 超限时拆分成多个模块

### 函数长度
- 普通函数不超过 **50 行**
- 复杂函数不超过 **80 行**（需详细注释）
- React 组件不超过 **150 行**（含 JSX）

### 其他限制
- 最大行宽：**100 字符**
- 单个类不超过 **300 行**
- 接口属性不超过 **50 个**
- JSX 嵌套不超过 **5 层**
- if-else 不超过 **5 个分支**
- switch 不超过 **10 个 case**

## 5. 异步处理规范

```typescript
// ✅ 使用 async/await
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await api.get(`/users/${id}`)
    return response.data
  } catch (error) {
    logger.error('Failed to fetch user', error)
    throw new UserNotFoundError(id)
  }
}

// ❌ 避免嵌套 Promise
function fetchUser(id: string) {
  return api.get(`/users/${id}`)
    .then(response => {
      return response.data
    })
    .catch(error => {
      // ...
    })
}
```

## 6. 状态管理规范

### Zustand Store
```typescript
// stores/taskStore.ts
interface TaskStore {
  tasks: Task[]
  loading: boolean
  addTask: (task: Task) => void
  removeTask: (id: string) => void
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  loading: false,
  addTask: (task) => set((state) => ({ 
    tasks: [...state.tasks, task] 
  })),
  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== id)
  }))
}))
```

## 7. API 和通信规范

### RESTful API
- GET: 获取资源
- POST: 创建资源
- PUT: 完整更新
- PATCH: 部分更新
- DELETE: 删除资源

### WebSocket 事件命名
```typescript
// 使用冒号分隔的命名空间
socket.on('task:created', handleTaskCreated)
socket.on('task:updated', handleTaskUpdated)
socket.on('agent:connected', handleAgentConnected)
```

## 8. 注释规范

```typescript
/**
 * 获取指定项目的所有任务
 * @param projectId - 项目 ID
 * @param options - 查询选项
 * @returns 任务列表
 */
export async function getProjectTasks(
  projectId: string,
  options?: QueryOptions
): Promise<Task[]> {
  // 复杂逻辑的解释注释
  // TODO(username): 添加分页支持 - 2024-01-15
  
  // ...
}
```

## 9. Git 提交规范

### Commit 消息格式
```
type(scope): subject

body (optional)

footer (optional)
```

### Type 类型
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具

### 示例
```bash
feat(agent): add file watcher support

- Implement file system monitoring using chokidar
- Add real-time file change notifications
- Support ignore patterns

Closes #123
```

### 分支命名
- `feature/task-scheduling`
- `fix/websocket-reconnect`
- `docs/api-guide`
- `refactor/state-management`

## 10. 测试规范

```typescript
// TaskList.test.tsx
describe('TaskList', () => {
  it('should render empty state when no tasks', () => {
    render(<TaskList tasks={[]} />)
    expect(screen.getByText('No tasks')).toBeInTheDocument()
  })

  it('should handle task selection', async () => {
    const onSelect = vi.fn()
    render(<TaskList tasks={mockTasks} onSelect={onSelect} />)
    
    await userEvent.click(screen.getByText('Task 1'))
    expect(onSelect).toHaveBeenCalledWith('task-1')
  })
})
```

## 11. 安全规范

- 所有用户输入必须验证和清理
- 使用参数化查询防止 SQL 注入
- 使用 CSP 头防止 XSS
- 敏感信息（密钥、密码）使用环境变量
- 定期更新依赖项

## 12. 性能规范

- 路由级别的代码分割
- 图片懒加载
- 防抖用户输入（300ms）
- 节流滚动事件（100ms）
- 使用 Web Workers 处理耗时计算

## 13. CSS Modules 规范

```css
/* TaskList.module.css */
.container {
  padding: 16px;
}

.taskItem {
  border-bottom: 1px solid #eee;
}

/* 避免全局样式污染 */
.taskItem :global(.ant-btn) {
  margin-left: 8px;
}
```

## 14. 错误处理

```typescript
// 定义错误类
class BusinessError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'BusinessError'
  }
}

// 统一错误处理
export function handleError(error: unknown): void {
  if (error instanceof BusinessError) {
    notification.error({
      message: error.message,
      description: `错误代码: ${error.code}`
    })
  } else if (error instanceof Error) {
    logger.error('Unexpected error', error)
    notification.error({
      message: '系统错误',
      description: '请稍后重试'
    })
  }
}
```

## 15. 导入顺序

```typescript
// 1. Node 内置模块
import path from 'node:path'
import { readFile } from 'node:fs/promises'

// 2. 外部依赖
import React, { useState, useEffect } from 'react'
import { Button } from 'antd'
import axios from 'axios'

// 3. 内部模块（绝对路径）
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/services/api'

// 4. 相对路径导入
import { TaskItem } from './TaskItem'
import styles from './TaskList.module.css'
```

## 总结

遵循这些规范将帮助我们：
- 保持代码一致性和可读性
- 提高代码质量和可维护性
- 减少 bug 和安全问题
- 促进团队协作

定期 review 和更新这些规范，确保它们始终符合项目需求。