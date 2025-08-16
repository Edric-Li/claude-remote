# Agent对话系统任务分解

基于验证专家反馈，本文档提供完全原子化的任务分解，每个任务15-30分钟可完成，具有明确的验收标准和具体的技术实现指导。

## 1. 后端数据模型扩展

### T001: 扩展Session实体添加对话状态字段

**Purpose**: 在现有Session实体中添加对话状态管理字段，支持对话流程控制

**Requirements Reference**: R-001 (会话状态管理), R-002 (对话持久化存储)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/packages/server/src/entities/session.entity.ts`
- 现有字段: `status`, `metadata`, `claudeSessionId`
- 现有状态管理模式

**Implementation**:
1. 在Session实体`metadata`字段中添加对话状态枚举:
   ```typescript
   conversationState?: 'idle' | 'waiting_input' | 'processing' | 'streaming' | 'complete' | 'error'
   ```

2. 添加对话统计字段到`metadata`:
   ```typescript
   lastMessageTimestamp?: Date
   conversationTurnCount?: number
   ```

**Acceptance Criteria**:
- [ ] `conversationState`字段已添加到Session.metadata类型定义
- [ ] `lastMessageTimestamp`和`conversationTurnCount`字段已添加
- [ ] TypeScript编译无错误
- [ ] 现有Session创建/更新逻辑正常工作

**Time Estimate**: 15分钟

**Good Example**:
```typescript
metadata: {
  branch?: string
  lastActivity?: Date
  tokenUsage?: number
  workerStatus?: 'idle' | 'busy'
  workerConfig?: any
  // 新增字段
  conversationState?: 'idle' | 'waiting_input' | 'processing' | 'streaming' | 'complete' | 'error'
  lastMessageTimestamp?: Date
  conversationTurnCount?: number
}
```

**Bad Example**:
```typescript
// 错误：直接添加新的列而不是扩展metadata
@Column('varchar', { length: 20, nullable: true })
conversationState: string
```

---

### T002: 扩展SessionMessage实体支持对话消息结构

**Purpose**: 为SessionMessage实体添加对话系统所需的消息类型和状态字段

**Requirements Reference**: R-001 (会话状态管理), R-003 (消息格式标准化)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/packages/server/src/entities/session.entity.ts`
- 现有消息结构: `from`, `content`, `metadata`
- SessionMessage实体第102-136行

**Implementation**:
1. 扩展SessionMessage.metadata类型添加对话专用字段:
   ```typescript
   messageType?: 'text' | 'tool_use' | 'tool_result' | 'system'
   conversationTurn?: number
   streamingStatus?: 'partial' | 'complete'
   parentMessageId?: string
   ```

2. 保持现有字段不变，仅扩展metadata

**Acceptance Criteria**:
- [ ] SessionMessage.metadata类型已扩展包含对话字段
- [ ] 现有消息创建逻辑不受影响
- [ ] TypeScript编译通过
- [ ] 数据库迁移(如需要)成功执行

**Time Estimate**: 20分钟

---

## 2. WebSocket通信层扩展

### T003: 在ChatGateway中添加对话状态事件处理

**Purpose**: 为ChatGateway添加对话专用的WebSocket事件监听器，处理对话状态变化

**Requirements Reference**: R-004 (实时状态同步), R-005 (WebSocket事件扩展)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/packages/server/src/chat/chat.gateway.ts`
- 现有事件处理器: `@SubscribeMessage` 装饰器模式
- 现有会话管理: `sessionClients` Map (第51行)

**Implementation**:
1. 添加对话状态监听器到ChatGateway类:
   ```typescript
   @SubscribeMessage('conversation:state_change')
   handleConversationStateChange(
     @ConnectedSocket() client: Socket,
     @MessageBody() data: {
       sessionId: string
       state: 'idle' | 'waiting_input' | 'processing' | 'streaming' | 'complete' | 'error'
       timestamp: Date
     }
   ): void
   ```

2. 仿照现有`handleSessionJoin`模式(第610-628行)实现状态广播

**Acceptance Criteria**:
- [ ] `conversation:state_change`事件监听器已实现
- [ ] 状态变化广播到对应session room
- [ ] 遵循现有错误处理模式
- [ ] 控制台日志输出状态变化信息

**Time Estimate**: 25分钟

---

### T004: 添加对话消息历史查询事件

**Purpose**: 在ChatGateway中添加对话历史查询功能，支持前端获取历史消息

**Requirements Reference**: R-001 (会话状态管理), R-006 (历史消息查询)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/packages/server/src/chat/chat.gateway.ts`
- 现有历史处理: `handleHistoryRequest` (第1013-1058行)
- SessionService注入: 第64行

