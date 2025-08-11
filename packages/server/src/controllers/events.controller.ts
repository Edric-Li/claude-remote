import {
  Controller,
  Get,
  Req,
  Res,
  Query,
  UseGuards,
  Logger,
  UnauthorizedException,
  Inject,
  SetMetadata
} from '@nestjs/common'
import { Request, Response } from 'express'
import { JwtService } from '@nestjs/jwt'
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard'
import { CurrentUser } from '../modules/auth/decorators/current-user.decorator'
import { User } from '../entities/user.entity'
import { UserService } from '../services/user.service'

@Controller('api/events')
export class EventsController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService
  ) {}
  private readonly logger = new Logger(EventsController.name)
  private clients = new Map<string, Response>()
  private eventQueue = new Map<string, any[]>()

  /**
   * Server-Sent Events 流端点
   */
  @Get('stream')
  @SetMetadata('skipAuth', true)
  async streamEvents(
    @Req() request: Request,
    @Res() response: Response,
    @Query('token') token?: string
  ) {
    let user: User

    // 尝试从查询参数获取token进行认证
    if (token) {
      try {
        const payload = this.jwtService.verify(token)
        user = await this.userService.findById(payload.sub)
        if (!user) {
          throw new UnauthorizedException('用户不存在')
        }
      } catch (error) {
        this.logger.error('SSE Token验证失败:', error.message)
        response.status(401).json({ message: '无效的token' })
        return
      }
    } else {
      this.logger.error('SSE缺少token参数')
      response.status(401).json({ message: '缺少token参数' })
      return
    }
    const clientId = `${user.id}-${Date.now()}`

    this.logger.log(`SSE客户端连接: ${user.username} (${clientId})`)

    // 设置SSE响应头
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'Access-Control-Allow-Credentials': 'true',
      'X-Accel-Buffering': 'no' // 禁用nginx缓冲
    })

    // 发送连接确认
    response.write(
      `data: ${JSON.stringify({
        type: 'connected',
        payload: {
          clientId,
          timestamp: new Date().toISOString(),
          message: 'SSE连接已建立'
        }
      })}\n\n`
    )

    // 发送心跳包
    const heartbeat = setInterval(() => {
      if (response.writableEnded) {
        clearInterval(heartbeat)
        return
      }
      response.write(
        `data: ${JSON.stringify({
          type: 'heartbeat',
          payload: { timestamp: new Date().toISOString() }
        })}\n\n`
      )
    }, 30000) // 30秒心跳

    // 保存客户端连接
    this.clients.set(clientId, response)
    this.eventQueue.set(clientId, [])

    // 处理客户端断开连接
    request.on('close', () => {
      this.logger.log(`SSE客户端断开: ${user.username} (${clientId})`)
      this.clients.delete(clientId)
      this.eventQueue.delete(clientId)
      clearInterval(heartbeat)
    })

    request.on('error', error => {
      this.logger.error(`SSE客户端错误: ${user.username} (${clientId})`, error)
      this.clients.delete(clientId)
      this.eventQueue.delete(clientId)
      clearInterval(heartbeat)
    })
  }

  /**
   * 长轮询端点 - 作为SSE的降级方案
   */
  @Get('poll')
  @UseGuards(JwtAuthGuard)
  async pollEvents(@CurrentUser() user: User) {
    const clientId = `${user.id}-poll`

    // 获取排队的事件
    const events = this.eventQueue.get(clientId) || []
    this.eventQueue.set(clientId, [])

    return {
      events,
      timestamp: new Date().toISOString(),
      clientId
    }
  }

  /**
   * 广播事件到所有连接的客户端
   */
  broadcastEvent(eventType: string, payload: any, targetUserId?: string) {
    const event = {
      type: eventType,
      payload,
      timestamp: new Date().toISOString()
    }

    const eventData = `data: ${JSON.stringify(event)}\n\n`

    this.clients.forEach((response, clientId) => {
      try {
        // 如果指定了目标用户ID，只发送给该用户
        if (targetUserId && !clientId.startsWith(targetUserId)) {
          return
        }

        if (!response.writableEnded) {
          response.write(eventData)
        } else {
          // 清理已断开的连接
          this.clients.delete(clientId)
          this.eventQueue.delete(clientId)
        }
      } catch (error) {
        this.logger.error(`广播事件失败 (${clientId}):`, error)
        this.clients.delete(clientId)
        this.eventQueue.delete(clientId)
      }
    })

    // 为使用长轮询的客户端添加事件到队列
    if (targetUserId) {
      const pollClientId = `${targetUserId}-poll`
      const queue = this.eventQueue.get(pollClientId) || []
      queue.push(event)
      this.eventQueue.set(pollClientId, queue)
    }

    this.logger.debug(`广播事件: ${eventType}`, { payload, targetUserId })
  }

  /**
   * 发送特定事件类型
   */
  sendAgentConnected(agentId: string, agentName: string) {
    this.broadcastEvent('agent:connected', {
      agentId,
      name: agentName,
      connectedAt: new Date().toISOString()
    })
  }

  sendAgentDisconnected(agentId: string) {
    this.broadcastEvent('agent:disconnected', {
      agentId,
      disconnectedAt: new Date().toISOString()
    })
  }

  sendChatReply(agentId: string, content: string, targetUserId?: string) {
    this.broadcastEvent(
      'chat:reply',
      {
        agentId,
        content,
        timestamp: new Date().toISOString()
      },
      targetUserId
    )
  }

  sendWorkerMessage(data: any, targetUserId?: string) {
    this.broadcastEvent('worker:message', data, targetUserId)
  }

  sendWorkerStatus(data: any, targetUserId?: string) {
    this.broadcastEvent('worker:status', data, targetUserId)
  }

  /**
   * 获取连接统计信息
   */
  getConnectionStats() {
    return {
      totalConnections: this.clients.size,
      queuedEvents: Array.from(this.eventQueue.values()).reduce(
        (sum, queue) => sum + queue.length,
        0
      ),
      connectedClients: Array.from(this.clients.keys())
    }
  }
}
