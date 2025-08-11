# AI Orchestra - 通信层架构设计

## 概述

本文档详细设计了 AI Orchestra 系统中 Web -> Server -> Agent 之间的完整通信架构，包括协议设计、消息格式、错误处理和性能优化方案。

---

## 1. 系统架构概览

### 1.1 通信层级
```
┌─────────────┐    HTTP/WebSocket    ┌─────────────┐    WebSocket    ┌─────────────┐
│    Web      │ ────────────────────▶│   Server    │ ──────────────▶ │   Agent     │
│   Client    │                      │   (NestJS)  │                 │  (Remote)   │
│             │◀──────────────────── │             │◀────────────────│             │
└─────────────┘    JSON/Events       └─────────────┘    Messages     └─────────────┘
```

### 1.2 技术栈
- **Web Client**: React + Socket.IO Client + Zustand
- **Server**: NestJS + Socket.IO + TypeORM + PostgreSQL
- **Agent**: Python/Node.js + Socket.IO Client

---

## 2. Web -> Server 通信层

### 2.1 连接管理

#### 2.1.1 HTTP RESTful API
**用途**: 用户认证、数据持久化、配置管理

**API结构**:
```typescript
// 基础API客户端
class BaseApi {
  protected basePath: string
  protected getAuthToken(): string | null
  protected handleResponse<T>(response: Response): Promise<T>
  
  // HTTP方法
  protected get<T>(endpoint: string, params?: any): Promise<T>
  protected post<T>(endpoint: string, data?: any): Promise<T>
  protected put<T>(endpoint: string, data?: any): Promise<T>
  protected delete<T>(endpoint: string): Promise<T>
}

// 具体API服务
export class AuthApi extends BaseApi {
  async login(credentials: LoginDto): Promise<AuthResponse>
  async getCurrentUser(): Promise<User>
  async refreshToken(): Promise<AuthResponse>
}

export class UsersApi extends CrudApi<User, CreateUserDto, UpdateUserDto>
export class AiConfigsApi extends CrudApi<UserAiConfig, CreateAiConfigDto, UpdateAiConfigDto>
```

**认证机制**:
```typescript
// JWT Token管理
interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
}

// 自动Token刷新
const apiInterceptor = {
  request: (config) => {
    const token = getAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  
  response: (response) => response,
  
  responseError: async (error) => {
    if (error.response?.status === 401) {
      await refreshToken()
      // 重试原请求
      return retryRequest(error.config)
    }
    throw error
  }
}
```

#### 2.1.2 WebSocket 实时通信
**用途**: 实时状态同步、会话管理、Agent通信

**连接配置**:
```typescript
// Socket.IO 客户端配置
const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  auth: (cb) => {
    cb({ token: getAuthToken() })
  }
})
```

**状态管理**:
```typescript
interface WebSocketState {
  socket: Socket | null
  connected: boolean
  agents: Agent[]
  selectedAgentId: string | null
  messages: Message[]
  workerOutput: WorkerOutputItem[]
  currentTaskId: string | null
}
```

### 2.2 消息协议设计

#### 2.2.1 会话管理消息
```typescript
// 加入会话
socket.emit('session:join', {
  sessionId: string,
  userId: string
})

// 离开会话
socket.emit('session:leave', {
  sessionId: string
})

// 会话状态更新
socket.on('session:updated', {
  sessionId: string,
  status: 'active' | 'paused' | 'ended',
  participants: string[]
})
```

#### 2.2.2 Agent管理消息
```typescript
// Agent状态查询
socket.emit('agents:list')

// Agent状态响应
socket.on('agents:updated', {
  agents: Array<{
    id: string,
    name: string,
    status: 'online' | 'offline' | 'busy',
    connectedAt: Date,
    latency?: number
  }>
})

// Agent连接/断开通知
socket.on('agent:connected', { agentId: string })
socket.on('agent:disconnected', { agentId: string })
```

#### 2.2.3 Worker任务消息
```typescript
// 启动Worker
socket.emit('worker:start', {
  agentId: string,
  taskId: string,
  tool: 'claude' | 'qwcoder' | 'custom',
  workingDirectory?: string,
  initialPrompt?: string,
  claudeSessionId?: string  // 恢复会话
})

// Worker输入
socket.emit('worker:input', {
  agentId: string,
  taskId: string,
  input: string,
  tool?: string
})

// Worker输出
socket.on('worker:output', {
  taskId: string,
  agentId: string,
  type: 'user' | 'assistant' | 'tool' | 'tool-result' | 'system',
  content: string,
  timestamp: Date,
  details?: Record<string, unknown>,
  usage?: TokenUsage,
  stats?: ExecutionStats
})

// Worker状态
socket.on('worker:status', {
  taskId: string,
  agentId: string,
  status: 'starting' | 'running' | 'paused' | 'completed' | 'error',
  message?: string
})
```

---

## 3. Server -> Agent 通信层

