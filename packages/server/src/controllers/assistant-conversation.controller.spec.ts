import { Test, TestingModule } from '@nestjs/testing'
import { AssistantConversationController } from './assistant-conversation.controller'
import { AssistantConversationService } from '../services/assistant-conversation.service'
import { mockConversation, mockMessage, mockUser } from '../test/test-utils'
import { CreateConversationDto, CreateMessageDto } from '../dto/assistant-conversation.dto'
import { AssistantConversation } from '../entities/assistant-conversation.entity'
import { AssistantMessage } from '../entities/assistant-message.entity'
import { User } from '../entities/user.entity'

describe('AssistantConversationController', () => {
  let controller: AssistantConversationController
  let conversationService: jest.Mocked<AssistantConversationService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssistantConversationController],
      providers: [
        {
          provide: AssistantConversationService,
          useValue: {
            createConversation: jest.fn(),
            findUserConversations: jest.fn(),
            getUserConversationStats: jest.fn(),
            findById: jest.fn(),
            updateConversation: jest.fn(),
            createMessage: jest.fn(),
            getConversationMessages: jest.fn(),
            deleteConversation: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<AssistantConversationController>(AssistantConversationController)
    conversationService = module.get(AssistantConversationService)
  })

  describe('createConversation', () => {
    it('should create conversation', async () => {
      const createConversationDto: CreateConversationDto = {
        title: 'Test Conversation',
        assistantId: 'assistant-1',
      }
      conversationService.createConversation.mockResolvedValue(mockConversation as AssistantConversation)

      const result = await controller.createConversation(mockUser as User, createConversationDto)

      expect(conversationService.createConversation).toHaveBeenCalledWith(mockUser.id, createConversationDto)
      expect(result).toEqual(mockConversation)
    })
  })

  describe('findUserConversations', () => {
    it('should return user conversations', async () => {
      const conversations = [mockConversation as AssistantConversation]
      conversationService.findUserConversations.mockResolvedValue(conversations)

      const result = await controller.findUserConversations(mockUser as User)

      expect(conversationService.findUserConversations).toHaveBeenCalledWith(mockUser.id, undefined)
      expect(result).toEqual(conversations)
    })

    it('should filter by assistant', async () => {
      const conversations = [mockConversation as AssistantConversation]
      conversationService.findUserConversations.mockResolvedValue(conversations)

      await controller.findUserConversations(mockUser as User, 'assistant-1')

      expect(conversationService.findUserConversations).toHaveBeenCalledWith(mockUser.id, 'assistant-1')
    })
  })

  describe('getUserConversationStats', () => {
    it('should return user conversation stats', async () => {
      const mockStats = {
        total: 5,
        totalMessages: 20,
        byAssistant: { 'assistant-1': 3, 'assistant-2': 2 },
      }
      conversationService.getUserConversationStats.mockResolvedValue(mockStats)

      const result = await controller.getUserConversationStats(mockUser as User)

      expect(conversationService.getUserConversationStats).toHaveBeenCalledWith(mockUser.id)
      expect(result).toEqual(mockStats)
    })
  })

  describe('findById', () => {
    it('should return conversation by id', async () => {
      conversationService.findById.mockResolvedValue(mockConversation as AssistantConversation)

      const result = await controller.findById(mockUser as User, 'conversation-1')

      expect(conversationService.findById).toHaveBeenCalledWith('conversation-1', mockUser.id)
      expect(result).toEqual(mockConversation)
    })
  })

  describe('updateConversation', () => {
    it('should update conversation', async () => {
      const updateDto = { title: 'Updated Conversation' }
      const updatedConversation = { ...mockConversation, title: 'Updated Conversation' }
      conversationService.updateConversation.mockResolvedValue(updatedConversation as AssistantConversation)

      const result = await controller.updateConversation(mockUser as User, 'conversation-1', updateDto)

      expect(conversationService.updateConversation).toHaveBeenCalledWith('conversation-1', mockUser.id, updateDto)
      expect(result).toEqual(updatedConversation)
    })
  })

  describe('createMessage', () => {
    it('should create message', async () => {
      const createMessageDto: CreateMessageDto = {
        role: 'user',
        content: 'Hello, assistant!',
      }
      conversationService.createMessage.mockResolvedValue(mockMessage as AssistantMessage)

      const result = await controller.createMessage(mockUser as User, 'conversation-1', createMessageDto)

      expect(conversationService.createMessage).toHaveBeenCalledWith('conversation-1', mockUser.id, createMessageDto)
      expect(result).toEqual(mockMessage)
    })
  })

  describe('getConversationMessages', () => {
    it('should return conversation messages', async () => {
      const messages = [mockMessage as AssistantMessage]
      conversationService.getConversationMessages.mockResolvedValue(messages)

      const result = await controller.getConversationMessages(mockUser as User, 'conversation-1')

      expect(conversationService.getConversationMessages).toHaveBeenCalledWith('conversation-1', mockUser.id, undefined, undefined)
      expect(result).toEqual(messages)
    })

    it('should support pagination', async () => {
      const messages = [mockMessage as AssistantMessage]
      conversationService.getConversationMessages.mockResolvedValue(messages)

      await controller.getConversationMessages(mockUser as User, 'conversation-1', 10, 0)

      expect(conversationService.getConversationMessages).toHaveBeenCalledWith('conversation-1', mockUser.id, 10, 0)
    })
  })

  describe('deleteConversation', () => {
    it('should delete conversation', async () => {
      conversationService.deleteConversation.mockResolvedValue(undefined)

      await controller.deleteConversation(mockUser as User, 'conversation-1')

      expect(conversationService.deleteConversation).toHaveBeenCalledWith('conversation-1', mockUser.id)
    })
  })
})