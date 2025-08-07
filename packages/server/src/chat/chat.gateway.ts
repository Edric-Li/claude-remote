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

interface Agent {
  id: string
  name: string
  socketId: string
  connectedAt: Date
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

  private agents = new Map<string, Agent>()

  handleConnection(client: Socket): void {
    console.log(`Client connected: ${client.id}`)
    
    // Log all incoming events for debugging
    client.onAny((eventName, ...args) => {
      console.log(`[${client.id}] Event: ${eventName}`, args)
    })
  }

  handleDisconnect(client: Socket): void {
    console.log(`Client disconnected: ${client.id}`)
    
    // Remove agent if it was registered
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.socketId === client.id) {
        this.agents.delete(agentId)
        this.server.emit('agent:disconnected', { agentId })
        console.log(`Agent ${agentId} disconnected`)
        break
      }
    }
  }

  @SubscribeMessage('agent:register')
  handleAgentRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { agentId: string; name: string }
  ): void {
    const agent: Agent = {
      id: data.agentId,
      name: data.name,
      socketId: client.id,
      connectedAt: new Date()
    }
    
    this.agents.set(data.agentId, agent)
    
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

  @SubscribeMessage('agent:list')
  handleAgentList(): { agents: Array<Omit<Agent, 'socketId'>> } {
    const agentList = Array.from(this.agents.values()).map(({ socketId, ...agent }) => agent)
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
      for (const agent of this.agents.values()) {
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
    const agent = this.agents.get(data.agentId)
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
    const agent = this.agents.get(data.agentId)
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
    @MessageBody() data: { taskId: string; message: any }
  ): void {
    console.log(`Worker message for task ${data.taskId}:`, data.message.type)
    
    // Broadcast structured Worker messages to all web clients
    this.server.emit('worker:message', data)
  }
}