### 3.1 Agent连接管理

#### 3.1.1 Agent注册协议
```typescript
// Agent注册
socket.emit('agent:register', {
  agentId: string,
  name: string,
  capabilities: string[],
  version: string,
  metadata?: Record<string, any>
})

// 注册确认
socket.on('agent:registered', {
  success: boolean,
  agentId: string,
  assignedTasks?: string[]
})

// 心跳检测
socket.emit('agent:heartbeat', {
  agentId: string,
  timestamp: Date,
  systemInfo?: {
    cpu: number,
    memory: number,
    disk: number
  }
})
```

#### 3.1.2 服务端Agent管理
```typescript
// Agent连接状态
interface ConnectedAgent {
  id: string
  name: string
  socketId: string
  connectedAt: Date
  agentId: string  // Database ID
  latency?: number
  capabilities: string[]
  systemInfo?: SystemInfo
}

// Agent管理服务
@Injectable()
export class AgentService {
  private connectedAgents = new Map<string, ConnectedAgent>()
  
  async registerAgent(socket: Socket, data: AgentRegisterDto) {
    // 验证Agent身份
    // 更新数据库状态
    // 添加到连接列表
    // 通知所有Web客户端
  }
  
  async unregisterAgent(socketId: string) {
    // 从连接列表移除
    // 更新数据库状态
    // 停止相关任务
    // 通知Web客户端
  }
  
  getAvailableAgents(tool?: string): ConnectedAgent[] {
    // 返回可用的Agent列表
  }
}
```

### 3.2 任务分发协议

#### 3.2.1 任务生命周期
```typescript
// 任务创建
interface TaskCreateDto {
  taskId: string
  type: 'chat' | 'code' | 'analysis'
  tool: string
  parameters: {
    prompt?: string
    workingDirectory?: string
    sessionId?: string
    userId: string
  }
  priority: 'low' | 'normal' | 'high'
}

// 任务分发
socket.emit('task:assign', {
  taskId: string,
  agentId: string,
  task: TaskCreateDto
})

// 任务接受确认
socket.on('task:accepted', {
  taskId: string,
  agentId: string,
  estimatedDuration?: number
})

// 任务拒绝
socket.on('task:rejected', {
  taskId: string,
  agentId: string,
  reason: string
})
```

#### 3.2.2 执行状态同步
```typescript
// 执行进度
socket.on('task:progress', {
  taskId: string,
  agentId: string,
  progress: number, // 0-100
  currentStep?: string,
  estimatedRemaining?: number
})

// 执行结果
socket.on('task:result', {
  taskId: string,
  agentId: string,
  success: boolean,
  result?: any,
  error?: string,
  duration: number,
  resourceUsage?: ResourceUsage
})

// 实时输出流
socket.on('task:stream', {
  taskId: string,
  agentId: string,
  type: 'stdout' | 'stderr' | 'log',
  data: string,
  timestamp: Date
})
```

---

## 4. 消息格式和协议规范

### 4.1 统一消息格式

#### 4.1.1 基础消息结构
```typescript
interface BaseMessage {
  id: string              // 消息唯一ID
  timestamp: Date         // 时间戳
  source: 'web' | 'server' | 'agent'  // 消息来源
  target?: string         // 目标ID
  type: string           // 消息类型
  version: '1.0'         // 协议版本
}

interface RequestMessage extends BaseMessage {
  method: string         // 请求方法
  params: any           // 请求参数
  requestId: string     // 请求ID，用于响应匹配
}

interface ResponseMessage extends BaseMessage {
  requestId: string     // 对应的请求ID
  success: boolean      // 执行结果
  data?: any           // 响应数据
  error?: ErrorInfo    // 错误信息
}

interface EventMessage extends BaseMessage {
  event: string        // 事件名称
  data: any           // 事件数据
}
```

#### 4.1.2 错误信息格式
```typescript
interface ErrorInfo {
  code: string          // 错误代码
  message: string       // 错误描述
  details?: any        // 详细信息
  timestamp: Date      // 错误时间
  stack?: string       // 错误堆栈（开发环境）
}

// 标准错误代码
enum ErrorCode {
  // 连接错误
  CONNECTION_FAILED = 'CONN_001',
  CONNECTION_TIMEOUT = 'CONN_002',
  AUTHENTICATION_FAILED = 'AUTH_001',
  
  // 业务错误
  AGENT_NOT_AVAILABLE = 'AGENT_001',
  TASK_EXECUTION_FAILED = 'TASK_001',
  INVALID_PARAMETERS = 'PARAM_001',
  
  // 系统错误
  INTERNAL_SERVER_ERROR = 'SYS_001',
  DATABASE_ERROR = 'DB_001',
  RESOURCE_EXHAUSTED = 'RES_001'
}
```

### 4.2 数据序列化