**Implementation**:
1. 添加对话历史查询事件:
   ```typescript
   @SubscribeMessage('conversation:get_history')
   async handleConversationHistory(
     @ConnectedSocket() client: Socket,
     @MessageBody() data: { sessionId: string; limit?: number; offset?: number }
   ): Promise<void>
   ```

2. 调用SessionService获取消息并返回给客户端

**Acceptance Criteria**:
- [ ] `conversation:get_history`事件已实现
- [ ] 支持分页参数(limit, offset)
- [ ] 返回标准化的消息格式
- [ ] 错误处理包含具体错误信息

**Time Estimate**: 30分钟

---

## 3. 前端状态管理扩展

### T005: 在WebSocket Communication Store中添加对话状态管理

**Purpose**: 扩展前端WebSocket状态管理，添加对话系统所需的状态字段和操作方法

**Requirements Reference**: R-004 (实时状态同步), R-007 (前端状态管理)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/packages/web/src/store/websocket-communication.store.ts`
- 现有状态接口: `WebSocketCommunicationState` (第42-79行)
- Zustand store模式

**Implementation**:
1. 扩展状态接口添加对话字段:
   ```typescript
   // 对话状态管理
   conversationState: 'idle' | 'waiting_input' | 'processing' | 'streaming' | 'complete' | 'error'
   conversationHistory: ConversationMessage[]
   currentConversationId: string | null
   ```

2. 添加对话状态action方法

**Acceptance Criteria**:
- [ ] `conversationState`字段已添加到状态接口
- [ ] `conversationHistory`和相关字段已定义
- [ ] 初始状态正确设置为'idle'
- [ ] TypeScript类型检查通过

**Time Estimate**: 20分钟

---

### T006: 添加对话状态变化监听器到WebSocket Store

**Purpose**: 为WebSocket store添加对话状态事件监听，实现实时状态同步

**Requirements Reference**: R-004 (实时状态同步), R-007 (前端状态管理)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/packages/web/src/store/websocket-communication.store.ts`
- 现有事件监听模式: `webSocketClient.on()` (第141-162行)
- 状态更新模式: `set(state => (...))` 

**Implementation**:
1. 在connect方法中添加对话事件监听器:
   ```typescript
   webSocketClient.on('conversation:state_change', (data: any) => {
     set(state => ({
       conversationState: data.state,
       currentConversationId: data.sessionId
     }))
   })
   ```

2. 仿照现有的`agent:connected`监听器模式(第141-154行)

**Acceptance Criteria**:
- [ ] `conversation:state_change`事件监听器已添加
- [ ] 状态更新逻辑正确实现
- [ ] 控制台日志记录状态变化
- [ ] 不影响现有WebSocket事件处理

**Time Estimate**: 15分钟

---

### T007: 添加对话历史获取Action到WebSocket Store

**Purpose**: 为WebSocket store添加获取对话历史的异步action方法

**Requirements Reference**: R-006 (历史消息查询), R-007 (前端状态管理)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/packages/web/src/store/websocket-communication.store.ts`
- 现有异步action模式: `refreshAgentList` (第362-374行)
- WebSocket客户端调用模式

**Implementation**:
1. 添加获取历史的action方法:
   ```typescript
   getConversationHistory: async (sessionId: string, limit?: number, offset?: number) => {
     try {
       // 发送WebSocket请求
       // 等待响应并更新状态
     } catch (error) {
       set({ error: error.message })
     }
   }
   ```

2. 仿照`refreshAgentList`的错误处理模式

**Acceptance Criteria**:
- [ ] `getConversationHistory`方法已实现
- [ ] 支持可选的limit和offset参数
- [ ] 正确的错误处理和状态更新
- [ ] Promise返回类型正确

**Time Estimate**: 25分钟

---

## 4. 前端组件集成

### T008: 在ChatInterface中添加对话状态显示组件

**Purpose**: 在现有ChatInterface组件中集成对话状态显示，提供视觉反馈

**Requirements Reference**: R-008 (用户界面增强), R-009 (状态可视化)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/claudecodeui/src/components/ChatInterface.jsx`
- 现有状态显示: `ClaudeStatus`组件 (第2333-2337行)
- React hooks使用模式

**Implementation**:
1. 在ChatInterface中添加对话状态展示:
   ```jsx
   const [conversationState, setConversationState] = useState('idle')
   
   // 在消息区域上方显示状态
   {conversationState !== 'idle' && (
     <div className="conversation-status">
       Current state: {conversationState}
     </div>
   )}
   ```

