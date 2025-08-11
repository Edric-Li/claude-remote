import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common'
import { AssistantConversationService } from './assistant-conversation.service'
import { OperationLogService } from './operation-log.service'
import { AssistantConversation } from '../entities/assistant-conversation.entity'
import { AssistantMessage } from '../entities/assistant-message.entity'
import { UserAssistant } from '../entities/user-assistant.entity'
import { mockConversation, mockMessage, mockAssistant, createMockRepository } from '../test/test-utils'
import { CreateConversationDto, CreateMessageDto, UpdateConversationDto } from '../dto/assistant-conversation.dto'

describe('AssistantConversationService', () => {
  let service: AssistantConversationService
  let conversationRepository: jest.Mocked<Repository<AssistantConversation>>
  let messageRepository: jest.Mocked<Repository<AssistantMessage>>
  let assistantRepository: jest.Mocked<Repository<UserAssistant>>
  let operationLogService: jest.Mocked<OperationLogService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssistantConversationService,
        {
          provide: getRepositoryToken(AssistantConversation),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(AssistantMessage),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(UserAssistant),
          useValue: createMockRepository(),
        },
        {
          provide: OperationLogService,
          useValue: {
            createLog: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile()

    service = module.get<AssistantConversationService>(AssistantConversationService)
    conversationRepository = module.get(getRepositoryToken(AssistantConversation))
    messageRepository = module.get(getRepositoryToken(AssistantMessage))
    assistantRepository = module.get(getRepositoryToken(UserAssistant))
    operationLogService = module.get(OperationLogService)
  })

  describe('createConversation', () => {
    const createConversationDto: CreateConversationDto = {
      title: 'Test Conversation',
      assistantId: 'assistant-1',
    }

    it('should create conversation successfully', async () => {
      assistantRepository.findOne.mockResolvedValue(mockAssistant as UserAssistant)
      conversationRepository.create.mockReturnValue(mockConversation as AssistantConversation)
      conversationRepository.save.mockResolvedValue(mockConversation as AssistantConversation)

      const result = await service.createConversation('user-1', createConversationDto)

      expect(assistantRepository.findOne).toHaveBeenCalledWith({
        where: { id: createConversationDto.assistantId, userId: 'user-1' }
      })
      expect(conversationRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        assistantId: createConversationDto.assistantId,
        title: createConversationDto.title,
      })
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result).toEqual(mockConversation)
    })

    it('should throw BadRequestException if assistant not found', async () => {
      assistantRepository.findOne.mockResolvedValue(null)

      await expect(service.createConversation('user-1', createConversationDto))
        .rejects.toThrow(BadRequestException)
    })

    it('should generate title if not provided', async () => {
      const dtoWithoutTitle = { assistantId: 'assistant-1' }
      assistantRepository.findOne.mockResolvedValue(mockAssistant as UserAssistant)
      conversationRepository.create.mockReturnValue(mockConversation as AssistantConversation)
      conversationRepository.save.mockResolvedValue(mockConversation as AssistantConversation)

      await service.createConversation('user-1', dtoWithoutTitle)

      expect(conversationRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        assistantId: dtoWithoutTitle.assistantId,
        title: expect.stringMatching(/^新对话 \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
      })
    })
  })

  describe('findUserConversations', () => {
    it('should return user conversations', async () => {
      const conversations = [mockConversation as AssistantConversation]
      conversationRepository.find.mockResolvedValue(conversations)

      const result = await service.findUserConversations('user-1')

      expect(conversationRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        relations: ['assistant', 'messages'],
        order: { updatedAt: 'DESC' }
      })
      expect(result).toEqual(conversations)
    })

    it('should filter by assistant', async () => {
      const conversations = [mockConversation as AssistantConversation]
      conversationRepository.find.mockResolvedValue(conversations)

      await service.findUserConversations('user-1', 'assistant-1')

      expect(conversationRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', assistantId: 'assistant-1' },
        relations: ['assistant', 'messages'],
        order: { updatedAt: 'DESC' }
      })
    })
  })

  describe('findById', () => {
    it('should return conversation by id', async () => {
      conversationRepository.findOne.mockResolvedValue(mockConversation as AssistantConversation)

      const result = await service.findById('conversation-1', 'user-1')

      expect(conversationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'conversation-1', userId: 'user-1' },
        relations: ['assistant', 'messages']
      })
      expect(result).toEqual(mockConversation)
    })

    it('should throw NotFoundException if conversation not found', async () => {
      conversationRepository.findOne.mockResolvedValue(null)

      await expect(service.findById('conversation-1', 'user-1'))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('updateConversation', () => {
    const updateDto: UpdateConversationDto = {
      title: 'Updated Conversation',
    }

    it('should update conversation successfully', async () => {
      const updatedConversation = { ...mockConversation, ...updateDto }
      conversationRepository.findOne.mockResolvedValue(mockConversation as AssistantConversation)
      conversationRepository.save.mockResolvedValue(updatedConversation as AssistantConversation)

      const result = await service.updateConversation('conversation-1', 'user-1', updateDto)

      expect(conversationRepository.save).toHaveBeenCalledWith({
        ...mockConversation,
        ...updateDto
      })
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result).toEqual(updatedConversation)
    })
  })

  describe('createMessage', () => {
    const createMessageDto: CreateMessageDto = {
      role: 'user',
      content: 'Hello, assistant!',
    }

    it('should create message successfully', async () => {
      conversationRepository.findOne.mockResolvedValue(mockConversation as AssistantConversation)
      messageRepository.create.mockReturnValue(mockMessage as AssistantMessage)
      messageRepository.save.mockResolvedValue(mockMessage as AssistantMessage)
      conversationRepository.save.mockResolvedValue(mockConversation as AssistantConversation)

      const result = await service.createMessage('conversation-1', 'user-1', createMessageDto)

      expect(messageRepository.create).toHaveBeenCalledWith({
        conversationId: 'conversation-1',
        role: createMessageDto.role,
        content: createMessageDto.content,
        metadata: createMessageDto.metadata || {},
      })
      expect(conversationRepository.save).toHaveBeenCalledWith({
        ...mockConversation,
        updatedAt: expect.any(Date)
      })
      expect(result).toEqual(mockMessage)
    })

    it('should include metadata when provided', async () => {
      const dtoWithMetadata = {
        ...createMessageDto,
        metadata: { thinking: 'Some thinking process' }
      }
      conversationRepository.findOne.mockResolvedValue(mockConversation as AssistantConversation)
      messageRepository.create.mockReturnValue(mockMessage as AssistantMessage)
      messageRepository.save.mockResolvedValue(mockMessage as AssistantMessage)
      conversationRepository.save.mockResolvedValue(mockConversation as AssistantConversation)

      await service.createMessage('conversation-1', 'user-1', dtoWithMetadata)

      expect(messageRepository.create).toHaveBeenCalledWith({
        conversationId: 'conversation-1',
        role: dtoWithMetadata.role,
        content: dtoWithMetadata.content,
        metadata: dtoWithMetadata.metadata,
      })
    })
  })

  describe('getConversationMessages', () => {
    it('should return conversation messages', async () => {
      const messages = [mockMessage as AssistantMessage]
      conversationRepository.findOne.mockResolvedValue(mockConversation as AssistantConversation)
      messageRepository.find.mockResolvedValue(messages)

      const result = await service.getConversationMessages('conversation-1', 'user-1')

      expect(messageRepository.find).toHaveBeenCalledWith({
        where: { conversationId: 'conversation-1' },
        order: { createdAt: 'ASC' }
      })
      expect(result).toEqual(messages)
    })

    it('should support pagination', async () => {
      const messages = [mockMessage as AssistantMessage]
      conversationRepository.findOne.mockResolvedValue(mockConversation as AssistantConversation)
      messageRepository.find.mockResolvedValue(messages)

      await service.getConversationMessages('conversation-1', 'user-1', 10, 20)

      expect(messageRepository.find).toHaveBeenCalledWith({
        where: { conversationId: 'conversation-1' },
        order: { createdAt: 'ASC' },
        take: 10,
        skip: 20
      })
    })
  })

  describe('deleteConversation', () => {
    it('should delete conversation successfully', async () => {
      conversationRepository.findOne.mockResolvedValue(mockConversation as AssistantConversation)
      conversationRepository.remove.mockResolvedValue(mockConversation as AssistantConversation)

      await service.deleteConversation('conversation-1', 'user-1')

      expect(conversationRepository.remove).toHaveBeenCalledWith(mockConversation)
      expect(operationLogService.createLog).toHaveBeenCalled()
    })
  })

  describe('getUserConversationStats', () => {
    it('should return user conversation statistics', async () => {
      const conversations = [
        { assistantId: 'assistant-1', messages: [{}, {}] },
        { assistantId: 'assistant-2', messages: [{}] },
        { assistantId: 'assistant-1', messages: [{}, {}, {}] },
      ]
      conversationRepository.find.mockResolvedValue(conversations as AssistantConversation[])

      const result = await service.getUserConversationStats('user-1')

      expect(conversationRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        relations: ['messages']
      })
      expect(result).toEqual({
        total: 3,
        totalMessages: 6,
        byAssistant: {
          'assistant-1': 2,
          'assistant-2': 1,
        },
      })
    })
  })
})