import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, In } from 'typeorm'
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common'
import { UserAssistantService } from './user-assistant.service'
import { OperationLogService } from './operation-log.service'
import { UserAssistant } from '../entities/user-assistant.entity'
import { AssistantRepository } from '../entities/assistant-repository.entity'
import { UserRepository } from '../entities/user-repository.entity'
import { UserAiConfig } from '../entities/user-ai-config.entity'
import { mockAssistant, mockAiConfig, mockRepository, createMockRepository } from '../test/test-utils'
import { CreateAssistantDto, UpdateAssistantDto, AssistantRepositoryDto } from '../dto/user-assistant.dto'

describe('UserAssistantService', () => {
  let service: UserAssistantService
  let assistantRepository: jest.Mocked<Repository<UserAssistant>>
  let assistantRepoRepository: jest.Mocked<Repository<AssistantRepository>>
  let userRepoRepository: jest.Mocked<Repository<UserRepository>>
  let aiConfigRepository: jest.Mocked<Repository<UserAiConfig>>
  let operationLogService: jest.Mocked<OperationLogService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAssistantService,
        {
          provide: getRepositoryToken(UserAssistant),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(AssistantRepository),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(UserRepository),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(UserAiConfig),
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

    service = module.get<UserAssistantService>(UserAssistantService)
    assistantRepository = module.get(getRepositoryToken(UserAssistant))
    assistantRepoRepository = module.get(getRepositoryToken(AssistantRepository))
    userRepoRepository = module.get(getRepositoryToken(UserRepository))
    aiConfigRepository = module.get(getRepositoryToken(UserAiConfig))
    operationLogService = module.get(OperationLogService)
  })

  describe('createAssistant', () => {
    const createAssistantDto: CreateAssistantDto = {
      name: 'Test Assistant',
      description: 'A test assistant',
      aiConfigId: 'config-1',
      repositoryIds: ['repo-1'],
    }

    it('should create assistant successfully', async () => {
      assistantRepository.findOne.mockResolvedValue(null)
      aiConfigRepository.findOne.mockResolvedValue(mockAiConfig as UserAiConfig)
      userRepoRepository.find.mockResolvedValue([mockRepository as UserRepository])
      assistantRepository.create.mockReturnValue(mockAssistant as UserAssistant)
      assistantRepository.save
        .mockResolvedValueOnce({ ...mockAssistant, status: 'creating' } as UserAssistant)
        .mockResolvedValueOnce({ ...mockAssistant, status: 'active' } as UserAssistant)
      assistantRepoRepository.create.mockReturnValue({} as AssistantRepository)
      assistantRepoRepository.save.mockResolvedValue({} as AssistantRepository)

      const result = await service.createAssistant('user-1', createAssistantDto)

      expect(assistantRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', name: createAssistantDto.name }
      })
      expect(aiConfigRepository.findOne).toHaveBeenCalledWith({
        where: { id: createAssistantDto.aiConfigId, userId: 'user-1' }
      })
      expect(userRepoRepository.find).toHaveBeenCalledWith({
        where: { id: In(createAssistantDto.repositoryIds), userId: 'user-1' }
      })
      expect(assistantRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: createAssistantDto.name,
        description: createAssistantDto.description,
        avatar: createAssistantDto.avatar,
        aiConfigId: createAssistantDto.aiConfigId,
        status: 'creating',
      })
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result.status).toBe('active')
    })

    it('should throw ConflictException if assistant name exists', async () => {
      assistantRepository.findOne.mockResolvedValue(mockAssistant as UserAssistant)

      await expect(service.createAssistant('user-1', createAssistantDto))
        .rejects.toThrow(ConflictException)
    })

    it('should throw BadRequestException if AI config not found', async () => {
      assistantRepository.findOne.mockResolvedValue(null)
      aiConfigRepository.findOne.mockResolvedValue(null)

      await expect(service.createAssistant('user-1', createAssistantDto))
        .rejects.toThrow(BadRequestException)
    })

    it('should throw BadRequestException if repository not found', async () => {
      assistantRepository.findOne.mockResolvedValue(null)
      aiConfigRepository.findOne.mockResolvedValue(mockAiConfig as UserAiConfig)
      userRepoRepository.find.mockResolvedValue([]) // No repositories found

      await expect(service.createAssistant('user-1', createAssistantDto))
        .rejects.toThrow(BadRequestException)
    })

    it('should create assistant without repositories', async () => {
      const dtoWithoutRepos = { ...createAssistantDto, repositoryIds: [] }
      assistantRepository.findOne.mockResolvedValue(null)
      aiConfigRepository.findOne.mockResolvedValue(mockAiConfig as UserAiConfig)
      assistantRepository.create.mockReturnValue(mockAssistant as UserAssistant)
      assistantRepository.save
        .mockResolvedValueOnce({ ...mockAssistant, status: 'creating' } as UserAssistant)
        .mockResolvedValueOnce({ ...mockAssistant, status: 'active' } as UserAssistant)

      const result = await service.createAssistant('user-1', dtoWithoutRepos)

      expect(userRepoRepository.find).not.toHaveBeenCalled()
      expect(result.status).toBe('active')
    })
  })

  describe('findUserAssistants', () => {
    it('should return user assistants', async () => {
      const assistants = [mockAssistant as UserAssistant]
      assistantRepository.find.mockResolvedValue(assistants)

      const result = await service.findUserAssistants('user-1')

      expect(assistantRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        relations: ['aiConfig', 'repositories', 'repositories.repository'],
        order: { createdAt: 'DESC' }
      })
      expect(result).toEqual(assistants)
    })

    it('should filter by status', async () => {
      const assistants = [mockAssistant as UserAssistant]
      assistantRepository.find.mockResolvedValue(assistants)

      await service.findUserAssistants('user-1', 'active')

      expect(assistantRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'active' },
        relations: ['aiConfig', 'repositories', 'repositories.repository'],
        order: { createdAt: 'DESC' }
      })
    })
  })

  describe('findById', () => {
    it('should return assistant by id', async () => {
      assistantRepository.findOne.mockResolvedValue(mockAssistant as UserAssistant)

      const result = await service.findById('assistant-1', 'user-1')

      expect(assistantRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'assistant-1', userId: 'user-1' },
        relations: ['aiConfig', 'repositories', 'repositories.repository', 'conversations']
      })
      expect(result).toEqual(mockAssistant)
    })

    it('should throw NotFoundException if assistant not found', async () => {
      assistantRepository.findOne.mockResolvedValue(null)

      await expect(service.findById('assistant-1', 'user-1'))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('updateAssistant', () => {
    const updateAssistantDto: UpdateAssistantDto = {
      name: 'Updated Assistant',
      aiConfigId: 'config-2',
    }

    it('should update assistant successfully', async () => {
      const updatedAssistant = { ...mockAssistant, ...updateAssistantDto }
      assistantRepository.findOne
        .mockResolvedValueOnce(mockAssistant as UserAssistant) // findById call
        .mockResolvedValueOnce(null) // name uniqueness check
      aiConfigRepository.findOne.mockResolvedValue(mockAiConfig as UserAiConfig)
      assistantRepository.save.mockResolvedValue(updatedAssistant as UserAssistant)

      const result = await service.updateAssistant('assistant-1', 'user-1', updateAssistantDto)

      expect(aiConfigRepository.findOne).toHaveBeenCalledWith({
        where: { id: updateAssistantDto.aiConfigId, userId: 'user-1' }
      })
      expect(assistantRepository.save).toHaveBeenCalledWith({
        ...mockAssistant,
        ...updateAssistantDto
      })
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result).toEqual(updatedAssistant)
    })

    it('should throw ConflictException if name is taken', async () => {
      const anotherAssistant = { ...mockAssistant, id: 'assistant-2' }
      assistantRepository.findOne
        .mockResolvedValueOnce(mockAssistant as UserAssistant) // findById call
        .mockResolvedValueOnce(anotherAssistant as UserAssistant) // name check

      await expect(service.updateAssistant('assistant-1', 'user-1', updateAssistantDto))
        .rejects.toThrow(ConflictException)
    })

    it('should throw BadRequestException if AI config not found', async () => {
      assistantRepository.findOne
        .mockResolvedValueOnce(mockAssistant as UserAssistant)
        .mockResolvedValueOnce(null)
      aiConfigRepository.findOne.mockResolvedValue(null)

      await expect(service.updateAssistant('assistant-1', 'user-1', updateAssistantDto))
        .rejects.toThrow(BadRequestException)
    })
  })

  describe('addRepositoryToAssistant', () => {
    const repoDto: AssistantRepositoryDto = {
      repositoryId: 'repo-1',
      syncBranch: 'develop',
      autoSync: true,
    }

    it('should add repository to assistant successfully', async () => {
      const assistantRepo = { id: 'assistant-repo-1' }
      assistantRepository.findOne.mockResolvedValue(mockAssistant as UserAssistant)
      userRepoRepository.findOne.mockResolvedValue(mockRepository as UserRepository)
      assistantRepoRepository.findOne.mockResolvedValue(null)
      assistantRepoRepository.create.mockReturnValue(assistantRepo as AssistantRepository)
      assistantRepoRepository.save.mockResolvedValue(assistantRepo as AssistantRepository)

      const result = await service.addRepositoryToAssistant('assistant-1', 'user-1', repoDto)

      expect(userRepoRepository.findOne).toHaveBeenCalledWith({
        where: { id: repoDto.repositoryId, userId: 'user-1' }
      })
      expect(assistantRepoRepository.findOne).toHaveBeenCalledWith({
        where: { assistantId: 'assistant-1', repositoryId: repoDto.repositoryId }
      })
      expect(assistantRepoRepository.create).toHaveBeenCalledWith({
        assistantId: 'assistant-1',
        repositoryId: repoDto.repositoryId,
        syncBranch: repoDto.syncBranch,
        autoSync: repoDto.autoSync,
        syncStatus: 'syncing',
      })
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result).toEqual(assistantRepo)
    })

    it('should throw BadRequestException if repository not found', async () => {
      assistantRepository.findOne.mockResolvedValue(mockAssistant as UserAssistant)
      userRepoRepository.findOne.mockResolvedValue(null)

      await expect(service.addRepositoryToAssistant('assistant-1', 'user-1', repoDto))
        .rejects.toThrow(BadRequestException)
    })

    it('should throw ConflictException if repository already associated', async () => {
      assistantRepository.findOne.mockResolvedValue(mockAssistant as UserAssistant)
      userRepoRepository.findOne.mockResolvedValue(mockRepository as UserRepository)
      assistantRepoRepository.findOne.mockResolvedValue({} as AssistantRepository)

      await expect(service.addRepositoryToAssistant('assistant-1', 'user-1', repoDto))
        .rejects.toThrow(ConflictException)
    })
  })

  describe('removeRepositoryFromAssistant', () => {
    it('should remove repository from assistant successfully', async () => {
      const assistantRepo = { repository: mockRepository }
      assistantRepository.findOne.mockResolvedValue(mockAssistant as UserAssistant)
      assistantRepoRepository.findOne.mockResolvedValue(assistantRepo as AssistantRepository)
      assistantRepoRepository.remove.mockResolvedValue(assistantRepo as AssistantRepository)

      await service.removeRepositoryFromAssistant('assistant-1', 'repo-1', 'user-1')

      expect(assistantRepoRepository.findOne).toHaveBeenCalledWith({
        where: { assistantId: 'assistant-1', repositoryId: 'repo-1' },
        relations: ['repository']
      })
      expect(assistantRepoRepository.remove).toHaveBeenCalledWith(assistantRepo)
      expect(operationLogService.createLog).toHaveBeenCalled()
    })

    it('should throw NotFoundException if association not found', async () => {
      assistantRepository.findOne.mockResolvedValue(mockAssistant as UserAssistant)
      assistantRepoRepository.findOne.mockResolvedValue(null)

      await expect(service.removeRepositoryFromAssistant('assistant-1', 'repo-1', 'user-1'))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('syncAssistantRepository', () => {
    it('should sync assistant repository successfully', async () => {
      const assistantRepo = { syncStatus: 'syncing', repository: mockRepository }
      assistantRepository.findOne.mockResolvedValue(mockAssistant as UserAssistant)
      assistantRepoRepository.findOne.mockResolvedValue(assistantRepo as AssistantRepository)
      assistantRepoRepository.save.mockResolvedValue(assistantRepo as AssistantRepository)

      const result = await service.syncAssistantRepository('assistant-1', 'repo-1', 'user-1')

      expect(assistantRepoRepository.save).toHaveBeenCalledTimes(2) // Initial sync status and final success
      expect(operationLogService.createLog).toHaveBeenCalledWith({
        userId: 'user-1',
        operationType: 'assistant_sync_repository',
        resourceType: 'assistant',
        resourceId: 'assistant-1',
        operationData: { success: true, repositoryId: 'repo-1' }
      })
      expect(result).toEqual({ success: true, message: '同步成功' })
    })

    it('should handle sync failure', async () => {
      const assistantRepo = { syncStatus: 'syncing', repository: mockRepository }
      assistantRepository.findOne.mockResolvedValue(mockAssistant as UserAssistant)
      assistantRepoRepository.findOne.mockResolvedValue(assistantRepo as AssistantRepository)
      assistantRepoRepository.save.mockRejectedValueOnce(new Error('Sync failed'))

      const result = await service.syncAssistantRepository('assistant-1', 'repo-1', 'user-1')

      expect(operationLogService.createLog).toHaveBeenCalledWith({
        userId: 'user-1',
        operationType: 'assistant_sync_repository',
        resourceType: 'assistant',
        resourceId: 'assistant-1',
        operationData: { success: false, repositoryId: 'repo-1', error: 'Sync failed' }
      })
      expect(result).toEqual({ success: false, message: 'Sync failed' })
    })
  })

  describe('deleteAssistant', () => {
    it('should delete assistant successfully', async () => {
      assistantRepository.findOne.mockResolvedValue(mockAssistant as UserAssistant)
      assistantRepository.remove.mockResolvedValue(mockAssistant as UserAssistant)

      await service.deleteAssistant('assistant-1', 'user-1')

      expect(assistantRepository.remove).toHaveBeenCalledWith(mockAssistant)
      expect(operationLogService.createLog).toHaveBeenCalled()
    })
  })

  describe('getUserAssistantStats', () => {
    it('should return user assistant statistics', async () => {
      const assistants = [
        { status: 'active', repositories: [{}, {}], conversations: [{}] },
        { status: 'inactive', repositories: [{}], conversations: [{}, {}] },
        { status: 'active', repositories: [], conversations: [] },
      ]
      assistantRepository.find.mockResolvedValue(assistants as UserAssistant[])

      const result = await service.getUserAssistantStats('user-1')

      expect(assistantRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        relations: ['repositories', 'conversations']
      })
      expect(result).toEqual({
        total: 3,
        byStatus: { active: 2, inactive: 1 },
        totalRepositories: 3,
        totalConversations: 3,
      })
    })
  })
})