#### 4.2.1 JSON序列化配置
```typescript
// 自定义JSON序列化
class MessageSerializer {
  static serialize(data: any): string {
    return JSON.stringify(data, (key, value) => {
      // 处理Date对象
      if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() }
      }
      // 处理BigInt
      if (typeof value === 'bigint') {
        return { __type: 'BigInt', value: value.toString() }
      }
      return value
    })
  }
  
  static deserialize(json: string): any {
    return JSON.parse(json, (key, value) => {
      if (value && typeof value === 'object') {
        if (value.__type === 'Date') {
          return new Date(value.value)
        }
        if (value.__type === 'BigInt') {
          return BigInt(value.value)
        }
      }
      return value
    })
  }
}
```

#### 4.2.2 消息压缩
```typescript
// 大消息压缩
interface CompressedMessage {
  compressed: true
  algorithm: 'gzip' | 'deflate'
  originalSize: number
  compressedData: string  // Base64编码的压缩数据
}

class MessageCompressor {
  static compress(data: string, threshold: number = 1024): string | CompressedMessage {
    if (data.length < threshold) {
      return data
    }
    
    const compressed = gzip(data)
    const base64 = Buffer.from(compressed).toString('base64')
    
    return {
      compressed: true,
      algorithm: 'gzip',
      originalSize: data.length,
      compressedData: base64
    }
  }
  
  static decompress(data: string | CompressedMessage): string {
    if (typeof data === 'string') {
      return data
    }
    
    const buffer = Buffer.from(data.compressedData, 'base64')
    return gunzip(buffer).toString('utf8')
  }
}
```

---

## 5. 错误处理和重连机制

### 5.1 连接错误处理

#### 5.1.1 Web客户端错误处理
```typescript
class ConnectionManager {
  private socket: Socket
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private baseDelay = 1000
  
  connect() {
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      this.handleConnectionError(error)
    })
    
    this.socket.on('disconnect', (reason) => {
      console.warn('Disconnected:', reason)
      if (reason === 'io server disconnect') {
        // 服务器主动断开，需要重新认证
        this.authenticate()
      }
    })
    
    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts')
      this.reconnectAttempts = 0
      // 重新同步状态
      this.syncState()
    })
  }
  
  private handleConnectionError(error: Error) {
    this.reconnectAttempts++
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      // 显示离线提示
      this.showOfflineNotification()
      return
    }
    
    // 指数退避重连
    const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts - 1)
    setTimeout(() => {
      this.socket.connect()
    }, delay)
  }
  
  private async syncState() {
    // 重连后同步用户状态
    this.socket.emit('user:sync', { userId: getCurrentUserId() })
    
    // 重新加载会话列表
    await this.loadSessions()
    
    // 恢复活跃会话
    const activeSessionId = getActiveSessionId()
    if (activeSessionId) {
      this.socket.emit('session:join', { sessionId: activeSessionId })
    }
  }
}
```

#### 5.1.2 服务端错误处理
```typescript
@WebSocketGateway()
export class ChatGateway {
  
  @UseFilters(new WsExceptionFilter())
  async handleConnection(client: Socket) {
    try {
      // 验证连接
      await this.validateConnection(client)
    } catch (error) {
      client.emit('error', {
        code: 'AUTH_001',
        message: 'Authentication failed'
      })
      client.disconnect()
    }
  }
  
  @SubscribeMessage('task:assign')
  @UseFilters(new WsExceptionFilter())
  async handleTaskAssign(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TaskAssignDto
  ) {
    try {
      const result = await this.taskService.assignTask(data)
      client.emit('task:assigned', { success: true, taskId: data.taskId })
    } catch (error) {
      client.emit('task:error', {
        taskId: data.taskId,
        error: {
          code: this.getErrorCode(error),
          message: error.message,
          timestamp: new Date()
        }
      })
    }
  }
}

// WebSocket异常过滤器
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>()
    
    const errorResponse = {
      code: this.getErrorCode(exception),
      message: exception.message || 'Internal server error',
      timestamp: new Date()
    }
    
    client.emit('error', errorResponse)
  }
  
  private getErrorCode(exception: any): string {
    if (exception instanceof UnauthorizedException) {
      return 'AUTH_001'
    }
    if (exception instanceof BadRequestException) {
      return 'PARAM_001'
    }
    return 'SYS_001'
  }
}
```

### 5.2 Agent错误处理

