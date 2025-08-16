# Conversation Components

## 概述

对话组件库提供了完整的AI对话功能，从对话创建到实际聊天的整个生命周期管理。

## 组件架构

```
ConversationInterface (主组件)
├── ConversationCreate (对话创建)
│   ├── AgentSelector (Agent选择)
│   └── RepositorySelector (仓库选择)
└── ChatInterface (聊天界面)
```

## 主要组件

### ConversationInterface

完整对话功能的入口组件，管理整个对话生命周期。

#### 功能特性

- **多阶段管理**: 创建 → 聊天 → 完成/错误
- **状态转换**: 平滑的用户体验过渡
- **错误处理**: 完整的错误处理和重试机制
- **WebSocket集成**: 实时通信支持

#### 使用示例

```tsx
import { ConversationInterface } from '@/components/conversation'

function App() {
  return (
    <ConversationInterface
      onConversationClose={(conversationId) => {
        console.log('对话已关闭:', conversationId)
      }}
    />
  )
}
```

#### Props

| 属性 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `className` | `string` | 否 | 自定义CSS类名 |
| `onConversationClose` | `(conversationId: string) => void` | 否 | 对话关闭回调 |

### ConversationCreate

对话创建向导组件，提供分步配置流程。

#### 使用示例

```tsx
import { ConversationCreate } from '@/components/conversation'

function CreateDialog() {
  const handleCreate = (config: ConversationConfig) => {
    console.log('创建对话配置:', config)
  }

  return (
    <ConversationCreate
      onCreateConversation={handleCreate}
      loading={false}
      disabled={false}
    />
  )
}
```

### ChatInterface

实时聊天界面组件。

#### 使用示例

```tsx
import { ChatInterface } from '@/components/conversation'

function Chat() {
  return (
    <ChatInterface
      conversationId="conv-123"
      agentId="agent-456"
      repositoryId="repo-789"
      onClose={() => console.log('聊天关闭')}
    />
  )
}
```

## 状态管理

### WebSocket Store

组件依赖于 `useWebSocketCommunicationStore` 进行状态管理：

```typescript
const {
  connected,        // WebSocket连接状态
  agents,          // 可用Agent列表
  conversations,   // 对话会话映射
  createConversation,    // 创建对话
  updateConversationState, // 更新对话状态
  removeConversation     // 移除对话
} = useWebSocketCommunicationStore()
```

### 对话生命周期

1. **创建阶段** (`creating`)
   - 用户配置Agent、仓库、工具权限
   - 验证配置有效性
   - 建立WebSocket连接

2. **聊天阶段** (`chatting`)
   - 显示ChatInterface组件
   - 实时消息交换
   - 工具调用处理

3. **完成阶段** (`completed`)
   - 对话正常结束
   - 清理资源

4. **错误阶段** (`error`)
   - 显示错误信息
   - 提供重试选项

## 错误处理

### 连接错误

- WebSocket连接失败
- Agent离线
- 网络问题

### 创建错误

- 配置验证失败
- Agent不可用
- 仓库访问错误

### 运行时错误

- 消息发送失败
- 工具调用错误
- 会话中断

## 最佳实践

### 1. 错误边界

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'

<ErrorBoundary>
  <ConversationInterface />
</ErrorBoundary>
```

### 2. 加载状态

组件内置了完整的加载状态指示，无需额外处理。

### 3. 资源清理

组件会自动处理资源清理，包括：
- WebSocket连接管理
- localStorage清理
- 事件监听器移除

### 4. 类型安全

所有组件都提供完整的TypeScript类型支持：

```typescript
import type { 
  ConversationConfig,
  ConversationSession,
  ConversationMessage 
} from '@/types/conversation.types'
```

## 样式定制

### CSS类名

组件使用Tailwind CSS，支持通过`className`属性自定义样式：

```tsx
<ConversationInterface 
  className="custom-conversation bg-gray-100"
/>
```

### 响应式设计

所有组件都支持响应式设计，适配桌面端和移动端。

## 调试

### 开发模式

在开发模式下，组件会输出详细的控制台日志：

```javascript
// WebSocket连接
✅ WebSocket客户端已连接
📱 Agent已连接: { agentId: 'agent-123', name: 'Claude' }

// 对话创建
✅ 对话创建成功: conv-456
🔄 对话已关闭: conv-456

// 消息处理
💬 收到聊天回复: { content: '...' }
🔧 收到Worker消息: { type: 'tool_use' }
```

### 常见问题

1. **对话创建失败**
   - 检查Agent是否在线
   - 验证仓库配置
   - 确认WebSocket连接

2. **消息发送失败**
   - 检查网络连接
   - 验证Agent状态
   - 查看控制台错误

3. **组件不渲染**
   - 检查必需的props
   - 确认WebSocket store初始化
   - 验证路由配置

## 更新日志

### v1.0.0 (2024-08-16)

- ✅ ConversationInterface主组件创建
- ✅ 完整的对话生命周期管理
- ✅ 错误处理和重试机制
- ✅ WebSocket通信集成
- ✅ 响应式设计支持
- ✅ TypeScript类型安全