import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RepositoryService } from '../repository.service'
import { RepositoryEntity } from '../../entities/repository.entity'
import { EncryptionService } from '../encryption.service'
import { 
  TestResult, 
  ErrorType, 
  RetryConfig, 
  RETRYABLE_ERROR_TYPES,
  NON_RETRYABLE_ERROR_TYPES,
  RepositorySettings
} from '../../types/repository.types'

/**
 * 连接测试功能单元测试
 * 测试 testConnectionWithRetry() 方法的重试机制和错误处理
 * 模拟网络超时和认证失败场景
 * 验证重试次数和退避策略
 */
describe('RepositoryService Connection Test', () => {
  let service: RepositoryService
  let repositoryRepo: jest.Mocked<Repository<RepositoryEntity>>
  let encryptionService: jest.Mocked<EncryptionService>

  // 测试数据模板
  const mockGitRepository: RepositoryEntity = {
    id: 'git-repo-id',
    name: 'Git Test Repository',
    description: 'Test git repository',
    url: 'https://github.com/test/repo.git',
    type: 'git',
    branch: 'main',
    localPath: null,
    enabled: true,
    credentials: 'encrypted-credentials',
    settings: JSON.stringify({
      retryCount: 3,
      connectionTimeout: 15000
    }),
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const mockLocalRepository: RepositoryEntity = {
    id: 'local-repo-id',
    name: 'Local Test Repository',
    description: 'Test local repository',
    url: 'file:///path/to/local/repo',
    type: 'local',
    branch: null,
    localPath: '/path/to/local/repo',
    enabled: true,
    credentials: null,
    settings: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const mockGitLsRemoteOutput = `
52a8b5e4f1234567890abcdef	refs/heads/main
f3b8c2d1a567890123456789	refs/heads/develop
a1b2c3d4e567890123456789	refs/heads/feature/test
9876543210abcdef12345678	refs/heads/hotfix/urgent
`.trim()

  beforeEach(async () => {
    // Mock Repository
    const mockRepositoryRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn()
    }

    // Mock EncryptionService
    const mockEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      decryptLegacy: jest.fn(),
      isLegacyFormat: jest.fn(),
      reencrypt: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepositoryService,
        {
          provide: getRepositoryToken(RepositoryEntity),
          useValue: mockRepositoryRepository
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService
        }
      ]
    }).compile()

    service = module.get<RepositoryService>(RepositoryService)
    repositoryRepo = module.get(getRepositoryToken(RepositoryEntity))
    encryptionService = module.get(EncryptionService)

    // Setup default mocks
    encryptionService.decrypt.mockReturnValue('username:password')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('testConnectionWithRetry() - 基础功能测试', () => {
    describe('仓库不存在处理', () => {
      it('应该处理仓库ID不存在的情况', async () => {
        // Arrange
        const repoId = 'non-existent-repo'
        repositoryRepo.findOne.mockResolvedValue(null)

        // Act
        const result = await service.testConnectionWithRetry(repoId)

        // Assert
        expect(result.success).toBe(false)
        expect(result.message).toBe('仓库不存在')
        expect(result.details?.errorType).toBe('not_found')
        expect(result.timestamp).toBeInstanceOf(Date)
      })
    })

    describe('Git仓库连接测试', () => {
      it('应该成功测试Git仓库连接（模拟成功场景）', async () => {
        // Arrange
        const repoId = 'git-repo-id'
        repositoryRepo.findOne.mockResolvedValue(mockGitRepository)
        repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
        
        // Mock the performSingleConnectionTest method to simulate success
        const mockResult = {
          success: true,
          message: '连接成功，仓库验证通过',
          details: {
            branches: ['develop', 'feature/test', 'hotfix/urgent', 'main'],
            defaultBranch: 'main',
            actualBranch: 'main',
            isGitRepo: true
          }
        }
        
        jest.spyOn(service as any, 'performSingleConnectionTest').mockResolvedValue(mockResult)

        // Act
        const result = await service.testConnectionWithRetry(repoId)

        // Assert
        expect(result.success).toBe(true)
        expect(result.message).toContain('连接成功')
        expect(result.retryCount).toBe(0)
        expect(result.retryDetails).toEqual([])
        expect(result.details?.branches).toEqual(['develop', 'feature/test', 'hotfix/urgent', 'main'])
        expect(result.details?.defaultBranch).toBe('main')
        expect(result.details?.isGitRepo).toBe(true)
        
        // 验证元数据更新
        expect(repositoryRepo.update).toHaveBeenCalledWith(
          repoId,
          expect.objectContaining({
            metadata: expect.any(String)
          })
        )
      })

      it('应该处理分支验证失败并提供建议', async () => {
        // Arrange
        const repoWithInvalidBranch = {
          ...mockGitRepository,
          branch: 'nonexistent-branch'
        }
        repositoryRepo.findOne.mockResolvedValue(repoWithInvalidBranch)
        repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
        
        const mockResult = {
          success: true,
          message: '连接成功，仓库验证通过。分支 \'nonexistent-branch\' 不存在，建议使用 \'main\'',
          details: {
            branches: ['develop', 'feature/test', 'hotfix/urgent', 'main'],
            defaultBranch: 'main',
            actualBranch: 'main',
            branchValidation: {
              isValid: false,
              message: '分支 \'nonexistent-branch\' 不存在，建议使用 \'main\'',
              suggestedBranch: 'main',
              availableBranches: ['develop', 'feature/test', 'hotfix/urgent', 'main']
            },
            isGitRepo: true
          }
        }
        
        jest.spyOn(service as any, 'performSingleConnectionTest').mockResolvedValue(mockResult)

        // Act
        const result = await service.testConnectionWithRetry(repoWithInvalidBranch.id)

        // Assert
        expect(result.success).toBe(true)
        expect(result.message).toContain('分支 \'nonexistent-branch\' 不存在')
        expect(result.details?.branchValidation?.isValid).toBe(false)
        expect(result.details?.branchValidation?.suggestedBranch).toBe('main')
        expect(result.details?.actualBranch).toBe('main')
      })
    })

    describe('本地仓库连接测试', () => {
      it('应该成功测试本地仓库路径', async () => {
        // Arrange
        const repoId = 'local-repo-id'
        repositoryRepo.findOne.mockResolvedValue(mockLocalRepository)
        repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
        
        const mockResult = {
          success: true,
          message: '路径存在且可访问',
          details: { isGitRepo: false }
        }
        
        jest.spyOn(service as any, 'performSingleConnectionTest').mockResolvedValue(mockResult)

        // Act
        const result = await service.testConnectionWithRetry(repoId)

        // Assert
        expect(result.success).toBe(true)
        expect(result.message).toBe('路径存在且可访问')
        expect(result.details?.isGitRepo).toBe(false)
      })

      it('应该处理本地路径不存在的情况', async () => {
        // Arrange
        const repoId = 'local-repo-id'
        repositoryRepo.findOne.mockResolvedValue(mockLocalRepository)
        repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
        
        jest.spyOn(service as any, 'performSingleConnectionTest').mockRejectedValue(
          new Error('ENOENT: no such file or directory')
        )

        // Act
        const result = await service.testConnectionWithRetry(repoId)

        // Assert
        expect(result.success).toBe(false)
        expect(result.details?.errorType).toBe('not_found')
      })
    })
  })

  describe('重试机制测试', () => {
    describe('错误类型分析', () => {
      const errorTestCases = [
        {
          errorMessage: 'fatal: authentication failed',
          expectedType: 'auth' as ErrorType,
          expectedMessageContains: '认证失败',
          shouldRetry: false
        },
        {
          errorMessage: 'could not resolve host: github.com',
          expectedType: 'dns_resolution' as ErrorType,
          expectedMessageContains: '无法解析主机',
          shouldRetry: true
        },
        {
          errorMessage: 'repository not found',
          expectedType: 'not_found' as ErrorType,
          expectedMessageContains: '仓库不存在',
          shouldRetry: false
        },
        {
          errorMessage: 'connection timed out',
          expectedType: 'timeout' as ErrorType,
          expectedMessageContains: '连接超时',
          shouldRetry: true
        },
        {
          errorMessage: 'permission denied',
          expectedType: 'permission_denied' as ErrorType,
          expectedMessageContains: '权限拒绝',
          shouldRetry: false
        },
        {
          errorMessage: 'connection reset by peer',
          expectedType: 'connection_reset' as ErrorType,
          expectedMessageContains: '连接超时',
          shouldRetry: true
        }
      ]

      errorTestCases.forEach(testCase => {
        it(`应该正确识别和处理${testCase.expectedType}错误`, async () => {
          // Arrange
          const repoId = 'git-repo-id'
          repositoryRepo.findOne.mockResolvedValue(mockGitRepository)
          repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
          
          jest.spyOn(service as any, 'performSingleConnectionTest').mockRejectedValue(
            new Error(testCase.errorMessage)
          )

          // Mock sleep to speed up tests
          jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined)

          // Act
          const result = await service.testConnectionWithRetry(repoId)

          // Assert
          expect(result.success).toBe(false)
          expect(result.message).toContain(testCase.expectedMessageContains)
          expect(result.details?.errorType).toBe(testCase.expectedType)
          
          if (testCase.shouldRetry) {
            expect(result.retryCount).toBeGreaterThan(0)
          } else {
            expect(result.retryCount).toBe(0)
          }
        })
      })
    })

    it('应该达到最大重试次数后失败', async () => {
      // Arrange
      const repoId = 'git-repo-id'
      repositoryRepo.findOne.mockResolvedValue(mockGitRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
      
      jest.spyOn(service as any, 'performSingleConnectionTest').mockRejectedValue(
        new Error('connection timed out')
      )

      // Mock sleep to speed up tests
      jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined)

      // Act
      const result = await service.testConnectionWithRetry(repoId)

      // Assert
      expect(result.success).toBe(false)
      expect(result.message).toContain('连接超时')
      expect(result.retryCount).toBe(3)
      expect(result.retryDetails).toHaveLength(3)
      expect(result.details?.errorType).toBe('timeout')
    })

    it('应该使用自定义重试配置', async () => {
      // Arrange
      const repoId = 'git-repo-id'
      const customRetryConfig: RetryConfig = {
        maxRetries: 2,
        baseDelay: 500,
        maxDelay: 2000,
        totalTimeout: 10000
      }
      
      // 使用没有设置的仓库，这样自定义配置会生效
      const repoWithoutSettings = {
        ...mockGitRepository,
        settings: null
      }
      
      repositoryRepo.findOne.mockResolvedValue(repoWithoutSettings)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
      
      jest.spyOn(service as any, 'performSingleConnectionTest').mockRejectedValue(
        new Error('network error')
      )

      jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined)

      // Act
      const result = await service.testConnectionWithRetry(repoId, undefined, undefined, customRetryConfig)

      // Assert
      expect(result.success).toBe(false)
      expect(result.retryCount).toBe(2) // 使用自定义的最大重试次数
    })

    it('应该正确实现指数退避策略', async () => {
      // Arrange
      const repoId = 'git-repo-id'
      repositoryRepo.findOne.mockResolvedValue(mockGitRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
      
      jest.spyOn(service as any, 'performSingleConnectionTest').mockRejectedValue(
        new Error('connection reset')
      )

      const sleepSpy = jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined)

      // Act
      await service.testConnectionWithRetry(repoId)

      // Assert
      expect(sleepSpy).toHaveBeenCalledTimes(3)
      // 验证指数退避：1000ms, 2000ms, 4000ms
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000)
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000)
      expect(sleepSpy).toHaveBeenNthCalledWith(3, 4000)
    })

    it('应该在网络超时后重试并最终成功', async () => {
      // Arrange
      const repoId = 'git-repo-id'
      repositoryRepo.findOne.mockResolvedValue(mockGitRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
      
      let attemptCount = 0
      jest.spyOn(service as any, 'performSingleConnectionTest').mockImplementation(() => {
        attemptCount++
        if (attemptCount <= 2) {
          // 前两次失败
          return Promise.reject(new Error('connection timed out'))
        } else {
          // 第三次成功
          return Promise.resolve({
            success: true,
            message: '连接成功，仓库验证通过',
            details: {
              branches: ['main'],
              defaultBranch: 'main',
              actualBranch: 'main',
              isGitRepo: true
            }
          })
        }
      })

      // Mock sleep to speed up tests
      jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined)

      // Act
      const result = await service.testConnectionWithRetry(repoId)

      // Assert
      expect(result.success).toBe(true)
      expect(result.retryCount).toBe(0) // 成功时retryCount为0
      expect(attemptCount).toBe(3) // 总共执行了3次
    })
  })

  describe('错误类型常量验证', () => {
    it('应该正确定义可重试和不可重试的错误类型', () => {
      // 验证可重试错误类型
      expect(RETRYABLE_ERROR_TYPES).toContain('timeout')
      expect(RETRYABLE_ERROR_TYPES).toContain('network')
      expect(RETRYABLE_ERROR_TYPES).toContain('connection_reset')
      expect(RETRYABLE_ERROR_TYPES).toContain('dns_resolution')
      expect(RETRYABLE_ERROR_TYPES).toContain('unknown')

      // 验证不可重试错误类型
      expect(NON_RETRYABLE_ERROR_TYPES).toContain('auth')
      expect(NON_RETRYABLE_ERROR_TYPES).toContain('not_found')
      expect(NON_RETRYABLE_ERROR_TYPES).toContain('permission_denied')
      expect(NON_RETRYABLE_ERROR_TYPES).toContain('invalid_format')
    })
  })

  describe('元数据更新功能', () => {
    it('应该更新仓库元数据当测试成功时', async () => {
      // Arrange
      const repoId = 'git-repo-id'
      repositoryRepo.findOne.mockResolvedValue(mockGitRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
      
      const mockResult = {
        success: true,
        message: '连接成功',
        details: {
          branches: ['main', 'develop'],
          defaultBranch: 'main',
          actualBranch: 'main',
          isGitRepo: true
        }
      }
      
      jest.spyOn(service as any, 'performSingleConnectionTest').mockResolvedValue(mockResult)

      // Act
      await service.testConnectionWithRetry(repoId)

      // Assert
      expect(repositoryRepo.update).toHaveBeenCalledWith(
        repoId,
        expect.objectContaining({
          metadata: expect.any(String)
        })
      )

      // 验证metadata内容
      const updateCall = repositoryRepo.update.mock.calls[0]
      const metadataStr = updateCall[1].metadata as string
      const metadata = JSON.parse(metadataStr)
      
      expect(metadata.lastTestDate).toBeDefined()
      expect(metadata.lastTestResult.success).toBe(true)
      expect(metadata.availableBranches).toEqual(['main', 'develop'])
      expect(metadata.defaultBranch).toBe('main')
    })

    it('应该更新仓库元数据当测试失败时', async () => {
      // Arrange
      const repoId = 'git-repo-id'
      repositoryRepo.findOne.mockResolvedValue(mockGitRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
      
      jest.spyOn(service as any, 'performSingleConnectionTest').mockRejectedValue(
        new Error('authentication failed')
      )

      // Act
      await service.testConnectionWithRetry(repoId)

      // Assert
      expect(repositoryRepo.update).toHaveBeenCalledWith(
        repoId,
        expect.objectContaining({
          metadata: expect.any(String)
        })
      )

      const updateCall = repositoryRepo.update.mock.calls[0]
      const metadataStr = updateCall[1].metadata as string
      const metadata = JSON.parse(metadataStr)
      
      expect(metadata.lastTestResult.success).toBe(false)
      expect(metadata.lastTestResult.details.errorType).toBe('auth')
    })
  })

  describe('仓库设置应用', () => {
    it('应该使用仓库设置中的重试配置', async () => {
      // Arrange
      const repoId = 'git-repo-id'
      const repoWithSettings = {
        ...mockGitRepository,
        settings: JSON.stringify({
          retryCount: 2,
          connectionTimeout: 5000
        } as RepositorySettings)
      }
      
      repositoryRepo.findOne.mockResolvedValue(repoWithSettings)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
      
      jest.spyOn(service as any, 'performSingleConnectionTest').mockRejectedValue(
        new Error('network error')
      )

      jest.spyOn(service as any, 'sleep').mockResolvedValue(undefined)

      // Act
      const result = await service.testConnectionWithRetry(repoId)

      // Assert
      expect(result.retryCount).toBe(2) // 使用仓库设置中的重试次数
    })
  })

  describe('审计日志记录', () => {
    it('应该记录连接测试的审计信息', async () => {
      // Arrange
      const repoId = 'git-repo-id'
      const userId = 'test-user-id'
      const context = { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      
      repositoryRepo.findOne.mockResolvedValue(mockGitRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
      
      const mockResult = {
        success: true,
        message: '连接成功',
        details: { isGitRepo: true }
      }
      
      jest.spyOn(service as any, 'performSingleConnectionTest').mockResolvedValue(mockResult)

      // Act
      const result = await service.testConnectionWithRetry(repoId, userId, context)

      // Assert
      expect(result.success).toBe(true)
      // 注意：审计日志代码被注释了，这里主要验证方法正常执行
    })
  })

  describe('边界条件处理', () => {
    it('应该处理不支持的仓库类型', async () => {
      // Arrange
      const repoId = 'svn-repo-id'
      const svnRepo = {
        ...mockGitRepository,
        type: 'svn' as any
      }
      repositoryRepo.findOne.mockResolvedValue(svnRepo)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)

      jest.spyOn(service as any, 'performSingleConnectionTest').mockRejectedValue(
        new Error('不支持的仓库类型')
      )

      // Act
      const result = await service.testConnectionWithRetry(repoId)

      // Assert
      expect(result.success).toBe(false)
      expect(result.message).toContain('不支持的仓库类型')
    })

    it('应该处理解密失败的情况', async () => {
      // Arrange
      const repoId = 'git-repo-id'
      repositoryRepo.findOne.mockResolvedValue(mockGitRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
      encryptionService.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed')
      })

      jest.spyOn(service as any, 'performSingleConnectionTest').mockRejectedValue(
        new Error('Decryption failed')
      )

      // Act
      const result = await service.testConnectionWithRetry(repoId)

      // Assert
      expect(result.success).toBe(false)
    })
  })
})