#### 5.2.1 Agent端重连机制
```python
# Python Agent重连示例
import socketio
import asyncio
from typing import Optional

class AgentClient:
    def __init__(self, server_url: str, agent_id: str):
        self.server_url = server_url
        self.agent_id = agent_id
        self.sio = socketio.AsyncClient(
            reconnection=True,
            reconnection_attempts=5,
            reconnection_delay=1,
            reconnection_delay_max=5
        )
        self.current_tasks = {}
        self.setup_handlers()
    
    def setup_handlers(self):
        @self.sio.event
        async def connect():
            print(f"Agent {self.agent_id} connected")
            await self.register()
        
        @self.sio.event
        async def disconnect():
            print(f"Agent {self.agent_id} disconnected")
            # 保存当前任务状态
            await self.save_task_state()
        
        @self.sio.event
        async def reconnect():
            print(f"Agent {self.agent_id} reconnected")
            # 恢复任务状态
            await self.restore_task_state()
        
        @self.sio.on('task:assign')
        async def handle_task(data):
            try:
                task_id = data['taskId']
                await self.execute_task(task_id, data['task'])
            except Exception as e:
                await self.sio.emit('task:error', {
                    'taskId': task_id,
                    'agentId': self.agent_id,
                    'error': str(e)
                })
    
    async def register(self):
        registration_data = {
            'agentId': self.agent_id,
            'name': f'Agent-{self.agent_id}',
            'capabilities': ['claude', 'code-execution'],
            'version': '1.0.0'
        }
        await self.sio.emit('agent:register', registration_data)
    
    async def execute_task(self, task_id: str, task_data: dict):
        self.current_tasks[task_id] = task_data
        
        try:
            # 执行任务逻辑
            result = await self.process_task(task_data)
            
            # 发送结果
            await self.sio.emit('task:result', {
                'taskId': task_id,
                'agentId': self.agent_id,
                'success': True,
                'result': result
            })
            
            # 清理任务状态
            del self.current_tasks[task_id]
            
        except Exception as e:
            await self.sio.emit('task:result', {
                'taskId': task_id,
                'agentId': self.agent_id,
                'success': False,
                'error': str(e)
            })
```

#### 5.2.2 服务端Agent监控
```typescript
@Injectable()
export class AgentMonitorService {
  private agentHealthMap = new Map<string, AgentHealth>()
  private healthCheckInterval = 30000  // 30秒
  
  onModuleInit() {
    // 启动定期健康检查
    setInterval(() => {
      this.performHealthCheck()
    }, this.healthCheckInterval)
  }
  
  async performHealthCheck() {
    const connectedAgents = this.agentService.getConnectedAgents()
    
    for (const agent of connectedAgents) {
      try {
        const startTime = Date.now()
        
        // 发送ping消息
        await this.sendPing(agent.socketId)
        
        // 等待pong响应
        const latency = await this.waitForPong(agent.id, 5000)
        
        this.updateAgentHealth(agent.id, {
          status: 'healthy',
          latency,
          lastCheck: new Date()
        })
        
      } catch (error) {
        this.updateAgentHealth(agent.id, {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date()
        })
        
        // 标记Agent为离线
        await this.agentService.markAgentOffline(agent.id)
      }
    }
  }
  
  private async sendPing(socketId: string) {
    const socket = this.socketService.getSocket(socketId)
    if (socket) {
      socket.emit('ping', { timestamp: Date.now() })
    }
  }
  
  private waitForPong(agentId: string, timeout: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Ping timeout'))
      }, timeout)
      
      const socket = this.agentService.getAgentSocket(agentId)
      socket.once('pong', (data) => {
        clearTimeout(timer)
        const latency = Date.now() - data.timestamp
        resolve(latency)
      })
    })
  }
}

interface AgentHealth {
  status: 'healthy' | 'unhealthy' | 'unknown'
  latency?: number
  error?: string
  lastCheck: Date
}
```

---

## 6. 性能优化

### 6.1 消息队列和批处理

#### 6.1.1 消息批处理
```typescript
class MessageBatcher {
  private batches = new Map<string, Message[]>()
  private batchSize = 10
  private flushInterval = 100  // 100ms
  
  constructor(private emitCallback: (messages: Message[]) => void) {
    setInterval(() => this.flushAll(), this.flushInterval)
  }
  
  addMessage(channel: string, message: Message) {
    if (!this.batches.has(channel)) {
      this.batches.set(channel, [])
    }
    
    const batch = this.batches.get(channel)!
    batch.push(message)
    
    if (batch.length >= this.batchSize) {
      this.flushBatch(channel)
    }
  }
  
  private flushBatch(channel: string) {
    const batch = this.batches.get(channel)
    if (batch && batch.length > 0) {
      this.emitCallback(batch)
      this.batches.set(channel, [])
    }
  }
  
  private flushAll() {
    for (const channel of this.batches.keys()) {
      this.flushBatch(channel)
    }
  }
}
```

#### 6.1.2 消息优先级队列
```typescript
enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

class PriorityMessageQueue {
  private queues = new Map<MessagePriority, Message[]>()
  private processing = false
  
  enqueue(message: Message, priority: MessagePriority = MessagePriority.NORMAL) {
    if (!this.queues.has(priority)) {
      this.queues.set(priority, [])
    }
    
    this.queues.get(priority)!.push(message)
    this.processNext()
  }
  
  private async processNext() {
    if (this.processing) return
    
    this.processing = true
    
    try {
      // 按优先级处理消息
      for (const priority of [MessagePriority.CRITICAL, MessagePriority.HIGH, MessagePriority.NORMAL, MessagePriority.LOW]) {
        const queue = this.queues.get(priority)
        if (queue && queue.length > 0) {
          const message = queue.shift()!
          await this.processMessage(message)
          break
        }
      }
    } finally {
      this.processing = false
      
      // 如果还有消息，继续处理
      if (this.hasMessages()) {
        setImmediate(() => this.processNext())
      }
    }
  }
  
  private hasMessages(): boolean {
    for (const queue of this.queues.values()) {
      if (queue.length > 0) return true
    }
    return false
  }
}
```