2. 位置：在现有messages区域上方(第2248-2300行)

**Acceptance Criteria**:
- [ ] 对话状态显示组件已添加
- [ ] 状态变化时UI正确更新
- [ ] 样式与现有ChatInterface一致
- [ ] 不影响现有消息显示功能

**Time Estimate**: 20分钟

---

### T009: 集成WebSocket Store到ChatInterface组件

**Purpose**: 将ChatInterface组件连接到扩展的WebSocket store，实现对话状态双向绑定

**Requirements Reference**: R-007 (前端状态管理), R-008 (用户界面增强)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/claudecodeui/src/components/ChatInterface.jsx`
- 现有WebSocket消息处理: `useEffect` hook (第1420-1695行)
- Store订阅模式

**Implementation**:
1. 在ChatInterface中订阅WebSocket store状态:
   ```jsx
   const { conversationState, getConversationHistory } = useWebSocketCommunicationStore()
   
   useEffect(() => {
     // 监听对话状态变化
     // 更新本地状态
   }, [conversationState])
   ```

2. 集成到现有的WebSocket消息处理逻辑中

**Acceptance Criteria**:
- [ ] WebSocket store成功导入并使用
- [ ] 对话状态正确同步到组件
- [ ] 不破坏现有消息处理逻辑
- [ ] 性能无明显下降

**Time Estimate**: 25分钟

---

## 5. 并发控制系统

### T010: 实现基础会话锁机制

**Purpose**: 实现基础的会话锁定机制，防止多个对话并发修改同一会话

**Requirements Reference**: R-010 (会话并发控制), R-011 (资源竞争防护)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/packages/server/src/services/session.service.ts`
- 现有服务模式和错误处理

**Implementation**:
1. 在SessionService中添加会话锁Map:
   ```typescript
   private sessionLocks = new Map<string, boolean>()
   
   async acquireSessionLock(sessionId: string): Promise<boolean> {
     if (this.sessionLocks.get(sessionId)) {
       return false // 已锁定
     }
     this.sessionLocks.set(sessionId, true)
     return true
   }
   ```

2. 添加锁释放和清理机制

**Acceptance Criteria**:
- [ ] 会话锁Map正确初始化
- [ ] `acquireSessionLock`方法返回正确的布尔值
- [ ] `releaseSessionLock`方法正确清理锁状态
- [ ] 锁定状态持久化(内存即可)

**Time Estimate**: 30分钟

---

### T011: 在ChatGateway中集成会话锁检查

**Purpose**: 在WebSocket消息处理中集成会话锁检查，确保并发安全

**Requirements Reference**: R-010 (会话并发控制), R-004 (实时状态同步)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/packages/server/src/chat/chat.gateway.ts`
- SessionService注入: 第64行
- 现有消息处理方法

**Implementation**:
1. 在对话相关事件处理中添加锁检查:
   ```typescript
   @SubscribeMessage('conversation:send_message')
   async handleConversationMessage(...) {
     const lockAcquired = await this.sessionService.acquireSessionLock(data.sessionId)
     if (!lockAcquired) {
       client.emit('conversation:error', { message: 'Session is busy' })
       return
     }
     // 处理消息...
     await this.sessionService.releaseSessionLock(data.sessionId)
   }
   ```

2. 确保异常情况下锁能正确释放

**Acceptance Criteria**:
- [ ] 会话锁检查已集成到消息处理中
- [ ] 锁定失败时返回错误消息
- [ ] try-catch确保锁在异常时释放
- [ ] 不影响非对话相关的WebSocket功能

**Time Estimate**: 25分钟

---

## 6. Git Worktree工作区管理

### T012: 实现基础Worktree检测功能

**Purpose**: 实现检测项目是否使用Git worktree的基础功能

**Requirements Reference**: R-012 (Git worktree检测), R-013 (工作区隔离)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/packages/server/src/services/repository.service.ts`
- 现有Git操作和文件系统检查模式

**Implementation**:
1. 添加worktree检测方法:
   ```typescript
   async isWorktreeRepository(repoPath: string): Promise<boolean> {
     try {
       const gitWorktreeFile = path.join(repoPath, '.git')
       if (fs.existsSync(gitWorktreeFile)) {
         const content = await fs.readFile(gitWorktreeFile, 'utf8')
         return content.startsWith('gitdir:')
       }
       return false
     } catch (error) {
       return false
     }
   }
   ```

2. 仿照现有的仓库检查模式

**Acceptance Criteria**:
- [ ] `isWorktreeRepository`方法正确识别worktree
- [ ] 普通Git仓库返回false
- [ ] Worktree仓库返回true
- [ ] 异常情况正确处理

