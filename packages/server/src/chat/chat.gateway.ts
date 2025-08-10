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
import { WorkerService } from '../services/worker.service'
import { TaskService } from '../services/task.service'
import { SessionService } from '../services/session.service'
import { RepositoryService } from '../services/repository.service'
import { ClaudeService } from '../services/claude.service'
import { OnEvent } from '@nestjs/event-emitter'

interface ConnectedAgent {
  id: string
  name: string
  socketId: string
  connectedAt: Date
  agentId: string  // Database ID
  latency?: number  // Agent延迟（毫秒）
}

interface ChatMessage {
  from: 'web' | 'agent'
  agentId?: string
  content: string
  timestamp: Date
}

@WebSocketGateway({
  cors: {
    origin: process.env.NODE_ENV === 'production' 
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

  constructor(
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService,
    @Inject(forwardRef(() => WorkerService))
    private readonly workerService: WorkerService,
    @Inject(forwardRef(() => TaskService))
    private readonly taskService: TaskService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    @Inject(forwardRef(() => RepositoryService))
    private readonly repositoryService: RepositoryService,
    private readonly claudeService: ClaudeService
  ) {
    // Services will be used for agent/worker management
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
      
      console.log(`Agent authenticated: ${agent.name} (${agent.id})`)
    } catch (error) {
      console.error('Authentication error:', error)
      client.emit('agent:auth_failed', { message: 'Authentication error' })
    }
  }

  @SubscribeMessage('agent:list')
  handleAgentList(): { agents: Array<Omit<ConnectedAgent, 'socketId'>> } {
    const agentList = Array.from(this.connectedAgents.values()).map(({ socketId, ...agent }) => agent)
    return { agents: agentList }
  }

  @SubscribeMessage('ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() timestamp: number
  ): void {
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
    console.log('Broadcasted reply to all web clients')
  }

  @SubscribeMessage('worker:start')
  async handleWorkerStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      agentId: string; 
      taskId: string; 
      workingDirectory?: string; 
      initialPrompt?: string;
      sessionId?: string;
      claudeSessionId?: string;
      repositoryId?: string;
      repositoryName?: string;
      model?: string;  // 添加model参数
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
      claudeConfig = await this.claudeService.getConfig()
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
        model: data.model,  // 传递model参数到Agent
        repository: repository ? {
          id: repository.id,
          name: repository.name,
          url: repository.url,
          branch: repository.branch,
          credentials: repository.credentials,
          settings: repository.settings
        } : null,
        claudeConfig: claudeConfig
      })
    }
  }

  @SubscribeMessage('worker:input')
  async handleWorkerInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      agentId: string; 
      taskId: string; 
      input: string; 
      sessionId?: string;
      model?: string;
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
    @MessageBody() data: { taskId: string; output: string; outputType: 'stdout' | 'stderr'; sessionId?: string }
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
    @MessageBody() data: { taskId: string; status: string; error?: string; exitCode?: number; sessionId?: string; agentId?: string }
  ): void {
    console.log(`Worker status for task ${data.taskId}: ${data.status}`)
    
    // 只发送给属于该会话的客户端
    if (data.sessionId) {
      const roomName = `session:${data.sessionId}`
      this.server.to(roomName).emit('worker:status', data)
    } else {
      // 兼容性：如果没有sessionId，广播给所有客户端
      this.server.emit('worker:status', data)
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
    
    // 实施消息去重机制 - 基于内容哈希
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
        // 创建消息哈希（任务ID + 内容）
        const messageKey = `${data.taskId}:${Buffer.from(messageContent).toString('base64').substring(0, 32)}`
        
        // 检查是否已发送过相同消息（使用内存缓存，5分钟过期）
        if (!this.recentMessages) {
          this.recentMessages = new Map()
        }
        
        const now = Date.now()
        const fiveMinutesAgo = now - 5 * 60 * 1000
        
        // 清理过期消息
        for (const [key, timestamp] of this.recentMessages.entries()) {
          if (timestamp < fiveMinutesAgo) {
            this.recentMessages.delete(key)
          }
        }
        
        // 检查重复消息
        if (this.recentMessages.has(messageKey)) {
          console.log(`Duplicate assistant message detected and blocked for task ${data.taskId}`)
          return // 直接返回，不转发重复消息
        }
        
        // 记录消息哈希
        this.recentMessages.set(messageKey, now)
        console.log(`Unique assistant message forwarded for task ${data.taskId}`)
      }
    }
    
    // 只发送给属于该会话的客户端
    if (data.sessionId) {
      const roomName = `session:${data.sessionId}`
      this.server.to(roomName).emit('worker:message', data)
      console.log(`Sent worker message to session ${data.sessionId}`)
    } else {
      // 如果没有sessionId，回退到原有的广播行为（兼容性）
      console.warn('Worker message without sessionId, broadcasting to all')
      this.server.emit('worker:message', data)
    }
  }

  // Worker Registration and Management
  @SubscribeMessage('worker:register')
  async handleWorkerRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
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
        capabilities: data.capabilities ? {
          supportedTools: data.capabilities,
          maxConcurrentTasks: 1,
          resourceLimits: {
            maxMemory: 4096,
            maxCpu: 100,
            maxDiskIO: 1000
          }
        } : undefined
      }
      
      const worker = await this.workerService.registerWorker(registerData)
      
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
    @MessageBody() data: {
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
      await this.workerService.handleHeartbeat(data)
    } catch (error) {
      console.error('Worker heartbeat error:', error)
    }
  }

  @SubscribeMessage('worker:task:complete')
  async handleWorkerTaskComplete(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: {
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
    @MessageBody() data: {
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
      claudeConfig = await this.claudeService.getConfig()
    } catch (error) {
      console.error('Failed to get Claude config:', error)
    }
    
    // Send task to specific worker
    this.server.to(`worker:${data.workerId}`).emit('task:assign', {
      taskId: data.task.id,
      repository: repository ? {
        id: repository.id,
        name: repository.name,
        url: repository.url,
        branch: repository.branch,
        credentials: repository.credentials,
        settings: repository.settings
      } : null,
      claudeConfig: claudeConfig ? {
        baseUrl: claudeConfig.baseUrl,
        authToken: claudeConfig.authToken,
        model: claudeConfig.model,
        maxTokens: claudeConfig.maxTokens,
        temperature: claudeConfig.temperature,
        timeout: claudeConfig.timeout
      } : null,
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
    @MessageBody() data: {
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
    @MessageBody() data: {
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

  // 处理从 Agent 获取历史记录
  @SubscribeMessage('history:response')
  handleHistoryResponse(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: {
      requestId: string
      sessionId: string
      messages: any[]
      success: boolean
      error?: string
    }
  ): void {
    // 转发给请求的客户端
    this.server.emit('history:data', data)
  }

  // 处理会话列表响应
  @SubscribeMessage('history:list:response')
  handleHistoryListResponse(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: {
      requestId: string
      conversations: any[]
      success: boolean
      error?: string
    }
  ): void {
    // 转发给请求的客户端
    this.server.emit('history:list:data', data)
  }
}