### 6.2 连接池和负载均衡

#### 6.2.1 Agent负载均衡
```typescript
@Injectable()
export class AgentLoadBalancer {
  
  selectAgent(
    criteria: AgentSelectionCriteria
  ): ConnectedAgent | null {
    const availableAgents = this.getAvailableAgents(criteria)
    
    if (availableAgents.length === 0) {
      return null
    }
    
    switch (criteria.strategy) {
      case 'round-robin':
        return this.roundRobinSelect(availableAgents)
      
      case 'least-connections':
        return this.leastConnectionsSelect(availableAgents)
      
      case 'lowest-latency':
        return this.lowestLatencySelect(availableAgents)
      
      case 'resource-based':
        return this.resourceBasedSelect(availableAgents)
      
      default:
        return this.randomSelect(availableAgents)
    }
  }
  
  private getAvailableAgents(criteria: AgentSelectionCriteria): ConnectedAgent[] {
    return Array.from(this.connectedAgents.values()).filter(agent => {
      // 检查能力匹配
      if (criteria.requiredCapabilities) {
        const hasAllCapabilities = criteria.requiredCapabilities.every(
          cap => agent.capabilities.includes(cap)
        )
        if (!hasAllCapabilities) return false
      }
      
      // 检查负载状态
      const currentLoad = this.getAgentLoad(agent.id)
      if (currentLoad >= criteria.maxLoad) return false
      
      // 检查健康状态
      const health = this.agentHealthMap.get(agent.id)
      if (health?.status !== 'healthy') return false
      
      return true
    })
  }
  
  private leastConnectionsSelect(agents: ConnectedAgent[]): ConnectedAgent {
    return agents.reduce((selected, current) => {
      const selectedLoad = this.getAgentLoad(selected.id)
      const currentLoad = this.getAgentLoad(current.id)
      return currentLoad < selectedLoad ? current : selected
    })
  }
  
  private lowestLatencySelect(agents: ConnectedAgent[]): ConnectedAgent {
    return agents.reduce((selected, current) => {
      const selectedLatency = selected.latency || Infinity
      const currentLatency = current.latency || Infinity
      return currentLatency < selectedLatency ? current : selected
    })
  }
}

interface AgentSelectionCriteria {
  strategy: 'round-robin' | 'least-connections' | 'lowest-latency' | 'resource-based' | 'random'
  requiredCapabilities?: string[]
  maxLoad?: number
  preferredRegion?: string
}
```

#### 6.2.2 连接池管理
```typescript
class ConnectionPool {
  private pool = new Map<string, PooledConnection[]>()
  private maxPoolSize = 10
  private minPoolSize = 2
  
  async getConnection(agentId: string): Promise<PooledConnection> {
    if (!this.pool.has(agentId)) {
      this.pool.set(agentId, [])
    }
    
    const connections = this.pool.get(agentId)!
    
    // 查找可用连接
    const available = connections.find(conn => !conn.inUse && conn.isHealthy)
    if (available) {
      available.inUse = true
      return available
    }
    
    // 如果没有可用连接且未达到最大值，创建新连接
    if (connections.length < this.maxPoolSize) {
      const newConnection = await this.createConnection(agentId)
      connections.push(newConnection)
      newConnection.inUse = true
      return newConnection
    }
    
    // 等待连接释放
    return this.waitForConnection(agentId)
  }
  
  releaseConnection(connection: PooledConnection) {
    connection.inUse = false
    connection.lastUsed = Date.now()
  }
  
  private async createConnection(agentId: string): Promise<PooledConnection> {
    const socket = await this.connectToAgent(agentId)
    return {
      socket,
      agentId,
      inUse: false,
      isHealthy: true,
      createdAt: Date.now(),
      lastUsed: Date.now()
    }
  }
  
  // 定期清理空闲连接
  private startConnectionCleaner() {
    setInterval(() => {
      for (const [agentId, connections] of this.pool.entries()) {
        const now = Date.now()
        const activeConnections = connections.filter(conn => {
          const idle = now - conn.lastUsed
          const shouldKeep = conn.inUse || 
                           idle < 300000 || // 5分钟内使用过
                           connections.filter(c => !c.inUse).length <= this.minPoolSize
          
          if (!shouldKeep) {
            conn.socket.disconnect()
          }
          
          return shouldKeep
        })
        
        this.pool.set(agentId, activeConnections)
      }
    }, 60000) // 每分钟清理一次
  }
}

interface PooledConnection {
  socket: Socket
  agentId: string
  inUse: boolean
  isHealthy: boolean
  createdAt: number
  lastUsed: number
}
```

