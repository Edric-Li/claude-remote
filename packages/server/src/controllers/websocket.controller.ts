/**
 * WebSocket 控制器 - 专门处理前端 WebSocket 连接
 * 替代 events.controller.ts 中的 SSE 实现
 */

import {
  Controller,
  Logger,
  Inject,
  forwardRef,
  OnModuleInit,
  UnauthorizedException
} from '@nestjs/common'
import { WebSocketServer, WebSocket, RawData } from 'ws'
import { Server } from 'http'
import { JwtService } from '@nestjs/jwt'
import { ChatGateway } from '../chat/chat.gateway'
import * as url from 'url'

interface WebSocketClient {
  id: string
  ws: WebSocket
  userId: string
  username: string
  connectedAt: Date
  lastHeartbeat: Date
}

@Controller('websocket')
export class WebSocketController implements OnModuleInit {
  private readonly logger = new Logger(WebSocketController.name)
  private wss: WebSocketServer | null = null
  private clients = new Map<string, WebSocketClient>()
  private heartbeatInterval: NodeJS.Timeout | null = null

  private chatGateway: ChatGateway | null = null

  constructor(
    private readonly jwtService: JwtService
  ) {}

  onModuleInit() {
    // 模块初始化时设置 WebSocket 服务器
    this.setupWebSocketServer()
  }

  /**
   * 设置 WebSocket 服务器
   */
  private setupWebSocketServer() {
    // 注意：这里我们需要从应用程序获取 HTTP 服务器实例
    // 这个方法将在 main.ts 中调用
  }

  /**
   * 设置 ChatGateway 引用（由 main.ts 调用）
   */
  public setChatGateway(chatGateway: ChatGateway) {
    this.chatGateway = chatGateway
  }

