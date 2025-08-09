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
import { ModuleRef } from '@nestjs/core'
import { AgentService } from '../services/agent.service'
import { WorkerService } from '../services/worker.service'
import { TaskService } from '../services/task.service'
import { OnEvent } from '@nestjs/event-emitter'

interface ConnectedAgent {
  id: string
  name: string
  socketId: string
  connectedAt: Date
  agentId: string  // Database ID
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

  constructor(
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService,
    @Inject(forwardRef(() => WorkerService))
    private readonly workerService: WorkerService,
    @Inject(forwardRef(() => TaskService))
    private readonly taskService: TaskService,
    private readonly moduleRef: ModuleRef
  ) {
    // Services will be used for agent/worker management
  }

  handleConnection(client: Socket): void {
    console.log(`Client connected: ${client.id}`)
  }

  async handleDisconnect(client: Socket): Promise<void> {
    console.log(`Client disconnected: ${client.id}`)
    
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
  handleWorkerStart(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { agentId: string; taskId: string; workingDirectory?: string; initialPrompt?: string }
  ): void {
    console.log(`Starting Worker for agent ${data.agentId}, task ${data.taskId}`)
    
    // Forward to specific agent
    const agent = this.connectedAgents.get(data.agentId)
    if (agent) {
      this.server.to(agent.socketId).emit('worker:start', {
        taskId: data.taskId,
        workingDirectory: data.workingDirectory,
        initialPrompt: data.initialPrompt
      })
    }
  }

  @SubscribeMessage('worker:input')
  handleWorkerInput(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { agentId: string; taskId: string; input: string }
  ): void {
    console.log(`Sending input to Worker: ${data.input}`)
    
    // Forward to specific agent
    const agent = this.connectedAgents.get(data.agentId)
    if (agent) {
      this.server.to(agent.socketId).emit('worker:input', {
        taskId: data.taskId,
        input: data.input
      })
    }
  }

  @SubscribeMessage('worker:output')
  handleWorkerOutput(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { taskId: string; output: string; outputType: 'stdout' | 'stderr' }
  ): void {
    // Broadcast Worker output to all web clients
    this.server.emit('worker:output', data)
  }

  @SubscribeMessage('worker:status')
  handleWorkerStatus(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { taskId: string; status: string; error?: string; exitCode?: number }
  ): void {
    console.log(`Worker status for task ${data.taskId}: ${data.status}`)
    
    // Broadcast status to all web clients
    this.server.emit('worker:status', data)
  }

  @SubscribeMessage('worker:message')
  handleWorkerMessage(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { taskId: string; message: any; agentId?: string }
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
    
    // Broadcast structured Worker messages to all web clients
    this.server.emit('worker:message', data)
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
        const repoService = this.moduleRef.get('RepositoryService', { strict: false })
        repository = await repoService.findOne(data.task.repositoryId)
      } catch (error) {
        console.error('Failed to get repository:', error)
      }
    }
    
    // Get Claude configuration
    let claudeConfig = null
    try {
      const claudeService = this.moduleRef.get('ClaudeService', { strict: false })
      claudeConfig = await claudeService.getConfig()
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
}