---

## 7. 安全性设计

### 7.1 认证和授权

#### 7.1.1 JWT Token验证
```typescript
// WebSocket认证中间件
@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}
  
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>()
    const token = this.extractToken(client)
    
    try {
      const payload = this.jwtService.verify(token)
      client.data.user = payload
      return true
    } catch (error) {
      client.emit('auth_error', { message: 'Invalid token' })
      client.disconnect()
      return false
    }
  }
  
  private extractToken(client: Socket): string {
    const auth = client.handshake.auth
    if (auth && auth.token) {
      return auth.token
    }
    
    const query = client.handshake.query
    if (query && query.token) {
      return query.token as string
    }
    
    throw new UnauthorizedException('No token provided')
  }
}

// 使用认证守卫
@UseGuards(WsAuthGuard)
@SubscribeMessage('sensitive:operation')
async handleSensitiveOperation(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: any
) {
  const user = client.data.user
  // 执行需要认证的操作
}
```

#### 7.1.2 Agent身份验证
```typescript
// Agent API Key验证
interface AgentCredentials {
  agentId: string
  apiKey: string
  signature: string
  timestamp: number
}

@Injectable()
export class AgentAuthService {
  
  async validateAgentCredentials(credentials: AgentCredentials): Promise<boolean> {
    // 验证时间戳（防重放攻击）
    const now = Date.now()
    if (Math.abs(now - credentials.timestamp) > 300000) { // 5分钟
      throw new UnauthorizedException('Request timestamp expired')
    }
    
    // 验证API Key
    const agent = await this.agentService.findByApiKey(credentials.apiKey)
    if (!agent) {
      throw new UnauthorizedException('Invalid API key')
    }
    
    // 验证签名
    const expectedSignature = this.generateSignature(
      credentials.agentId,
      credentials.apiKey,
      credentials.timestamp
    )
    
    if (credentials.signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid signature')
    }
    
    return true
  }
  
  private generateSignature(agentId: string, apiKey: string, timestamp: number): string {
    const secret = process.env.AGENT_SECRET_KEY
    const data = `${agentId}:${apiKey}:${timestamp}`
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex')
  }
}
```

### 7.2 数据安全

#### 7.2.1 消息加密
```typescript
class MessageEncryption {
  private static algorithm = 'aes-256-gcm'
  
  static encrypt(message: string, key: Buffer): EncryptedMessage {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(this.algorithm, key)
    cipher.setAAD(Buffer.from('ai-orchestra'))
    
    let encrypted = cipher.update(message, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    }
  }
  
  static decrypt(encryptedMessage: EncryptedMessage, key: Buffer): string {
    const decipher = crypto.createDecipher(this.algorithm, key)
    decipher.setAuthTag(Buffer.from(encryptedMessage.authTag, 'hex'))
    decipher.setAAD(Buffer.from('ai-orchestra'))
    
    let decrypted = decipher.update(encryptedMessage.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}

interface EncryptedMessage {
  encrypted: string
  iv: string
  authTag: string
}
```

#### 7.2.2 敏感数据脱敏
```typescript
class DataSanitizer {
  private static sensitiveFields = [
    'password', 'apiKey', 'token', 'secret', 'key',
    'creditCard', 'ssn', 'phone', 'email'
  ]
  
  static sanitizeForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForLogging(item))
    }
    
    const sanitized: any = {}
    
    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = this.maskValue(value as string)
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeForLogging(value)
      } else {
        sanitized[key] = value
      }
    }
    
    return sanitized
  }
  
  private static isSensitiveField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase()
    return this.sensitiveFields.some(sensitive => 
      lowerField.includes(sensitive)
    )
  }
  
  private static maskValue(value: string): string {
    if (!value || value.length <= 4) {
      return '***'
    }
    
    const visibleChars = 2
    const masked = '*'.repeat(value.length - visibleChars * 2)
    return value.slice(0, visibleChars) + masked + value.slice(-visibleChars)
  }
}
```

---

## 8. 监控和日志

### 8.1 性能监控

