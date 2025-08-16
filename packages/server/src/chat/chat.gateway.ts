import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Inject, forwardRef } from '@nestjs/common'
import { AgentService } from '../services/agent.service'
// import { WorkerService } from '../services/worker.service' // 已移除
import { TaskService } from '../services/task.service'
import { SessionService } from '../services/session.service'
import { RepositoryService } from '../services/repository.service'
// import { ClaudeService } from '../services/claude.service' // 已移除
import { OnEvent } from '@nestjs/event-emitter'

interface ConnectedAgent {
  id: string
  name: string
  socketId: string
  connectedAt: Date
  agentId: string // Database ID
  latency?: number // Agent延迟（毫秒）
}

interface ChatMessage {
  from: 'web' | 'agent'
  agentId?: string
  content: string
  timestamp: Date
}

@WebSocketGateway({
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? ['http://localhost:5173', 'http://localhost:3000']
        : '*',
    credentials: true
  }
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private connectedAgents = new Map<string, ConnectedAgent>()
  private recentMessages = new Map<string, number>() // 用于消息去重
  private sessionClients = new Map<string, Set<string>>() // sessionId -> Set<socketId>
  private historyRequestMap = new Map<string, string>() // requestId -> clientId
  
  // WebSocket 控制器引用，用于向前端发送事件
  private webSocketController: any = null

  constructor(
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService,
    // @Inject(forwardRef(() => WorkerService))
    // private readonly workerService: WorkerService,
    @Inject(forwardRef(() => TaskService))
    private readonly taskService: TaskService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    @Inject(forwardRef(() => RepositoryService))
    private readonly repositoryService: RepositoryService,
    // private readonly claudeService: ClaudeService
  ) {
    // Services will be used for agent/worker management
  }

  /**
   * 设置 WebSocket 控制器引用
   */
  setWebSocketController(controller: any) {
    this.webSocketController = controller
  }

  /**
   * 向 WebSocket 客户端广播事件
   */
  private broadcastToWebClients(eventType: string, payload: any) {
    if (this.webSocketController) {
      this.webSocketController.broadcastToWebClients(eventType, payload)
    }
  }

  /**
   * 处理来自 WebSocket 前端的消息
   */
  public handleWebSocketMessage(eventType: string, payload: any) {
    switch (eventType) {
      case 'chat:message':
        this.handleWebChatMessage(payload)
        break
      case 'worker:start':
        this.handleWebWorkerStart(payload)
        break
      case 'worker:input':
        this.handleWebWorkerInput(payload)
        break
      case 'worker:recreate_request':
        this.handleWebWorkerRecreateRequest(payload)
        break
      default:
        console.log(`未处理的WebSocket事件类型: ${eventType}`)
    }
  }

  /**
   * 处理来自Web的聊天消息
   */
  private handleWebChatMessage(data: { to?: string; content: string }) {
    const message: ChatMessage = {
      from: 'web',
      content: data.content,
      timestamp: new Date()
    }

    if (data.to) {
      // Send to specific agent
      this.server.to(`agent:${data.to}`).emit('chat:message', {
        ...message,
        agentId: data.to
      })
    } else {
      // Broadcast to all agents
      for (const agent of this.connectedAgents.values()) {
        this.server.to(agent.socketId).emit('chat:message', message)
      }
    }
  }

  /**
   * 处理来自Web的Worker启动请求
   */
  private handleWebWorkerStart(data: any) {
    const agent = this.connectedAgents.get(data.agentId)
    if (agent) {
      this.server.to(agent.socketId).emit('worker:start', data)
    }
  }

  /**
   * 处理来自Web的Worker输入
   */
  private handleWebWorkerInput(data: any) {
    const agent = this.connectedAgents.get(data.agentId)
    if (agent) {
      this.server.to(agent.socketId).emit('worker:input', data)
    }
  }

  /**
   * 处理来自Web的Worker重新创建请求
   */
  private handleWebWorkerRecreateRequest(data: any) {
    const agent = this.connectedAgents.get(data.agentId)
    if (agent) {
      this.server.to(agent.socketId).emit('worker:recreate', {
        taskId: data.taskId,
        sessionId: data.sessionId,
        model: 'claude-sonnet-4-20250514'
      })
    }
  }

  handleConnection(client: Socket): void {
    console.log(`Client connected: ${client.id}`)
    // 客户端将通过 session:join 消息加入特定会话
  }

  async handleDisconnect(client: Socket): Promise<void> {
    console.log(`Client disconnected: ${client.id}`)

    // 从所有会话中移除该客户端
    for (const [sessionId, clients] of this.sessionClients.entries()) {
      if (clients.has(client.id)) {
        clients.delete(client.id)
        if (clients.size === 0) {
          this.sessionClients.delete(sessionId)
        }
        console.log(`Removed client ${client.id} from session ${sessionId}`)
      }
    }

    // Remove agent if it was registered and update database status
    for (const [agentId, agent] of this.connectedAgents.entries()) {
      if (agent.socketId === client.id) {
        this.connectedAgents.delete(agentId)

        // Update database status to offline
        try {
          await this.agentService.updateAgentStatus(agentId, {
            status: 'offline'
          })
        } catch (error) {
          console.error(`Failed to update agent status to offline: ${agentId}`, error)
        }

        this.server.emit('agent:disconnected', { agentId })
        
        // 同时通知 WebSocket 客户端
        this.broadcastToWebClients('agent:disconnected', { agentId })
        console.log(`Agent ${agent.name} (${agentId}) disconnected`)
        break
      }
    }
  }

  /**
   * 根据数据库ID查找连接的Agent
   */
  private findAgentByDatabaseId(agentId: string): ConnectedAgent | undefined {
    return this.connectedAgents.get(agentId)
  }

  @SubscribeMessage('agent:register')
  handleAgentRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { agentId: string; name: string }
  ): void {
    const agent: ConnectedAgent = {
      id: data.agentId,
      name: data.name,
      socketId: client.id,
      connectedAt: new Date(),
      agentId: data.agentId
    }

    this.connectedAgents.set(data.agentId, agent)

    // Join agent-specific room
    client.join(`agent:${data.agentId}`)

    // Notify all clients about new agent
    this.server.emit('agent:connected', {
      agentId: agent.id,
      name: agent.name,
      connectedAt: agent.connectedAt
    })

    // 同时通知 WebSocket 客户端
    this.broadcastToWebClients('agent:connected', {
      agentId: agent.id,
      name: agent.name,
      connectedAt: agent.connectedAt
    })

    console.log(`Agent registered: ${data.agentId} (${data.name})`)
  }

  @SubscribeMessage('agent:authenticate')
  async handleAgentAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { name: string; secretKey: string }
  ): Promise<void> {
    try {
      const agent = await this.agentService.validateAgentKey(data.secretKey)

      if (!agent || agent.name !== data.name) {
        const reason = !agent ? 'Invalid secret key' : 'Agent name mismatch'
        client.emit('agent:auth_failed', { message: reason })
        console.log(`Authentication failed for ${data.name}: ${reason}`)
        return
      }

      await this.agentService.updateAgentStatus(agent.id, {
        status: 'connected',
        lastSeenAt: new Date(),
        ipAddress: client.handshake.address
      })

      const connectedAgent: ConnectedAgent = {
        id: agent.id,
        name: agent.name,
        socketId: client.id,
        connectedAt: new Date(),
        agentId: agent.id
      }

      this.connectedAgents.set(agent.id, connectedAgent)
      client.join(`agent:${agent.id}`)

      client.emit('agent:authenticated', {
        agentId: agent.id,
        name: agent.name,
        status: 'connected',
        hostname: agent.hostname
      })

      this.server.emit('agent:connected', {
        agentId: agent.id,
        name: agent.name,
        connectedAt: connectedAgent.connectedAt
      })

      // 同时通知 WebSocket 客户端
      this.broadcastToWebClients('agent:connected', {
        agentId: agent.id,
        name: agent.name,
        connectedAt: connectedAgent.connectedAt
      })

      console.log(`Agent authenticated: ${agent.name} (${agent.id})`)
    } catch (error) {
      console.error('Authentication error:', error)
      client.emit('agent:auth_failed', { message: 'Authentication error' })
    }
  }

  @SubscribeMessage('agent:list')
  handleAgentList(): { agents: Array<Omit<ConnectedAgent, 'socketId'>> } {
    const agentList = Array.from(this.connectedAgents.values()).map(
      ({ socketId, ...agent }) => agent
    )
    return { agents: agentList }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() timestamp: number): void {
    // 立即返回pong响应
    client.emit('pong', timestamp)
  }

  @SubscribeMessage('agent:latency')
  handleAgentLatency(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { agentId: string; latency: number }
  ): void {
    // 更新Agent的延迟信息
    const agent = this.connectedAgents.get(data.agentId)
    if (agent) {
      agent.latency = data.latency

      // 广播延迟信息给所有客户端
      this.server.emit('agent:latency_update', {
        agentId: data.agentId,
        latency: data.latency
      })
    }
  }

  @SubscribeMessage('chat:message')
  handleChatMessage(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { to?: string; content: string }
  ): void {
    const message: ChatMessage = {
      from: 'web',
      content: data.content,
      timestamp: new Date()
    }

    if (data.to) {
      // Send to specific agent
      this.server.to(`agent:${data.to}`).emit('chat:message', {
        ...message,
        agentId: data.to
      })
    } else {
      // Broadcast to all agents
      for (const agent of this.connectedAgents.values()) {
        this.server.to(agent.socketId).emit('chat:message', message)
      }
    }
  }

  @SubscribeMessage('chat:reply')
  handleChatReply(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { agentId: string; content: string }
  ): void {
    console.log(`Received reply from agent ${data.agentId}: ${data.content}`)

    const message: ChatMessage = {
      from: 'agent',
      agentId: data.agentId,
      content: data.content,
      timestamp: new Date()
    }

    // Broadcast agent's reply to all web clients
    this.server.emit('chat:reply', {
      ...message,
      timestamp: message.timestamp.toISOString()
    })

    // 同时通知 WebSocket 客户端
    this.broadcastToWebClients('chat:reply', {
      ...message,
      timestamp: message.timestamp.toISOString()
    })
    
    console.log('Broadcasted reply to all web clients')
  }

  @SubscribeMessage('worker:start')
  async handleWorkerStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      agentId: string
      taskId: string
      workingDirectory?: string
      initialPrompt?: string
      sessionId?: string
      claudeSessionId?: string
      repositoryId?: string
      repositoryName?: string
      model?: string // 添加model参数
    }
  ): Promise<void> {
    console.log(`Starting Worker for agent ${data.agentId}, task ${data.taskId}`)
    console.log(`sessionId: ${data.sessionId}, claudeSessionId: ${data.claudeSessionId}`)
    console.log(`repositoryId: ${data.repositoryId}, repositoryName: ${data.repositoryName}`)

    // 如果有repositoryId，从数据库获取仓库信息
    let repository = null
    if (data.repositoryId) {
      try {
        repository = await this.repositoryService.findOneWithCredentials(data.repositoryId)
        console.log(`Found repository: ${repository?.name}`)
      } catch (error) {
        console.error('Failed to get repository:', error)
      }
    }

    // 获取 Claude 配置
    let claudeConfig = null
    try {
      // claudeConfig = await this.claudeService.getConfig() // Claude已移除
    } catch (error) {
      console.error('Failed to get Claude config:', error)
    }

    // Forward to specific agent
    const agent = this.connectedAgents.get(data.agentId)
    if (agent) {
      this.server.to(agent.socketId).emit('worker:start', {
        taskId: data.taskId,
        workingDirectory: data.workingDirectory,
        initialPrompt: data.initialPrompt,
        sessionId: data.sessionId,
        claudeSessionId: data.claudeSessionId,
        model: data.model, // 传递model参数到Agent
        repository: repository
          ? {
              id: repository.id,
              name: repository.name,
              url: repository.url,
              branch: repository.branch,
              credentials: repository.credentials,
              settings: repository.settings
            }
          : null,
        claudeConfig: claudeConfig
      })
    }
  }

  @SubscribeMessage('worker:recreate_request')
  async handleWorkerRecreateRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      taskId: string
      sessionId: string
      agentId: string
    }
  ): Promise<void> {
    console.log(`Received worker recreate request for session ${data.sessionId}`)

    // 向Worker发送重新创建请求，包含必要的配置信息
    const agent = this.connectedAgents.get(data.agentId)
    if (agent) {
      this.server.to(agent.socketId).emit('worker:recreate', {
        taskId: data.taskId,
        sessionId: data.sessionId,
        model: 'claude-sonnet-4-20250514'
      })
    }
  }

  @SubscribeMessage('worker:input')
  async handleWorkerInput(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      agentId: string
      taskId: string
      input: string
      sessionId?: string
      model?: string
      mode?: 'ask' | 'auto' | 'yolo' | 'plan'
    }
  ): Promise<void> {
    console.log(`Sending input to Worker: ${data.input}`)
    console.log(`Mode: ${data.mode}, Model: ${data.model}`)

    // 不再从数据库获取历史，直接传递 sessionId 给 Agent

    // Forward to specific agent
    const agent = this.connectedAgents.get(data.agentId)
    if (agent) {
      this.server.to(agent.socketId).emit('worker:input', {
        taskId: data.taskId,
        input: data.input,
        sessionId: data.sessionId,
        model: data.model,
        mode: data.mode
        // 不再传递 conversationHistory，Agent 会使用 --resume
      })
    }
  }

  @SubscribeMessage('worker:output')
  handleWorkerOutput(
    @ConnectedSocket() _client: Socket,
    @MessageBody()
    data: { taskId: string; output: string; outputType: 'stdout' | 'stderr'; sessionId?: string }
  ): void {
    // 只发送给属于该会话的客户端
    if (data.sessionId) {
      const roomName = `session:${data.sessionId}`
      this.server.to(roomName).emit('worker:output', data)
    } else {
      // 兼容性：广播给所有客户端
      this.server.emit('worker:output', data)
    }
  }

  @SubscribeMessage('worker:tool-use')
  handleWorkerToolUse(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { taskId: string; toolUse: any; sessionId?: string; agentId?: string }
  ): void {
    // 只发送给属于该会话的客户端
    if (data.sessionId) {
      const roomName = `session:${data.sessionId}`
      this.server.to(roomName).emit('worker:tool-use', data)
    } else {
      // 兼容性：广播给所有客户端
      this.server.emit('worker:tool-use', data)
    }
  }

  @SubscribeMessage('worker:system-info')
  handleWorkerSystemInfo(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { taskId: string; info: any; sessionId?: string; agentId?: string }
  ): void {
    // 只发送给属于该会话的客户端
    if (data.sessionId) {
      const roomName = `session:${data.sessionId}`
      this.server.to(roomName).emit('worker:system-info', data)
    } else {
      // 兼容性：广播给所有客户端
      this.server.emit('worker:system-info', data)
    }
  }

  @SubscribeMessage('worker:progress')
  handleWorkerProgress(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { taskId: string; progress: any; sessionId?: string; agentId?: string }
  ): void {
    // 只发送给属于该会话的客户端
    if (data.sessionId) {
      const roomName = `session:${data.sessionId}`
      this.server.to(roomName).emit('worker:progress', data)
    } else {
      // 兼容性：广播给所有客户端
      this.server.emit('worker:progress', data)
    }
  }

  @SubscribeMessage('worker:status')
  handleWorkerStatus(
    @ConnectedSocket() _client: Socket,
    @MessageBody()
    data: {
      taskId: string
      status: string
      error?: string
      exitCode?: number
      sessionId?: string
      agentId?: string
    }
  ): void {
    console.log(`Worker status for task ${data.taskId}: ${data.status}`)

    // 只发送给属于该会话的客户端
    if (data.sessionId) {
      const roomName = `session:${data.sessionId}`
      this.server.to(roomName).emit('worker:status', data)
      
      // 同时发送给 WebSocket 客户端
      this.broadcastToWebClients('worker:status', data)
    } else {
      // 兼容性：如果没有sessionId，广播给所有客户端
      this.server.emit('worker:status', data)
      
      // 同时发送给 WebSocket 客户端
      this.broadcastToWebClients('worker:status', data)
    }
  }

  @SubscribeMessage('session:join')
  handleSessionJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string }
  ): void {
    if (!data.sessionId) return

    // 将客户端加入会话专用房间
    const roomName = `session:${data.sessionId}`
    client.join(roomName)

    // 记录客户端与会话的关联
    if (!this.sessionClients.has(data.sessionId)) {
      this.sessionClients.set(data.sessionId, new Set())
    }
    this.sessionClients.get(data.sessionId)!.add(client.id)

    console.log(`Client ${client.id} joined session ${data.sessionId}`)
  }

  @SubscribeMessage('session:leave')
  handleSessionLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string }
  ): void {
    if (!data.sessionId) return

    // 将客户端从会话房间移除
    const roomName = `session:${data.sessionId}`
    client.leave(roomName)

    // 更新记录
    const clients = this.sessionClients.get(data.sessionId)
    if (clients) {
      clients.delete(client.id)
      if (clients.size === 0) {
        this.sessionClients.delete(data.sessionId)
      }
    }

    console.log(`Client ${client.id} left session ${data.sessionId}`)
  }

  @SubscribeMessage('worker:message')
  handleWorkerMessage(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { taskId: string; message: any; agentId?: string; sessionId?: string }
  ): void {
    console.log(`Worker message for task ${data.taskId}:`, data.message.type)

    // 优化消息去重机制 - 基于内容哈希 + 短时间窗口
    if (data.message.type === 'assistant' && data.message.message?.content) {
      // 提取消息内容
      const textContents = []
      for (const contentItem of data.message.message.content) {
        if (contentItem.type === 'text' && contentItem.text?.trim()) {
          textContents.push(contentItem.text)
        }
      }

      if (textContents.length > 0) {
        const messageContent = textContents.join('')
        const now = Date.now()

        // 初始化去重缓存
        if (!this.recentMessages) {
          this.recentMessages = new Map()
        }

        // 创建消息键：任务ID + 内容哈希
        const messageKey = `${data.taskId}:${Buffer.from(messageContent).toString('base64').substring(0, 32)}`
        const lastMessageTime = this.recentMessages.get(messageKey)

        // 只阻止15秒内的相同消息（防止真正的重复发送）
        const duplicateThreshold = 15 * 1000 // 15秒
        if (lastMessageTime && now - lastMessageTime < duplicateThreshold) {
          console.log(
            `Duplicate assistant message blocked (within ${duplicateThreshold / 1000}s) for task ${data.taskId}`
          )
          return
        }

        // 记录当前消息时间
        this.recentMessages.set(messageKey, now)

        // 清理过期条目（超过5分钟的记录）
        const cleanupThreshold = 5 * 60 * 1000 // 5分钟
        for (const [key, timestamp] of this.recentMessages.entries()) {
          if (now - timestamp > cleanupThreshold) {
            this.recentMessages.delete(key)
          }
        }

        console.log(`Assistant message forwarded for task ${data.taskId}`)
      }
    }

    // 只发送给属于该会话的客户端
    if (data.sessionId) {
      const roomName = `session:${data.sessionId}`
      this.server.to(roomName).emit('worker:message', data)
      console.log(`Sent worker message to session ${data.sessionId}`)
      
      // 同时发送给 WebSocket 客户端
      this.broadcastToWebClients('worker:message', data)
    } else {
      // 如果没有sessionId，回退到原有的广播行为（兼容性）
      console.warn('Worker message without sessionId, broadcasting to all')
      this.server.emit('worker:message', data)
      
      // 同时发送给 WebSocket 客户端
      this.broadcastToWebClients('worker:message', data)
    }
  }

  @SubscribeMessage('worker:thinking')
  handleWorkerThinking(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { taskId: string; thinking: any; agentId?: string; sessionId?: string }
  ): void {
    console.log(`Worker thinking for task ${data.taskId}`)

    // 只发送给属于该会话的客户端
    if (data.sessionId) {
      const roomName = `session:${data.sessionId}`
      this.server.to(roomName).emit('worker:thinking', data)
      console.log(`Sent worker thinking to session ${data.sessionId}`)
    } else {
      // 如果没有sessionId，回退到原有的广播行为（兼容性）
      console.warn('Worker thinking without sessionId, broadcasting to all')
      this.server.emit('worker:thinking', data)
    }
  }

  // Worker Registration and Management
  @SubscribeMessage('worker:register')
  async handleWorkerRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      workerId: string
      name: string
      agentId: string
      capabilities?: string[]
      status?: string
      currentTask?: string
    }
  ): Promise<void> {
    try {
      // 转换 capabilities 格式
      const registerData = {
        workerId: data.workerId,
        name: data.name,
        agentId: data.agentId,
        capabilities: data.capabilities
          ? {
              supportedTools: data.capabilities,
              maxConcurrentTasks: 1,
              resourceLimits: {
                maxMemory: 4096,
                maxCpu: 100,
                maxDiskIO: 1000
              }
            }
          : undefined
      }

      // const worker = await this.workerService.registerWorker(registerData) // Worker已移除
      const worker = null

      // Store worker socket mapping
      client.data.workerId = worker.id
      client.join(`worker:${worker.id}`)

      client.emit('worker:registered', {
        workerId: worker.id,
        status: 'success'
      })

      // Notify all clients about new worker
      this.server.emit('worker:connected', {
        workerId: worker.id,
        name: worker.name,
        agentId: worker.agentId,
        status: worker.status,
        capabilities: worker.capabilities
      })

      console.log(`Worker registered: ${worker.name} (${worker.id})`)
    } catch (error) {
      console.error('Worker registration error:', error)
      client.emit('worker:error', {
        message: 'Failed to register worker',
        error: error.message
      })
    }
  }

  @SubscribeMessage('worker:permission')
  handleWorkerPermission(
    @ConnectedSocket() _client: Socket,
    @MessageBody()
    data: {
      agentId: string
      taskId: string
      sessionId: string
      permissionId: string
      action: 'approve' | 'deny'
      modifiedInput?: any
      reason?: string
    }
  ): void {
    console.log(`Permission ${data.action} for ${data.permissionId} from ${data.agentId}`)

    // 转发权限响应给对应的Agent
    const agent = this.findAgentByDatabaseId(data.agentId)
    if (agent) {
      this.server.to(agent.socketId).emit('worker:permission', data)
    } else {
      console.error(`Agent not found for permission response: ${data.agentId}`)
    }
  }

  @SubscribeMessage('worker:heartbeat')
  async handleWorkerHeartbeat(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: any
  ): Promise<void> {
    try {
      // await this.workerService.handleHeartbeat(data) // Worker已移除
    } catch (error) {
      console.error('Worker heartbeat error:', error)
    }
  }

  @SubscribeMessage('worker:task:complete')
  async handleWorkerTaskComplete(
    @ConnectedSocket() _client: Socket,
    @MessageBody()
    data: {
      taskId: string
      workerId: string
      result: any
      executionTime: number
    }
  ): Promise<void> {
    try {
      await this.taskService.completeTask(data.taskId, data.result, data.executionTime)

      // Notify all clients
      this.server.emit('task:completed', {
        taskId: data.taskId,
        workerId: data.workerId,
        result: data.result
      })
    } catch (error) {
      console.error('Task completion error:', error)
    }
  }

  @SubscribeMessage('worker:task:failed')
  async handleWorkerTaskFailed(
    @ConnectedSocket() _client: Socket,
    @MessageBody()
    data: {
      taskId: string
      workerId: string
      error: string
      executionTime?: number
    }
  ): Promise<void> {
    try {
      await this.taskService.failTask(data.taskId, data.error, data.executionTime)

      // Notify all clients
      this.server.emit('task:failed', {
        taskId: data.taskId,
        workerId: data.workerId,
        error: data.error
      })
    } catch (error) {
      console.error('Task failure error:', error)
    }
  }

  // Task Events
  @OnEvent('task.created')
  handleTaskCreated(task: any): void {
    this.server.emit('task:created', task)
  }

  @OnEvent('task.assigned')
  async handleTaskAssigned(data: { task: any; workerId: string; agentId: string }): Promise<void> {
    // Get repository configuration if task has repositoryId
    let repository = null
    if (data.task.repositoryId) {
      try {
        repository = await this.repositoryService.findOneWithCredentials(data.task.repositoryId)
      } catch (error) {
        console.error('Failed to get repository:', error)
      }
    }

    // Get Claude configuration
    let claudeConfig = null
    try {
      // claudeConfig = await this.claudeService.getConfig() // Claude已移除
    } catch (error) {
      console.error('Failed to get Claude config:', error)
    }

    // Send task to specific worker
    this.server.to(`worker:${data.workerId}`).emit('task:assign', {
      taskId: data.task.id,
      repository: repository
        ? {
            id: repository.id,
            name: repository.name,
            url: repository.url,
            branch: repository.branch,
            credentials: repository.credentials,
            settings: repository.settings
          }
        : null,
      claudeConfig: claudeConfig
        ? {
            baseUrl: claudeConfig.baseUrl,
            authToken: claudeConfig.authToken,
            model: claudeConfig.model,
            maxTokens: claudeConfig.maxTokens,
            temperature: claudeConfig.temperature,
            timeout: claudeConfig.timeout
          }
        : null,
      command: data.task.command || 'claude',
      args: data.task.args || [],
      env: data.task.env || {}
    })

    // Notify all clients
    this.server.emit('task:assigned', data)
  }

  @OnEvent('task.started')
  handleTaskStarted(task: any): void {
    this.server.emit('task:started', task)
  }

  @OnEvent('task.completed')
  handleTaskCompleted(data: any): void {
    this.server.emit('task:completed', data)
  }

  @OnEvent('task.failed')
  handleTaskFailed(data: any): void {
    this.server.emit('task:failed', data)
  }

  @OnEvent('repository.prepare')
  handleRepositoryPrepare(data: { sessionId: string; repository: any }): void {
    // 广播给所有连接的 Agent，让它们预先克隆仓库
    this.server.emit('repository:prepare', data)
    console.log(`Broadcasting repository prepare for session ${data.sessionId}`)
  }

  @SubscribeMessage('repository:ready')
  handleRepositoryReady(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: string
      agentId: string
      repositoryId: string
      cachePath: string
    }
  ): void {
    console.log(`Repository ready on agent ${data.agentId} for session ${data.sessionId}`)
    // 可以记录哪些 Agent 已经准备好了仓库，用于任务分配时的优化
    this.server.emit('repository:status', {
      ...data,
      status: 'ready'
    })
  }

  @SubscribeMessage('repository:prepare_failed')
  handleRepositoryPrepareFailed(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: string
      agentId: string
      repositoryId: string
      error: string
    }
  ): void {
    console.error(`Repository prepare failed on agent ${data.agentId}: ${data.error}`)
    this.server.emit('repository:status', {
      ...data,
      status: 'failed'
    })
  }

  // 处理历史记录请求
  @SubscribeMessage('history:request')
  handleHistoryRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: string
      agentId?: string
      claudeSessionId?: string
    }
  ): void {
    const requestId = `history-${Date.now()}-${Math.random()}`

    // 如果提供了agentId，直接转发给对应的agent
    if (data.agentId) {
      const agent = this.connectedAgents.get(data.agentId)
      if (agent) {
        // 转发请求给agent
        this.server.to(agent.socketId).emit('history:request', {
          requestId,
          sessionId: data.sessionId,
          claudeSessionId: data.claudeSessionId
        })

        // 记录请求来源，用于响应路由
        this.historyRequestMap.set(requestId, client.id)
      } else {
        // Agent不在线
        client.emit('history:response', {
          requestId,
          sessionId: data.sessionId,
          messages: [],
          success: false,
          error: 'Agent not connected'
        })
      }
    } else {
      // 没有agentId，返回错误
      client.emit('history:response', {
        requestId,
        sessionId: data.sessionId,
        messages: [],
        success: false,
        error: 'No agent specified'
      })
    }
  }

  // 处理从 Agent 获取历史记录响应
  @SubscribeMessage('history:response')
  handleHistoryResponse(
    @ConnectedSocket() _client: Socket,
    @MessageBody()
    data: {
      requestId: string
      sessionId: string
      messages: any[]
      success: boolean
      error?: string
    }
  ): void {
    // 根据requestId找到原始请求者并转发响应
    const requesterId = this.historyRequestMap.get(data.requestId)
    if (requesterId) {
      const requesterSocket = this.server.sockets.sockets.get(requesterId)
      if (requesterSocket) {
        requesterSocket.emit('history:response', data)
      }
      // 清理映射
      this.historyRequestMap.delete(data.requestId)
    } else {
      // 如果找不到特定请求者，广播给会话房间
      this.server.to(`session-${data.sessionId}`).emit('history:response', data)
    }
  }

  // 处理会话列表响应
  @SubscribeMessage('history:list:response')
  handleHistoryListResponse(
    @ConnectedSocket() _client: Socket,
    @MessageBody()
    data: {
      requestId: string
      conversations: any[]
      success: boolean
      error?: string
    }
  ): void {
    // 转发给请求的客户端
    this.server.emit('history:list:data', data)
  }

  // === Agent监控相关WebSocket事件 ===

  /**
   * 通知Agent状态变化
   */
  notifyAgentStatusChange(agentId: string, status: string): void {
    this.server.emit('agent:status_changed', {
      agentId,
      status,
      timestamp: new Date()
    })

    // 同时通知WebSocket客户端
    this.broadcastToWebClients('agent:status_changed', {
      agentId,
      status,
      timestamp: new Date()
    })

    console.log(`Notified agent status change: ${agentId} -> ${status}`)
  }

  /**
   * 通知Agent告警事件
   */
  notifyAgentAlerts(agentId: string, alerts: any[]): void {
    this.server.emit('agent:alerts', {
      agentId,
      alerts,
      timestamp: new Date()
    })

    // 同时通知WebSocket客户端
    this.broadcastToWebClients('agent:alerts', {
      agentId,
      alerts,
      timestamp: new Date()
    })

    console.log(`Notified agent alerts: ${agentId}, ${alerts.length} alerts`)
  }

  /**
   * 通知Agent健康数据更新
   */
  notifyAgentHealthUpdate(agentId: string, healthData: any): void {
    this.server.emit('agent:health_update', {
      agentId,
      healthData,
      timestamp: new Date()
    })

    // 同时通知WebSocket客户端
    this.broadcastToWebClients('agent:health_update', {
      agentId,
      healthData,
      timestamp: new Date()
    })
  }

  /**
   * 通知批量操作进度
   */
  notifyBatchOperationProgress(operationId: string, progress: any): void {
    this.server.emit('batch_operation:progress', {
      operationId,
      progress,
      timestamp: new Date()
    })

    // 同时通知WebSocket客户端
    this.broadcastToWebClients('batch_operation:progress', {
      operationId,
      progress,
      timestamp: new Date()
    })
  }

  /**
   * 处理Agent健康心跳
   */
  @SubscribeMessage('agent:health_heartbeat')
  handleAgentHealthHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      agentId: string
      metrics: any
      timestamp: Date
    }
  ): void {
    // 转发健康心跳数据给所有客户端
    this.server.emit('agent:health_heartbeat', data)

    // 同时通知WebSocket客户端
    this.broadcastToWebClients('agent:health_heartbeat', data)
  }

  /**
   * 处理Agent资源使用情况更新
   */
  @SubscribeMessage('agent:resources_update')
  handleAgentResourcesUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      agentId: string
      resources: any
      timestamp: Date
    }
  ): void {
    // 转发资源使用情况给监控客户端
    this.server.emit('agent:resources_update', data)

    // 同时通知WebSocket客户端
    this.broadcastToWebClients('agent:resources_update', data)
  }

  /**
   * 处理Agent日志推送
   */
  @SubscribeMessage('agent:log')
  handleAgentLog(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      agentId: string
      level: 'debug' | 'info' | 'warn' | 'error'
      message: string
      timestamp: Date
      context?: any
    }
  ): void {
    // 转发日志给监控客户端
    this.server.emit('agent:log', data)

    // 同时通知WebSocket客户端
    this.broadcastToWebClients('agent:log', data)
  }

  /**
   * 订阅Agent监控数据
   */
  @SubscribeMessage('monitoring:subscribe')
  handleMonitoringSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      agentIds?: string[]
      types: string[] // ['health', 'alerts', 'logs', 'resources']
    }
  ): void {
    // 加入监控房间
    for (const type of data.types) {
      client.join(`monitoring:${type}`)
    }

    // 如果指定了特定Agent，加入Agent特定的监控房间
    if (data.agentIds) {
      for (const agentId of data.agentIds) {
        for (const type of data.types) {
          client.join(`monitoring:${type}:${agentId}`)
        }
      }
    }

    client.emit('monitoring:subscribed', {
      agentIds: data.agentIds,
      types: data.types
    })

    console.log(`Client ${client.id} subscribed to monitoring:`, data)
  }

  /**
   * 取消订阅Agent监控数据
   */
  @SubscribeMessage('monitoring:unsubscribe')
  handleMonitoringUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      agentIds?: string[]
      types: string[] // ['health', 'alerts', 'logs', 'resources']
    }
  ): void {
    // 离开监控房间
    for (const type of data.types) {
      client.leave(`monitoring:${type}`)
    }

    // 如果指定了特定Agent，离开Agent特定的监控房间
    if (data.agentIds) {
      for (const agentId of data.agentIds) {
        for (const type of data.types) {
          client.leave(`monitoring:${type}:${agentId}`)
        }
      }
    }

    client.emit('monitoring:unsubscribed', {
      agentIds: data.agentIds,
      types: data.types
    })

    console.log(`Client ${client.id} unsubscribed from monitoring:`, data)
  }

  /**
   * 获取连接的Agent列表
   */
  @SubscribeMessage('agents:get_connected')
  handleGetConnectedAgents(
    @ConnectedSocket() client: Socket
  ): void {
    const agents = Array.from(this.connectedAgents.values()).map(agent => ({
      id: agent.agentId,
      name: agent.name,
      connectedAt: agent.connectedAt,
      latency: agent.latency
    }))

    client.emit('agents:connected_list', { agents })
  }

  /**
   * 请求Agent执行连接测试
   */
  @SubscribeMessage('agent:test_connection')
  async handleAgentTestConnection(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { agentId: string }
  ): Promise<void> {
    const agent = this.connectedAgents.get(data.agentId)
    if (agent) {
      // 发送测试请求给Agent
      this.server.to(agent.socketId).emit('agent:connection_test', {
        requestId: `test-${Date.now()}`,
        timestamp: new Date()
      })

      client.emit('agent:test_connection_sent', {
        agentId: data.agentId,
        timestamp: new Date()
      })
    } else {
      client.emit('agent:test_connection_failed', {
        agentId: data.agentId,
        error: 'Agent not connected'
      })
    }
  }

  /**
   * 处理Agent连接测试结果
   */
  @SubscribeMessage('agent:connection_test_result')
  handleAgentConnectionTestResult(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      agentId: string
      requestId: string
      success: boolean
      responseTime: number
      error?: string
      timestamp: Date
    }
  ): void {
    // 广播测试结果给所有监控客户端
    this.server.emit('agent:connection_test_result', data)

    // 同时通知WebSocket客户端
    this.broadcastToWebClients('agent:connection_test_result', data)
  }
}
