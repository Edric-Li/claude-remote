import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common'
import { UserRepositoryService } from './user-repository.service'
import { OperationLogService } from './operation-log.service'
import { UserRepository } from '../entities/user-repository.entity'
import { mockRepository, createMockRepository } from '../test/test-utils'
import { CreateRepositoryDto, UpdateRepositoryDto, SyncRepositoryDto } from '../dto/user-repository.dto'

describe('UserRepositoryService', () => {
  let service: UserRepositoryService
  let repositoryRepository: jest.Mocked<Repository<UserRepository>>
  let operationLogService: jest.Mocked<OperationLogService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepositoryService,
        {
          provide: getRepositoryToken(UserRepository),
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

    service = module.get<UserRepositoryService>(UserRepositoryService)
    repositoryRepository = module.get(getRepositoryToken(UserRepository))
    operationLogService = module.get(OperationLogService)
  })

  describe('createRepository', () => {
    const createRepoDto: CreateRepositoryDto = {
      name: 'Test Repository',
      type: 'git',
      url: 'https://github.com/test/repo.git',
      branch: 'main',
      description: 'A test repository',
    }

    it('should create repository successfully', async () => {
      repositoryRepository.findOne.mockResolvedValue(null)
      repositoryRepository.create.mockReturnValue(mockRepository as UserRepository)
      repositoryRepository.save.mockResolvedValue(mockRepository as UserRepository)

      const result = await service.createRepository('user-1', createRepoDto)

      expect(repositoryRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', name: createRepoDto.name }
      })
      expect(repositoryRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        ...createRepoDto,
        status: 'inactive',
      })
      expect(repositoryRepository.save).toHaveBeenCalledWith(mockRepository)
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result).toEqual(mockRepository)
    })

    it('should throw ConflictException if repository name exists', async () => {
      repositoryRepository.findOne.mockResolvedValue(mockRepository as UserRepository)

      await expect(service.createRepository('user-1', createRepoDto))
        .rejects.toThrow(ConflictException)
    })

    it('should validate Git URL format', async () => {
      const invalidGitDto = { ...createRepoDto, url: 'invalid-git-url' }
      repositoryRepository.findOne.mockResolvedValue(null)

      await expect(service.createRepository('user-1', invalidGitDto))
        .rejects.toThrow(BadRequestException)
    })

    it('should validate local path', async () => {
      const emptyLocalDto = { ...createRepoDto, type: 'local' as const, url: '' }
      repositoryRepository.findOne.mockResolvedValue(null)

      await expect(service.createRepository('user-1', emptyLocalDto))
        .rejects.toThrow(BadRequestException)
    })

    it('should accept valid local path', async () => {
      const validLocalDto = { ...createRepoDto, type: 'local' as const, url: '/path/to/local/repo' }
      repositoryRepository.findOne.mockResolvedValue(null)
      repositoryRepository.create.mockReturnValue(mockRepository as UserRepository)
      repositoryRepository.save.mockResolvedValue(mockRepository as UserRepository)

      const result = await service.createRepository('user-1', validLocalDto)

      expect(result).toEqual(mockRepository)
    })
  })

  describe('findUserRepositories', () => {
    it('should return user repositories', async () => {
      const repositories = [mockRepository as UserRepository]
      repositoryRepository.find.mockResolvedValue(repositories)

      const result = await service.findUserRepositories('user-1')

      expect(repositoryRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' }
      })
      expect(result).toEqual(repositories)
    })

    it('should filter by status', async () => {
      const repositories = [mockRepository as UserRepository]
      repositoryRepository.find.mockResolvedValue(repositories)

      await service.findUserRepositories('user-1', 'active')

      expect(repositoryRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'active' },
        order: { createdAt: 'DESC' }
      })
    })
  })

  describe('findById', () => {
    it('should return repository by id', async () => {
      repositoryRepository.findOne.mockResolvedValue(mockRepository as UserRepository)

      const result = await service.findById('repo-1', 'user-1')

      expect(repositoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'repo-1', userId: 'user-1' },
        relations: ['assistantRepositories', 'assistantRepositories.assistant']
      })
      expect(result).toEqual(mockRepository)
    })

    it('should throw NotFoundException if repository not found', async () => {
      repositoryRepository.findOne.mockResolvedValue(null)

      await expect(service.findById('repo-1', 'user-1'))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('updateRepository', () => {
    const updateRepoDto: UpdateRepositoryDto = {
      name: 'Updated Repository',
      url: 'https://github.com/test/updated-repo.git',
    }

    it('should update repository successfully', async () => {
      const updatedRepository = { ...mockRepository, ...updateRepoDto }
      repositoryRepository.findOne
        .mockResolvedValueOnce(mockRepository as UserRepository) // findById call
        .mockResolvedValueOnce(null) // name uniqueness check
      repositoryRepository.save.mockResolvedValue(updatedRepository as UserRepository)

      const result = await service.updateRepository('repo-1', 'user-1', updateRepoDto)

      expect(repositoryRepository.save).toHaveBeenCalledWith({
        ...mockRepository,
        ...updateRepoDto
      })
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result).toEqual(updatedRepository)
    })

    it('should throw ConflictException if name is taken by another repository', async () => {
      const anotherRepo = { ...mockRepository, id: 'repo-2' }
      repositoryRepository.findOne
        .mockResolvedValueOnce(mockRepository as UserRepository) // findById call
        .mockResolvedValueOnce(anotherRepo as UserRepository) // name check

      await expect(service.updateRepository('repo-1', 'user-1', updateRepoDto))
        .rejects.toThrow(ConflictException)
    })

    it('should validate URL when changed', async () => {
      const invalidUrlDto = { ...updateRepoDto, url: 'invalid-url' }
      repositoryRepository.findOne.mockResolvedValue(mockRepository as UserRepository)

      await expect(service.updateRepository('repo-1', 'user-1', invalidUrlDto))
        .rejects.toThrow(BadRequestException)
    })
  })

  describe('syncRepository', () => {
    it('should sync repository successfully', async () => {
      const updatedRepository = {
        ...mockRepository,
        lastSyncAt: expect.any(Date),
        syncError: null,
        status: 'active'
      }
      repositoryRepository.findOne.mockResolvedValue(mockRepository as UserRepository)
      repositoryRepository.save.mockResolvedValue(updatedRepository as UserRepository)

      const result = await service.syncRepository('repo-1', 'user-1')

      expect(repositoryRepository.save).toHaveBeenCalledWith(updatedRepository)
      expect(operationLogService.createLog).toHaveBeenCalledWith({
        userId: 'user-1',
        operationType: 'repository_sync',
        resourceType: 'repository',
        resourceId: 'repo-1',
        operationData: { success: true, branch: mockRepository.branch }
      })
      expect(result).toEqual({ success: true, message: '同步成功' })
    })

    it('should handle sync failure', async () => {
      const error = new Error('Sync failed')
      repositoryRepository.findOne.mockResolvedValue(mockRepository as UserRepository)
      repositoryRepository.save.mockRejectedValue(error)

      const result = await service.syncRepository('repo-1', 'user-1')

      expect(operationLogService.createLog).toHaveBeenCalledWith({
        userId: 'user-1',
        operationType: 'repository_sync',
        resourceType: 'repository',
        resourceId: 'repo-1',
        operationData: { success: false, error: 'Sync failed' }
      })
      expect(result).toEqual({ success: false, message: 'Sync failed' })
    })

    it('should sync with custom branch', async () => {
      const syncDto: SyncRepositoryDto = { branch: 'develop' }
      repositoryRepository.findOne.mockResolvedValue(mockRepository as UserRepository)
      repositoryRepository.save.mockResolvedValue(mockRepository as UserRepository)

      await service.syncRepository('repo-1', 'user-1', syncDto)

      expect(repositoryRepository.save).toHaveBeenCalledWith({
        ...mockRepository,
        branch: 'develop',
        lastSyncAt: expect.any(Date),
        syncError: null,
        status: 'active'
      })
    })
  })

  describe('testConnection', () => {
    it('should return success for connection test', async () => {
      repositoryRepository.findOne.mockResolvedValue(mockRepository as UserRepository)

      const result = await service.testConnection('repo-1', 'user-1')

      expect(operationLogService.createLog).toHaveBeenCalledWith({
        userId: 'user-1',
        operationType: 'repository_test',
        resourceType: 'repository',
        resourceId: 'repo-1',
        operationData: { success: true, type: mockRepository.type }
      })
      expect(result).toEqual({ success: true, message: '连接测试成功' })
    })

    it('should handle connection test failure', async () => {
      repositoryRepository.findOne.mockRejectedValue(new Error('Connection failed'))

      const result = await service.testConnection('repo-1', 'user-1')

      expect(operationLogService.createLog).toHaveBeenCalledWith({
        userId: 'user-1',
        operationType: 'repository_test',
        resourceType: 'repository',
        resourceId: 'repo-1',
        operationData: { success: false, error: 'Connection failed', type: undefined }
      })
      expect(result).toEqual({ success: false, message: 'Connection failed' })
    })
  })

  describe('deleteRepository', () => {
    it('should delete repository successfully', async () => {
      const repoWithoutAssistants = { ...mockRepository, assistantRepositories: [] }
      repositoryRepository.findOne.mockResolvedValue(repoWithoutAssistants as UserRepository)
      repositoryRepository.remove.mockResolvedValue(repoWithoutAssistants as UserRepository)

      await service.deleteRepository('repo-1', 'user-1')

      expect(repositoryRepository.remove).toHaveBeenCalledWith(repoWithoutAssistants)
      expect(operationLogService.createLog).toHaveBeenCalled()
    })

    it('should throw BadRequestException if repository is used by assistants', async () => {
      const repoWithAssistants = {
        ...mockRepository,
        assistantRepositories: [{ id: 'assistant-repo-1' }]
      }
      repositoryRepository.findOne.mockResolvedValue(repoWithAssistants as any)

      await expect(service.deleteRepository('repo-1', 'user-1'))
        .rejects.toThrow(BadRequestException)
    })
  })

  describe('getUserRepositoryStats', () => {
    it('should return user repository statistics', async () => {
      const repositories = [
        { status: 'active', type: 'git' },
        { status: 'inactive', type: 'local' },
        { status: 'active', type: 'git' },
      ]
      repositoryRepository.find.mockResolvedValue(repositories as UserRepository[])

      const result = await service.getUserRepositoryStats('user-1')

      expect(repositoryRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: ['status', 'type']
      })
      expect(result).toEqual({
        total: 3,
        byStatus: { active: 2, inactive: 1 },
        byType: { git: 2, local: 1 }
      })
    })
  })
})