#### 8.1.1 通信延迟监控
```typescript
@Injectable()
export class CommunicationMetrics {
  private metrics = new Map<string, PerformanceMetric[]>()
  
  recordLatency(source: string, target: string, latency: number) {
    const key = `${source}->${target}`
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      latency,
      source,
      target
    }
    
    const metrics = this.metrics.get(key)!
    metrics.push(metric)
    
    // 保留最近1000条记录
    if (metrics.length > 1000) {
      metrics.shift()
    }
  }
  
  getLatencyStats(source: string, target: string): LatencyStats {
    const key = `${source}->${target}`
    const metrics = this.metrics.get(key) || []
    
    if (metrics.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 }
    }
    
    const latencies = metrics.map(m => m.latency)
    const sum = latencies.reduce((a, b) => a + b, 0)
    
    return {
      avg: sum / latencies.length,
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      count: latencies.length,
      p95: this.percentile(latencies, 95),
      p99: this.percentile(latencies, 99)
    }
  }
  
  private percentile(values: number[], percent: number): number {
    const sorted = values.sort((a, b) => a - b)
    const index = Math.ceil((percent / 100) * sorted.length) - 1
    return sorted[index]
  }
}

interface PerformanceMetric {
  timestamp: number
  latency: number
  source: string
  target: string
}

interface LatencyStats {
  avg: number
  min: number
  max: number
  count: number
  p95?: number
  p99?: number
}
```

#### 8.1.2 消息统计
```typescript
@Injectable()
export class MessageStatistics {
  private stats = {
    totalMessages: 0,
    messagesByType: new Map<string, number>(),
    messagesByHour: new Map<number, number>(),
    errorCount: 0,
    averageSize: 0,
    totalSize: 0
  }
  
  recordMessage(type: string, size: number) {
    this.stats.totalMessages++
    this.stats.totalSize += size
    this.stats.averageSize = this.stats.totalSize / this.stats.totalMessages
    
    // 按类型统计
    const currentCount = this.stats.messagesByType.get(type) || 0
    this.stats.messagesByType.set(type, currentCount + 1)
    
    // 按小时统计
    const hour = Math.floor(Date.now() / (1000 * 60 * 60))
    const hourlyCount = this.stats.messagesByHour.get(hour) || 0
    this.stats.messagesByHour.set(hour, hourlyCount + 1)
  }
  
  recordError() {
    this.stats.errorCount++
  }
  
  getStatistics(): MessageStatistics {
    return {
      ...this.stats,
      errorRate: this.stats.errorCount / this.stats.totalMessages,
      messagesPerHour: this.getMessagesPerHour()
    }
  }
  
  private getMessagesPerHour(): number {
    const currentHour = Math.floor(Date.now() / (1000 * 60 * 60))
    return this.stats.messagesByHour.get(currentHour) || 0
  }
}
```

### 8.2 结构化日志

#### 8.2.1 日志格式设计
```typescript
interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context: string
  metadata?: Record<string, any>
  traceId?: string
  userId?: string
  sessionId?: string
  agentId?: string
}

class StructuredLogger {
  private logLevel: string = process.env.LOG_LEVEL || 'info'
  
  private createLogEntry(
    level: string,
    message: string,
    context: string,
    metadata?: any
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: level as any,
      message,
      context,
      metadata: DataSanitizer.sanitizeForLogging(metadata),
      traceId: this.getCurrentTraceId(),
      userId: this.getCurrentUserId(),
      sessionId: this.getCurrentSessionId()
    }
  }
  
  logWebSocketEvent(event: string, data: any, socketId: string) {
    const entry = this.createLogEntry('info', `WebSocket event: ${event}`, 'WebSocket', {
      event,
      socketId,
      dataSize: JSON.stringify(data).length,
      timestamp: Date.now()
    })
    
    console.log(JSON.stringify(entry))
  }
  
  logAgentCommunication(agentId: string, action: string, data: any) {
    const entry = this.createLogEntry('info', `Agent communication: ${action}`, 'Agent', {
      agentId,
      action,
      dataType: typeof data,
      dataSize: JSON.stringify(data).length
    })
    
    console.log(JSON.stringify(entry))
  }
  
  logError(error: Error, context: string, metadata?: any) {
    const entry = this.createLogEntry('error', error.message, context, {
      ...metadata,
      stack: error.stack,
      errorType: error.constructor.name
    })
    
    console.error(JSON.stringify(entry))
  }
}
```

---

## 9. 部署和运维

### 9.1 环境配置

#### 9.1.1 开发环境配置
```typescript
// config/development.ts
export const developmentConfig = {
  websocket: {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
  },
  
  agent: {
    heartbeatInterval: 10000,    // 10秒
    connectionTimeout: 30000,    // 30秒
    maxReconnectAttempts: 10,
    reconnectDelay: 1000
  },
  
  performance: {
    messageQueueSize: 1000,
    batchSize: 10,
    flushInterval: 100,
    compressionThreshold: 1024
  },
  
  logging: {
    level: 'debug',
    enableConsole: true,
    enableFile: true,
    enableMetrics: true
  }
}
```

#### 9.1.2 生产环境配置
```typescript
// config/production.ts
export const productionConfig = {
  websocket: {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
      credentials: true
    },
    transports: ['websocket'],
    allowEIO3: false,
    pingTimeout: 60000,
    pingInterval: 25000
  },
  
  agent: {
    heartbeatInterval: 30000,    // 30秒
    connectionTimeout: 60000,    // 60秒
    maxReconnectAttempts: 5,
    reconnectDelay: 5000
  },
  
  performance: {
    messageQueueSize: 10000,
    batchSize: 50,
    flushInterval: 50,
    compressionThreshold: 512
  },
  
  security: {
    enableEncryption: true,
    requireAgentAuth: true,
    rateLimiting: {
      windowMs: 60000,     // 1分钟
      maxRequests: 100     // 最大100个请求
    }
  }
}
```