  /**
   * 初始化 WebSocket 服务器（由 main.ts 调用）
   */
  public initWebSocketServer(httpServer: Server) {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    })

    this.wss.on('connection', this.handleConnection.bind(this))
    
    // 启动心跳检测
    this.startHeartbeat()
    
    this.logger.log('WebSocket 服务器已启动，路径: /ws')
  }

  /**
   * 验证客户端连接
   */
  private async verifyClient(info: any): Promise<boolean> {
    try {
      const query = url.parse(info.req.url, true).query
      const token = query.token as string

      if (!token) {
        this.logger.error('WebSocket连接缺少token参数')
        return false
      }

      // 验证JWT token
      const payload = this.jwtService.verify(token)
      // 简化版：为测试创建一个基本用户对象
      const user = {
        id: payload.sub || 'test-user',
        username: payload.username || 'test-user',
        email: payload.email || 'test@example.com'
      }

      // 将用户信息附加到请求对象上，供后续使用
      info.req.user = user
      return true
    } catch (error) {
      this.logger.error('WebSocket连接验证失败:', error.message)
      return false
    }
  }

  /**
   * 处理新的 WebSocket 连接
   */
  private handleConnection(ws: WebSocket, request: any) {
    const user = request.user
    const clientId = `web-${user.id}-${Date.now()}`
    
    const client: WebSocketClient = {
      id: clientId,
      ws,
      userId: user.id,
      username: user.username,
      connectedAt: new Date(),
      lastHeartbeat: new Date()
    }

    this.clients.set(clientId, client)
    this.logger.log(`WebSocket客户端连接: ${user.username} (${clientId})`)

    // 发送连接确认
    this.sendToClient(client, {
      type: 'connected',
      payload: {
        clientId,
        timestamp: new Date().toISOString(),
        message: 'WebSocket连接已建立'
      }
    })

    // 设置消息处理
    ws.on('message', (data) => this.handleMessage(client, data))
    
    // 设置连接关闭处理
    ws.on('close', () => this.handleDisconnect(client))
    
    // 设置错误处理
    ws.on('error', (error) => this.handleError(client, error))

    // 监听 Socket.io Gateway 的事件，转发给 WebSocket 客户端
    this.subscribeToGatewayEvents(client)
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(client: WebSocketClient, data: RawData) {
    try {
      const message = JSON.parse(data.toString())
      
      switch (message.type) {
        case 'heartbeat':
          client.lastHeartbeat = new Date()
          this.sendToClient(client, {
            type: 'heartbeat',
            payload: { timestamp: new Date().toISOString() }
          })
          break

        case 'chat:message':
          // 转发聊天消息给 Socket.io Gateway
          this.forwardToGateway('chat:message', message.payload)
          break

        case 'worker:start':
          this.forwardToGateway('worker:start', message.payload)
          break

        case 'worker:input':
          this.forwardToGateway('worker:input', message.payload)
          break

        case 'worker:recreate_request':
          this.forwardToGateway('worker:recreate_request', message.payload)
          break

        case 'session:join':
          // 处理会话加入（如果需要）
          break

        case 'session:leave':
          // 处理会话离开（如果需要）
          break

        default:
          this.logger.warn(`未知的消息类型: ${message.type}`)
      }
    } catch (error) {
      this.logger.error(`解析客户端消息失败: ${error.message}`)
      this.sendToClient(client, {
        type: 'error',
        payload: { message: '消息格式错误' }
      })
    }
  }

  /**
   * 转发消息给 Socket.io Gateway
   */
  private forwardToGateway(eventType: string, payload: any) {
    if (this.chatGateway) {
      this.chatGateway.handleWebSocketMessage(eventType, payload)
      this.logger.debug(`转发消息给Gateway: ${eventType}`, payload)
    } else {
      this.logger.error('ChatGateway 未初始化，无法转发消息')
    }
  }

  /**
   * 订阅 Gateway 事件并转发给 WebSocket 客户端
   * 这个方法在 ChatGateway 中的事件处理方法会调用 broadcastToWebClients
   */
  private subscribeToGatewayEvents(client: WebSocketClient) {
    // 事件转发由 ChatGateway 通过 broadcastToWebClients 方法处理
    // 无需在这里订阅，因为我们已经在 ChatGateway 中添加了 WebSocket 广播
    this.logger.debug(`客户端 ${client.id} 已准备接收来自Gateway的事件`)
  }

  /**
   * 处理客户端断开连接
   */
  private handleDisconnect(client: WebSocketClient) {
    this.clients.delete(client.id)
    this.logger.log(`WebSocket客户端断开: ${client.username} (${client.id})`)
  }

  /**
   * 处理连接错误
   */
  private handleError(client: WebSocketClient, error: Error) {
    this.logger.error(`WebSocket客户端错误: ${client.username} (${client.id})`, error)
    this.clients.delete(client.id)
  }

  /**
   * 发送消息给特定客户端
   */
  private sendToClient(client: WebSocketClient, message: any) {
    if (client.ws.readyState === 1) { // WebSocket.OPEN
      client.ws.send(JSON.stringify(message))
    }
  }

  /**
   * 广播消息给所有 WebSocket 客户端
   */
  public broadcastToWebClients(eventType: string, payload: any) {
    const message = {
      type: eventType,
      payload,
      timestamp: new Date().toISOString()
    }

    this.clients.forEach((client) => {
      this.sendToClient(client, message)
    })
  }

  /**
   * 发送消息给特定用户的所有 WebSocket 连接
   */
  public sendToUser(userId: string, eventType: string, payload: any) {
    const message = {
      type: eventType,
      payload,
      timestamp: new Date().toISOString()
    }

    this.clients.forEach((client) => {
      if (client.userId === userId) {
        this.sendToClient(client, message)
      }
    })
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date()
      const timeout = 60000 // 60秒超时

      this.clients.forEach((client, clientId) => {
        const timeSinceHeartbeat = now.getTime() - client.lastHeartbeat.getTime()
        
        if (timeSinceHeartbeat > timeout) {
          this.logger.log(`客户端心跳超时，断开连接: ${client.username} (${clientId})`)
          client.ws.terminate()
          this.clients.delete(clientId)
        } else {
          // 发送心跳包
          this.sendToClient(client, {
            type: 'heartbeat',
            payload: { timestamp: now.toISOString() }
          })
        }
      })
    }, 30000) // 每30秒检查一次
  }

  /**
   * 清理资源
   */
  onModuleDestroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    if (this.wss) {
      this.wss.close()
    }

    this.clients.clear()
  }
}