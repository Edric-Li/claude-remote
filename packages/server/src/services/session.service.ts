import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Session, SessionMessage } from '../entities/session.entity'
import { RepositoryEntity } from '../entities/repository.entity'
import { User } from '../entities/user.entity'
import { EventEmitter2 } from '@nestjs/event-emitter'

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(SessionMessage)
    private readonly messageRepository: Repository<SessionMessage>,
    @InjectRepository(RepositoryEntity)
    private readonly repositoryEntityRepository: Repository<RepositoryEntity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * 创建新会话
   */
  async create(
    userId: string,
    data: {
      name: string
      repositoryId: string
      aiTool: string
      metadata?: any
    }
  ) {
    // 验证仓库是否存在
    const repository = await this.repositoryEntityRepository.findOne({
      where: { id: data.repositoryId }
    })

    if (!repository) {
      throw new NotFoundException(`Repository ${data.repositoryId} not found`)
    }

    const session = this.sessionRepository.create({
      name: data.name,
      userId: userId,
      repositoryId: data.repositoryId,
      aiTool: data.aiTool,
      status: 'active',
      metadata: {
        branch: repository.branch || 'main',
        lastActivity: new Date(),
        workerStatus: 'idle',
        ...data.metadata
      }
    })

    const savedSession = await this.sessionRepository.save(session)

    // 触发仓库预克隆事件，通知所有连接的 Agent
    this.eventEmitter.emit('repository.prepare', {
      sessionId: savedSession.id,
      repository: {
        id: repository.id,
        name: repository.name,
        url: repository.url,
        branch: repository.branch || 'main',
        credentials: repository.credentials,
        settings: repository.settings
      }
    })

    // 返回包含仓库信息的完整会话
    return {
      ...savedSession,
      repository: {
        id: repository.id,
        name: repository.name,
        url: repository.url,
        branch: repository.branch
      }
    }
  }

  /**
   * 获取用户的所有会话
   */
  async findAllByUser(userId: string) {
    const sessions = await this.sessionRepository.find({
      where: { userId },
      relations: ['repository'],
      order: { updatedAt: 'DESC' }
    })

    // 加载每个会话的最新消息
    const sessionsWithMessages = await Promise.all(
      sessions.map(async session => {
        const messages = await this.messageRepository.find({
          where: { sessionId: session.id },
          order: { createdAt: 'DESC' },
          take: 10
        })

        return {
          ...session,
          messages: messages.reverse(),
          messageCount: await this.messageRepository.count({
            where: { sessionId: session.id }
          })
        }
      })
    )

    return sessionsWithMessages
  }

  /**
   * 获取单个会话详情
   */
  async findOne(id: string, userId: string) {
    const session = await this.sessionRepository.findOne({
      where: { id, userId },
      relations: ['repository', 'messages']
    })

    if (!session) {
      throw new NotFoundException(`Session ${id} not found`)
    }

    // 按时间排序消息
    session.messages = session.messages.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )

    return session
  }

  /**
   * 更新会话
   */
  async update(id: string, userId: string, data: Partial<Session>) {
    const session = await this.sessionRepository.findOne({
      where: { id, userId }
    })

    if (!session) {
      throw new NotFoundException(`Session ${id} not found`)
    }

    Object.assign(session, data)
    session.metadata = {
      ...session.metadata,
      lastActivity: new Date()
    }

    return await this.sessionRepository.save(session)
  }

  /**
   * 分配Worker给会话
   */
  async assignWorker(id: string, userId: string, workerId: string, agentId: string) {
    const session = await this.sessionRepository.findOne({
      where: { id, userId }
    })

    if (!session) {
      throw new NotFoundException(`Session ${id} not found`)
    }

    session.workerId = workerId
    session.agentId = agentId
    session.metadata = {
      ...session.metadata,
      workerStatus: 'idle',
      lastActivity: new Date()
    }

    return await this.sessionRepository.save(session)
  }

  /**
   * 添加消息到会话
   */
  async addMessage(
    sessionId: string,
    userId: string,
    data: {
      from: 'user' | 'assistant' | 'system'
      content: string
      metadata?: any
    }
  ) {
    // 验证会话是否存在且属于用户
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId }
    })

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`)
    }

    const message = this.messageRepository.create({
      sessionId: sessionId,
      from: data.from,
      content: data.content,
      metadata: data.metadata
    })

    const savedMessage = await this.messageRepository.save(message)

    // 更新会话统计
    session.messageCount += 1
    session.metadata = {
      ...session.metadata,
      lastActivity: new Date()
    }

    // 如果有token使用信息，更新统计
    if (data.metadata?.usage) {
      session.totalTokens +=
        (data.metadata.usage.input_tokens || 0) + (data.metadata.usage.output_tokens || 0)
    }

    await this.sessionRepository.save(session)

    return savedMessage
  }

  /**
   * 获取会话的所有消息
   */
  async getMessages(sessionId: string, userId: string, limit = 100, offset = 0) {
    // 验证会话是否存在且属于用户
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId }
    })

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`)
    }

    const messages = await this.messageRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
      skip: offset,
      take: limit
    })

    return messages
  }

  /**
   * 删除会话
   */
  async delete(id: string, userId: string) {
    const session = await this.sessionRepository.findOne({
      where: { id, userId }
    })

    if (!session) {
      throw new NotFoundException(`Session ${id} not found`)
    }

    await this.sessionRepository.remove(session)
    return { success: true }
  }

  /**
   * 归档会话
   */
  async archive(id: string, userId: string) {
    const session = await this.sessionRepository.findOne({
      where: { id, userId }
    })

    if (!session) {
      throw new NotFoundException(`Session ${id} not found`)
    }

    session.status = 'archived'
    return await this.sessionRepository.save(session)
  }

  /**
   * 获取会话统计
   */
  async getStats(userId: string) {
    const stats = await this.sessionRepository
      .createQueryBuilder('session')
      .where('session.userId = :userId', { userId })
      .select('COUNT(*)', 'totalSessions')
      .addSelect('SUM(session.messageCount)', 'totalMessages')
      .addSelect('SUM(session.totalTokens)', 'totalTokens')
      .addSelect('SUM(session.totalCost)', 'totalCost')
      .addSelect('session.aiTool', 'aiTool')
      .groupBy('session.aiTool')
      .getRawMany()

    return stats
  }
}
