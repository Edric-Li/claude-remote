import { Test, TestingModule } from '@nestjs/testing'
import { UserRepositoryController } from './user-repository.controller'
import { UserRepositoryService } from '../services/user-repository.service'
import { mockRepository, mockUser } from '../test/test-utils'
import {
  CreateRepositoryDto,
  UpdateRepositoryDto,
  SyncRepositoryDto
} from '../dto/user-repository.dto'
import { UserRepository } from '../entities/user-repository.entity'
import { User } from '../entities/user.entity'

describe('UserRepositoryController', () => {
  let controller: UserRepositoryController
  let repositoryService: jest.Mocked<UserRepositoryService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserRepositoryController],
      providers: [
        {
          provide: UserRepositoryService,
          useValue: {
            createRepository: jest.fn(),
            findUserRepositories: jest.fn(),
            getUserRepositoryStats: jest.fn(),
            findById: jest.fn(),
            updateRepository: jest.fn(),
            syncRepository: jest.fn(),
            testConnection: jest.fn(),
            deleteRepository: jest.fn()
          }
        }
      ]
    }).compile()

    controller = module.get<UserRepositoryController>(UserRepositoryController)
    repositoryService = module.get(UserRepositoryService)
  })

  describe('createRepository', () => {
    it('should create repository', async () => {
      const createRepoDto: CreateRepositoryDto = {
        name: 'Test Repository',
        type: 'git',
        url: 'https://github.com/test/repo.git'
      }
      repositoryService.createRepository.mockResolvedValue(mockRepository as UserRepository)

      const result = await controller.createRepository(mockUser as User, createRepoDto)

      expect(repositoryService.createRepository).toHaveBeenCalledWith(mockUser.id, createRepoDto)
      expect(result).toEqual(mockRepository)
    })
  })

  describe('findUserRepositories', () => {
    it('should return user repositories', async () => {
      const repositories = [mockRepository as UserRepository]
      repositoryService.findUserRepositories.mockResolvedValue(repositories)

      const result = await controller.findUserRepositories(mockUser as User)

      expect(repositoryService.findUserRepositories).toHaveBeenCalledWith(mockUser.id, undefined)
      expect(result).toEqual(repositories)
    })

    it('should filter by status', async () => {
      const repositories = [mockRepository as UserRepository]
      repositoryService.findUserRepositories.mockResolvedValue(repositories)

      await controller.findUserRepositories(mockUser as User, 'active')

      expect(repositoryService.findUserRepositories).toHaveBeenCalledWith(mockUser.id, 'active')
    })
  })

  describe('getUserRepositoryStats', () => {
    it('should return user repository stats', async () => {
      const mockStats = {
        total: 5,
        byStatus: { active: 3, inactive: 2 },
        byType: { git: 4, local: 1 }
      }
      repositoryService.getUserRepositoryStats.mockResolvedValue(mockStats)

      const result = await controller.getUserRepositoryStats(mockUser as User)

      expect(repositoryService.getUserRepositoryStats).toHaveBeenCalledWith(mockUser.id)
      expect(result).toEqual(mockStats)
    })
  })

  describe('findById', () => {
    it('should return repository by id', async () => {
      repositoryService.findById.mockResolvedValue(mockRepository as UserRepository)

      const result = await controller.findById(mockUser as User, 'repo-1')

      expect(repositoryService.findById).toHaveBeenCalledWith('repo-1', mockUser.id)
      expect(result).toEqual(mockRepository)
    })
  })

  describe('updateRepository', () => {
    it('should update repository', async () => {
      const updateRepoDto: UpdateRepositoryDto = { name: 'Updated Repository' }
      const updatedRepository = { ...mockRepository, name: 'Updated Repository' }
      repositoryService.updateRepository.mockResolvedValue(updatedRepository as UserRepository)

      const result = await controller.updateRepository(mockUser as User, 'repo-1', updateRepoDto)

      expect(repositoryService.updateRepository).toHaveBeenCalledWith(
        'repo-1',
        mockUser.id,
        updateRepoDto
      )
      expect(result).toEqual(updatedRepository)
    })
  })

  describe('syncRepository', () => {
    it('should sync repository successfully', async () => {
      const syncDto: SyncRepositoryDto = { branch: 'develop' }
      const mockResult = { success: true, message: '同步成功' }
      repositoryService.syncRepository.mockResolvedValue(mockResult)

      const result = await controller.syncRepository(mockUser as User, 'repo-1', syncDto)

      expect(repositoryService.syncRepository).toHaveBeenCalledWith('repo-1', mockUser.id, syncDto)
      expect(result).toEqual(mockResult)
    })

    it('should handle sync failure', async () => {
      const syncDto: SyncRepositoryDto = {}
      const mockResult = { success: false, message: 'Sync failed' }
      repositoryService.syncRepository.mockResolvedValue(mockResult)

      const result = await controller.syncRepository(mockUser as User, 'repo-1', syncDto)

      expect(result).toEqual(mockResult)
    })
  })

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockResult = { success: true, message: '连接测试成功' }
      repositoryService.testConnection.mockResolvedValue(mockResult)

      const result = await controller.testConnection(mockUser as User, 'repo-1')

      expect(repositoryService.testConnection).toHaveBeenCalledWith('repo-1', mockUser.id)
      expect(result).toEqual(mockResult)
    })

    it('should handle connection failure', async () => {
      const mockResult = { success: false, message: 'Connection failed' }
      repositoryService.testConnection.mockResolvedValue(mockResult)

      const result = await controller.testConnection(mockUser as User, 'repo-1')

      expect(result).toEqual(mockResult)
    })
  })

  describe('deleteRepository', () => {
    it('should delete repository', async () => {
      repositoryService.deleteRepository.mockResolvedValue(undefined)

      await controller.deleteRepository(mockUser as User, 'repo-1')

      expect(repositoryService.deleteRepository).toHaveBeenCalledWith('repo-1', mockUser.id)
    })
  })
})