### 9.2 监控和告警

#### 9.2.1 健康检查端点
```typescript
@Controller('health')
export class HealthController {
  
  constructor(
    private agentService: AgentService,
    private communicationMetrics: CommunicationMetrics
  ) {}
  
  @Get()
  async getHealth(): Promise<HealthStatus> {
    const connectedAgents = this.agentService.getConnectedAgents()
    const agentHealth = await this.checkAgentHealth(connectedAgents)
    const systemHealth = await this.checkSystemHealth()
    
    return {
      status: this.calculateOverallStatus(agentHealth, systemHealth),
      timestamp: new Date().toISOString(),
      agents: {
        total: connectedAgents.length,
        healthy: agentHealth.filter(h => h.status === 'healthy').length,
        details: agentHealth
      },
      system: systemHealth,
      metrics: this.communicationMetrics.getSummary()
    }
  }
  
  @Get('agents')
  async getAgentHealth(): Promise<AgentHealthSummary> {
    const agents = this.agentService.getConnectedAgents()
    const healthChecks = await Promise.all(
      agents.map(agent => this.checkSingleAgent(agent))
    )
    
    return {
      totalAgents: agents.length,
      healthyAgents: healthChecks.filter(h => h.healthy).length,
      agents: healthChecks
    }
  }
  
  private async checkSingleAgent(agent: ConnectedAgent): Promise<AgentHealthCheck> {
    try {
      const startTime = Date.now()
      await this.agentService.pingAgent(agent.id)
      const latency = Date.now() - startTime
      
      return {
        agentId: agent.id,
        healthy: true,
        latency,
        lastCheck: new Date()
      }
    } catch (error) {
      return {
        agentId: agent.id,
        healthy: false,
        error: error.message,
        lastCheck: new Date()
      }
    }
  }
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  agents: {
    total: number
    healthy: number
    details: any[]
  }
  system: any
  metrics: any
}
```

#### 9.2.2 告警规则
```typescript
@Injectable()
export class AlertingService {
  private alertRules: AlertRule[] = [
    {
      name: 'high_latency',
      condition: (metrics) => metrics.averageLatency > 5000, // 5秒
      severity: 'warning',
      message: 'Communication latency is high'
    },
    {
      name: 'agent_offline',
      condition: (metrics) => metrics.offlineAgents > 0,
      severity: 'error',
      message: 'One or more agents are offline'
    },
    {
      name: 'high_error_rate',
      condition: (metrics) => metrics.errorRate > 0.1, // 10%
      severity: 'error',
      message: 'Error rate is too high'
    }
  ]
  
  @Cron('*/1 * * * *') // 每分钟检查
  async checkAlerts() {
    const metrics = await this.gatherMetrics()
    
    for (const rule of this.alertRules) {
      if (rule.condition(metrics)) {
        await this.triggerAlert({
          rule: rule.name,
          severity: rule.severity,
          message: rule.message,
          timestamp: new Date(),
          metrics
        })
      }
    }
  }
  
  private async triggerAlert(alert: Alert) {
    console.error('ALERT:', alert)
    
    // 发送到监控系统
    if (process.env.WEBHOOK_URL) {
      await this.sendWebhook(alert)
    }
    
    // 发送邮件（高严重度）
    if (alert.severity === 'error') {
      await this.sendEmailAlert(alert)
    }
  }
}

interface AlertRule {
  name: string
  condition: (metrics: any) => boolean
  severity: 'info' | 'warning' | 'error'
  message: string
}
```

---

## 10. 总结

本通信层架构设计提供了完整的 Web -> Server -> Agent 通信解决方案：

### 10.1 核心特性
- **多层次通信**: HTTP API + WebSocket 实时通信
- **可靠性保障**: 自动重连、错误恢复、消息去重
- **性能优化**: 消息批处理、连接池、负载均衡
- **安全性**: JWT认证、消息加密、API Key验证
- **可观测性**: 结构化日志、性能监控、健康检查

### 10.2 扩展性设计
- **水平扩展**: 支持多实例部署
- **插件化**: 可扩展的消息处理器
- **协议版本化**: 向后兼容的协议演进
- **多Agent支持**: 分布式Agent管理

### 10.3 运维友好
- **配置驱动**: 环境隔离配置
- **监控完善**: 多维度性能指标
- **告警及时**: 智能故障检测
- **日志结构化**: 便于问题排查

这套通信架构可以支撑大规模的AI Agent调度和管理场景，为AI Orchestra系统提供稳定可靠的通信基础设施。