**Time Estimate**: 20分钟

---

### T013: 添加Worktree信息获取功能

**Purpose**: 实现获取Git worktree详细信息的功能，包括主仓库路径等

**Requirements Reference**: R-012 (Git worktree检测), R-013 (工作区隔离)

**Leverage**: 
- 文件: `/Users/edric/Code/OpenSource/claude-remote/packages/server/src/services/repository.service.ts`
- 前一任务的worktree检测基础

**Implementation**:
1. 添加worktree信息获取方法:
   ```typescript
   async getWorktreeInfo(repoPath: string): Promise<WorktreeInfo | null> {
     if (!await this.isWorktreeRepository(repoPath)) {
       return null
     }
     
     const gitDir = await this.readGitDir(repoPath)
     const mainRepoPath = path.dirname(gitDir)
     return {
       isWorktree: true,
       mainRepositoryPath: mainRepoPath,
       worktreePath: repoPath
     }
   }
   ```

2. 定义WorktreeInfo接口

**Acceptance Criteria**:
- [ ] `getWorktreeInfo`方法返回正确的worktree信息
- [ ] 非worktree仓库返回null
- [ ] `WorktreeInfo`接口包含必要字段
- [ ] 路径解析正确处理

**Time Estimate**: 25分钟

---

## 7. 系统集成测试

### T014: 创建对话状态集成测试

**Purpose**: 创建端到端测试验证对话状态管理的完整流程

**Requirements Reference**: R-014 (系统集成测试)

**Leverage**: 
- 现有的测试架构和模式
- 已实现的对话状态管理功能

**Implementation**:
1. 创建测试场景:
   - 创建新对话会话
   - 发送消息并验证状态变化
   - 检查WebSocket事件传播
   - 验证状态持久化

2. 使用现有测试工具和断言

**Acceptance Criteria**:
- [ ] 对话创建到完成的完整流程测试通过
- [ ] WebSocket事件正确传播和处理
- [ ] 状态变化按预期进行
- [ ] 测试可重复执行

**Time Estimate**: 30分钟

---

### T015: 验证并发控制测试

**Purpose**: 创建并发场景测试，验证会话锁和资源竞争防护

**Requirements Reference**: R-010 (会话并发控制), R-014 (系统集成测试)

**Leverage**: 
- 已实现的会话锁机制
- 现有的并发测试模式

**Implementation**:
1. 创建并发测试场景:
   - 同时发送多个消息到同一会话
   - 验证只有一个消息被处理
   - 检查锁释放机制
   - 测试异常情况下的锁清理

**Acceptance Criteria**:
- [ ] 并发消息正确按顺序处理
- [ ] 会话锁正确防止竞争条件
- [ ] 异常情况下锁正确释放
- [ ] 性能在可接受范围内

**Time Estimate**: 30分钟

---

## 任务执行优先级

**第一批 (核心数据模型)**:
- T001: Session实体扩展 ⭐⭐⭐
- T002: SessionMessage实体扩展 ⭐⭐⭐

**第二批 (WebSocket通信)**:
- T003: ChatGateway状态事件 ⭐⭐
- T004: 历史查询事件 ⭐⭐

**第三批 (前端集成)**:
- T005: WebSocket Store扩展 ⭐⭐
- T006: 状态监听器 ⭐⭐
- T007: 历史获取Action ⭐

**第四批 (UI集成)**:
- T008: ChatInterface状态显示 ⭐
- T009: Store集成 ⭐

**第五批 (并发控制)**:
- T010: 会话锁机制 ⭐⭐⭐
- T011: ChatGateway锁集成 ⭐⭐

**第六批 (Git Worktree)**:
- T012: Worktree检测 ⭐⭐
- T013: Worktree信息获取 ⭐

**第七批 (验证测试)**:
- T014: 集成测试 ⭐
- T015: 并发测试 ⭐

## 总工作量估算
- 总任务数: 15个原子任务
- 估计总时间: 350分钟 (约5.8小时)
- 建议执行周期: 2-3个工作日

## 质量保证检查清单

每个任务完成后必须检查:
- [ ] TypeScript编译无错误
- [ ] 现有功能未受影响
- [ ] 相关测试通过
- [ ] 代码符合项目规范
- [ ] 变更已提交并附有清晰的commit message

## 风险识别与缓解

**高风险任务**:
- T001/T002: 数据模型变更可能影响现有功能
- T010/T011: 并发控制可能引入死锁

**缓解措施**:
- 优先备份现有代码
- 逐步测试每个变更
- 保持向后兼容性