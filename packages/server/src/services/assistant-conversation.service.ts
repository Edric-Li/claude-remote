import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AssistantConversation } from '../entities/assistant-conversation.entity'
import { AssistantMessage } from '../entities/assistant-message.entity'
import { UserAssistant } from '../entities/user-assistant.entity'
import { 
  CreateConversationDto, 
  UpdateConversationDto, 
  CreateMessageDto, 
  BatchCreateMessagesDto,
  ArchiveConversationDto 
} from '../dto/assistant-conversation.dto'
import { OperationLogService } from './operation-log.service'

@Injectable()
export class AssistantConversationService {
  private readonly logger = new Logger(AssistantConversationService.name)

  constructor(
    @InjectRepository(AssistantConversation)
    private conversationRepository: Repository<AssistantConversation>,
    @InjectRepository(AssistantMessage)
    private messageRepository: Repository<AssistantMessage>,
    @InjectRepository(UserAssistant)
    private assistantRepository: Repository<UserAssistant>,
    private operationLogService: OperationLogService
  ) {}

  async createConversation(
    userId: string,
    createConversationDto: CreateConversationDto
  ): Promise<AssistantConversation> {
    // 验证助手是否属于用户
    const assistant = await this.assistantRepository.findOne({
      where: { id: createConversationDto.assistantId, userId }
    })
    if (!assistant) {
      throw new BadRequestException('助手不存在或不属于当前用户')
    }

    const conversation = this.conversationRepository.create({
      userId,
      assistantId: createConversationDto.assistantId,
      title: createConversationDto.title || `与${assistant.name}的对话`,
      messageCount: 0,
      status: 'active'
    })

    const savedConversation = await this.conversationRepository.save(conversation)

    // 记录操作日志
    await this.operationLogService.createLog({
      userId,
      operationType: 'conversation_create',
      resourceType: 'conversation',
      resourceId: savedConversation.id,
      operationData: { assistantId: createConversationDto.assistantId, title: savedConversation.title }
    })

    this.logger.log(`Conversation created: ${savedConversation.id} for user ${userId}`)
    return savedConversation
  }

