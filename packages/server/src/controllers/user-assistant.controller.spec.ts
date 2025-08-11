import { Test, TestingModule } from '@nestjs/testing'
import { UserAssistantController } from './user-assistant.controller'
import { UserAssistantService } from '../services/user-assistant.service'
import { mockAssistant, mockUser } from '../test/test-utils'
import { CreateAssistantDto, UpdateAssistantDto, AssistantRepositoryDto } from '../dto/user-assistant.dto'
import { UserAssistant } from '../entities/user-assistant.entity'
import { AssistantRepository } from '../entities/assistant-repository.entity'
import { User } from '../entities/user.entity'

describe('UserAssistantController', () => {
  let controller: UserAssistantController
  let assistantService: jest.Mocked<UserAssistantService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserAssistantController],
      providers: [
        {
          provide: UserAssistantService,
          useValue: {
            createAssistant: jest.fn(),
            findUserAssistants: jest.fn(),
            getUserAssistantStats: jest.fn(),
            findById: jest.fn(),
            updateAssistant: jest.fn(),
            addRepositoryToAssistant: jest.fn(),
            removeRepositoryFromAssistant: jest.fn(),
            syncAssistantRepository: jest.fn(),
            deleteAssistant: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<UserAssistantController>(UserAssistantController)
    assistantService = module.get(UserAssistantService)
  })

  describe('createAssistant', () => {
    it('should create assistant', async () => {
      const createAssistantDto: CreateAssistantDto = {
        name: 'Test Assistant',
        aiConfigId: 'config-1',
        repositoryIds: ['repo-1'],
      }
      assistantService.createAssistant.mockResolvedValue(mockAssistant as UserAssistant)

      const result = await controller.createAssistant(mockUser as User, createAssistantDto)

      expect(assistantService.createAssistant).toHaveBeenCalledWith(mockUser.id, createAssistantDto)
      expect(result).toEqual(mockAssistant)
    })
  })

  describe('findUserAssistants', () => {
    it('should return user assistants', async () => {
      const assistants = [mockAssistant as UserAssistant]
      assistantService.findUserAssistants.mockResolvedValue(assistants)

      const result = await controller.findUserAssistants(mockUser as User)

      expect(assistantService.findUserAssistants).toHaveBeenCalledWith(mockUser.id, undefined)
      expect(result).toEqual(assistants)
    })

    it('should filter by status', async () => {
      const assistants = [mockAssistant as UserAssistant]
      assistantService.findUserAssistants.mockResolvedValue(assistants)

      await controller.findUserAssistants(mockUser as User, 'active')

      expect(assistantService.findUserAssistants).toHaveBeenCalledWith(mockUser.id, 'active')
    })
  })

  describe('getUserAssistantStats', () => {
    it('should return user assistant stats', async () => {
      const mockStats = {
        total: 5,
        byStatus: { active: 3, inactive: 2 },
        totalRepositories: 10,
        totalConversations: 20,
      }
      assistantService.getUserAssistantStats.mockResolvedValue(mockStats)

      const result = await controller.getUserAssistantStats(mockUser as User)

      expect(assistantService.getUserAssistantStats).toHaveBeenCalledWith(mockUser.id)
      expect(result).toEqual(mockStats)
    })
  })

  describe('findById', () => {
    it('should return assistant by id', async () => {
      assistantService.findById.mockResolvedValue(mockAssistant as UserAssistant)

      const result = await controller.findById(mockUser as User, 'assistant-1')

      expect(assistantService.findById).toHaveBeenCalledWith('assistant-1', mockUser.id)
      expect(result).toEqual(mockAssistant)
    })
  })

  describe('updateAssistant', () => {
    it('should update assistant', async () => {
      const updateAssistantDto: UpdateAssistantDto = { name: 'Updated Assistant' }
      const updatedAssistant = { ...mockAssistant, name: 'Updated Assistant' }
      assistantService.updateAssistant.mockResolvedValue(updatedAssistant as UserAssistant)

      const result = await controller.updateAssistant(mockUser as User, 'assistant-1', updateAssistantDto)

      expect(assistantService.updateAssistant).toHaveBeenCalledWith('assistant-1', mockUser.id, updateAssistantDto)
      expect(result).toEqual(updatedAssistant)
    })
  })

  describe('addRepositoryToAssistant', () => {
    it('should add repository to assistant', async () => {
      const repoDto: AssistantRepositoryDto = {
        repositoryId: 'repo-1',
        syncBranch: 'develop',
      }
      const mockAssistantRepo = { id: 'assistant-repo-1' }
      assistantService.addRepositoryToAssistant.mockResolvedValue(mockAssistantRepo as AssistantRepository)

      const result = await controller.addRepositoryToAssistant(mockUser as User, 'assistant-1', repoDto)

      expect(assistantService.addRepositoryToAssistant).toHaveBeenCalledWith('assistant-1', mockUser.id, repoDto)
      expect(result).toEqual(mockAssistantRepo)
    })
  })

  describe('removeRepositoryFromAssistant', () => {
    it('should remove repository from assistant', async () => {
      assistantService.removeRepositoryFromAssistant.mockResolvedValue(undefined)

      await controller.removeRepositoryFromAssistant(mockUser as User, 'assistant-1', 'repo-1')

      expect(assistantService.removeRepositoryFromAssistant).toHaveBeenCalledWith('assistant-1', 'repo-1', mockUser.id)
    })
  })

  describe('syncAssistantRepository', () => {
    it('should sync assistant repository successfully', async () => {
      const mockResult = { success: true, message: '同步成功' }
      assistantService.syncAssistantRepository.mockResolvedValue(mockResult)

      const result = await controller.syncAssistantRepository(mockUser as User, 'assistant-1', 'repo-1')

      expect(assistantService.syncAssistantRepository).toHaveBeenCalledWith('assistant-1', 'repo-1', mockUser.id)
      expect(result).toEqual(mockResult)
    })

    it('should handle sync failure', async () => {
      const mockResult = { success: false, message: 'Sync failed' }
      assistantService.syncAssistantRepository.mockResolvedValue(mockResult)

      const result = await controller.syncAssistantRepository(mockUser as User, 'assistant-1', 'repo-1')

      expect(result).toEqual(mockResult)
    })
  })

  describe('deleteAssistant', () => {
    it('should delete assistant', async () => {
      assistantService.deleteAssistant.mockResolvedValue(undefined)

      await controller.deleteAssistant(mockUser as User, 'assistant-1')

      expect(assistantService.deleteAssistant).toHaveBeenCalledWith('assistant-1', mockUser.id)
    })
  })
})