  async findUserConversations(
    userId: string,
    status?: string,
    assistantId?: string,
    page = 1,
    limit = 20
  ): Promise<{ conversations: AssistantConversation[]; total: number }> {
    const query = this.conversationRepository.createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.assistant', 'assistant')
      .where('conversation.userId = :userId', { userId })
      .orderBy('conversation.lastMessageAt', 'DESC')

    if (status) {
      query.andWhere('conversation.status = :status', { status })
    }

    if (assistantId) {
      query.andWhere('conversation.assistantId = :assistantId', { assistantId })
    }

    const [conversations, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    return { conversations, total }
  }

  async findById(id: string, userId: string): Promise<AssistantConversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id, userId },
      relations: ['assistant', 'messages']
    })
    
    if (!conversation) {
      throw new NotFoundException('对话不存在')
    }
    
    return conversation
  }

  async updateConversation(
    id: string,
    userId: string,
    updateConversationDto: UpdateConversationDto
  ): Promise<AssistantConversation> {
    const conversation = await this.findById(id, userId)

    Object.assign(conversation, updateConversationDto)
    const updatedConversation = await this.conversationRepository.save(conversation)

    // 记录操作日志
    await this.operationLogService.createLog({
      userId,
      operationType: 'conversation_update',
      resourceType: 'conversation',
      resourceId: id,
      operationData: updateConversationDto
    })

    return updatedConversation
  }

  async archiveConversation(
    id: string,
    userId: string,
    archiveDto: ArchiveConversationDto
  ): Promise<AssistantConversation> {
    const conversation = await this.findById(id, userId)

    // 如果提供了消息数据，先保存到数据库
    if (archiveDto.messages && archiveDto.messages.length > 0) {
      await this.batchCreateMessages(id, userId, { messages: archiveDto.messages })
    }

    // 更新对话状态为已归档
    conversation.status = 'archived'
    const archivedConversation = await this.conversationRepository.save(conversation)

    // 记录操作日志
    await this.operationLogService.createLog({
      userId,
      operationType: 'conversation_archive',
      resourceType: 'conversation',
      resourceId: id,
      operationData: { messageCount: archiveDto.messages?.length || 0 }
    })

    this.logger.log(`Conversation archived: ${id} with ${archiveDto.messages?.length || 0} messages`)
    return archivedConversation
  }

  async getConversationMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 50
  ): Promise<{ messages: AssistantMessage[]; total: number }> {
    // 验证对话是否属于用户
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, userId }
    })
    if (!conversation) {
      throw new NotFoundException('对话不存在')
    }

    const [messages, total] = await this.messageRepository.findAndCount({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit
    })

    return { messages, total }
  }

  async createMessage(
    conversationId: string,
    userId: string,
    createMessageDto: CreateMessageDto
  ): Promise<AssistantMessage> {
    const conversation = await this.findById(conversationId, userId)

    const message = this.messageRepository.create({
      conversationId,
      ...createMessageDto
    })

    const savedMessage = await this.messageRepository.save(message)

    // 更新对话的消息数量和最后消息时间
    await this.updateConversationStats(conversationId)

    return savedMessage
  }

  async batchCreateMessages(
    conversationId: string,
    userId: string,
    batchDto: BatchCreateMessagesDto
  ): Promise<AssistantMessage[]> {
    const conversation = await this.findById(conversationId, userId)

    const messages = batchDto.messages.map(messageDto => 
      this.messageRepository.create({
        conversationId,
        ...messageDto
      })
    )

    const savedMessages = await this.messageRepository.save(messages)

    // 更新对话统计信息
    await this.updateConversationStats(conversationId)

    this.logger.log(`Batch created ${savedMessages.length} messages for conversation ${conversationId}`)
    return savedMessages
  }

  async deleteConversation(id: string, userId: string): Promise<void> {
    const conversation = await this.findById(id, userId)
    
    await this.conversationRepository.remove(conversation)

    // 记录操作日志
    await this.operationLogService.createLog({
      userId,
      operationType: 'conversation_delete',
      resourceType: 'conversation',
      resourceId: id,
      operationData: { title: conversation.title, messageCount: conversation.messageCount }
    })

    this.logger.log(`Conversation deleted: ${id} for user ${userId}`)
  }

  async deleteMessage(
    messageId: string,
    conversationId: string,
    userId: string
  ): Promise<void> {
    // 验证对话是否属于用户
    const conversation = await this.findById(conversationId, userId)

    const message = await this.messageRepository.findOne({
      where: { id: messageId, conversationId }
    })
    
    if (!message) {
      throw new NotFoundException('消息不存在')
    }

    await this.messageRepository.remove(message)

    // 更新对话统计信息
    await this.updateConversationStats(conversationId)

    this.logger.log(`Message deleted: ${messageId} from conversation ${conversationId}`)
  }

  private async updateConversationStats(conversationId: string): Promise<void> {
    const messageCount = await this.messageRepository.count({
      where: { conversationId }
    })

    const lastMessage = await this.messageRepository.findOne({
      where: { conversationId },
      order: { createdAt: 'DESC' }
    })

    await this.conversationRepository.update(conversationId, {
      messageCount,
      lastMessageAt: lastMessage?.createdAt || new Date()
    })
  }

  async getUserConversationStats(userId: string): Promise<{
    total: number
    byStatus: Record<string, number>
    totalMessages: number
    byAssistant: Record<string, number>
  }> {
    const conversations = await this.conversationRepository.find({
      where: { userId },
      relations: ['assistant'],
      select: ['status', 'messageCount', 'assistant']
    })

    const total = conversations.length
    const byStatus = conversations.reduce((acc, conv) => {
      acc[conv.status] = (acc[conv.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messageCount, 0)

    const byAssistant = conversations.reduce((acc, conv) => {
      const assistantName = conv.assistant?.name || 'Unknown'
      acc[assistantName] = (acc[assistantName] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return { total, byStatus, totalMessages, byAssistant }
  }

  async cleanupArchivedMessages(daysOld: number): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    // 只删除已归档对话中的旧消息
    const result = await this.messageRepository
      .createQueryBuilder('message')
      .delete()
      .where('message.createdAt < :cutoffDate', { cutoffDate })
      .andWhere('message.conversationId IN (SELECT id FROM assistant_conversations WHERE status = :status)', { status: 'archived' })
      .execute()

    return result.affected || 0
  }
}