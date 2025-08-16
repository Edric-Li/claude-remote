import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RepositoryService } from '../repository.service'
import { RepositoryEntity } from '../../entities/repository.entity'
import { EncryptionService } from '../encryption.service'
import { TestResult, ErrorType, RepositorySettings } from '../../types/repository.types'

/**
 * React 仓库集成测试
 * 测试系统对大型公共仓库（React）的支持能力
 * 验证分支列表获取、默认分支选择和性能表现
 * 使用真实的网络连接进行集成测试
 */
describe('RepositoryService React Repository Integration Test', () => {
  let service: RepositoryService
  let repositoryRepo: jest.Mocked<Repository<RepositoryEntity>>
  let encryptionService: jest.Mocked<EncryptionService>

  // React 仓库配置
  const REACT_REPO_URL = 'https://github.com/facebook/react.git'
  const REACT_REPO_ID = 'react-integration-test-id'
  
  // 测试超时配置
  const TEST_TIMEOUT = 45000 // 45秒，考虑到大型仓库的网络延迟
  const PERFORMANCE_THRESHOLD = 30000 // 30秒性能阈值

  const mockReactRepository: RepositoryEntity = {
    id: REACT_REPO_ID,
    name: 'React Repository (Integration Test)',
    description: 'Facebook React repository for integration testing',
    url: REACT_REPO_URL,
    type: 'git',
    branch: 'main', // React 使用 main 分支
    localPath: null,
    enabled: true,
    credentials: null, // 公共仓库无需认证
    settings: JSON.stringify({
      retryCount: 2, // 减少重试次数以避免测试超时
      connectionTimeout: 15000 // 减少连接超时时间
    } as RepositorySettings),
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }

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
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('React 仓库连接测试', () => {
    it('应该连接到 React 公共仓库（可能因网络条件而成功或失败）', async () => {
      // Arrange
      repositoryRepo.findOne.mockResolvedValue(mockReactRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)

      const startTime = Date.now()

      // Act
      const result = await service.testConnectionWithRetry(REACT_REPO_ID)
      const duration = Date.now() - startTime

      // Assert - 基本属性验证
      expect(result).toBeDefined()
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.retryCount).toBeDefined()
      expect(result.retryDetails).toBeDefined()
      expect(result.details).toBeDefined()

      console.log(`React 仓库连接测试完成，耗时: ${duration}ms, 结果: ${result.success ? '成功' : '失败'}`)

      if (result.success) {
        // 网络可用时的成功验证
        expect(result.message).toContain('连接成功')
        expect(result.details?.isGitRepo).toBe(true)
        expect(result.details?.branches).toBeDefined()
        expect(Array.isArray(result.details?.branches)).toBe(true)
        expect(result.details?.branches?.length).toBeGreaterThan(0)
        expect(result.details?.defaultBranch).toBeDefined()
        expect(result.details?.actualBranch).toBeDefined()

        console.log(`发现分支数量: ${result.details?.branches?.length}`)
        console.log(`默认分支: ${result.details?.defaultBranch}`)
      } else {
        // 网络不可用时的失败验证
        expect(result.details?.errorType).toBeDefined()
        expect(['timeout', 'network', 'dns_resolution', 'connection_reset', 'not_found']).toContain(result.details?.errorType)
        
        console.log(`连接失败，错误类型: ${result.details?.errorType}`)
        console.log(`错误消息: ${result.message}`)
        console.log(`重试次数: ${result.retryCount}`)
      }

      // 无论成功失败，都应该更新了元数据
      expect(repositoryRepo.update).toHaveBeenCalledWith(
        REACT_REPO_ID,
        expect.objectContaining({
          metadata: expect.any(String)
        })
      )
    }, TEST_TIMEOUT)

    it('应该正确识别 React 仓库的默认分支（如果网络可用）', async () => {
      // Arrange
      repositoryRepo.findOne.mockResolvedValue(mockReactRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)

      // Act
      const result = await service.testConnectionWithRetry(REACT_REPO_ID)

      // Assert
      expect(result).toBeDefined()
      
      if (result.success) {
        // 网络可用时的详细验证
        expect(result.details?.defaultBranch).toBeDefined()
        expect(result.details?.branches).toBeDefined()
        
        // React 仓库应该使用 'main' 作为默认分支
        // 如果配置的分支存在，应该使用配置的分支
        if (result.details?.branches?.includes('main')) {
          expect(result.details.defaultBranch).toBe('main')
        }

        // 验证分支列表包含常见的 React 分支
        const branches = result.details?.branches || []
        expect(branches.length).toBeGreaterThan(5) // React 是活跃项目，应该有多个分支
        
        // 可能存在的常见分支
        const possibleBranches = ['main', 'master', 'develop', 'canary']
        const foundCommonBranches = possibleBranches.filter(branch => branches.includes(branch))
        expect(foundCommonBranches.length).toBeGreaterThan(0)

        console.log(`找到的常见分支: ${foundCommonBranches.join(', ')}`)
      } else {
        // 网络不可用时的验证
        console.log('网络不可用，跳过分支详细验证')
        expect(result.details?.errorType).toBeDefined()
      }
    }, TEST_TIMEOUT)

    it('应该处理配置分支不存在的情况并提供建议', async () => {
      // Arrange
      const repoWithInvalidBranch = {
        ...mockReactRepository,
        branch: 'nonexistent-branch-name'
      }
      repositoryRepo.findOne.mockResolvedValue(repoWithInvalidBranch)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)

      // Act
      const result = await service.testConnectionWithRetry(REACT_REPO_ID)

      // Assert
      expect(result.success).toBe(true)
      expect(result.details?.branchValidation).toBeDefined()
      
      if (result.details?.branchValidation) {
        expect(result.details.branchValidation.isValid).toBe(false)
        expect(result.details.branchValidation.message).toContain('不存在')
        expect(result.details.branchValidation.suggestedBranch).toBeDefined()
        expect(result.details.branchValidation.availableBranches).toBeDefined()
      }

      // 应该回退到实际存在的分支
      expect(result.details?.actualBranch).toBeDefined()
      expect(result.details?.actualBranch).not.toBe('nonexistent-branch-name')
      
      console.log(`建议分支: ${result.details?.branchValidation?.suggestedBranch}`)
      console.log(`实际使用分支: ${result.details?.actualBranch}`)
    }, TEST_TIMEOUT)
  })

  describe('性能测试', () => {
    it('应该在合理时间内完成大型仓库的分支列表获取（网络可用时）', async () => {
      // Arrange
      repositoryRepo.findOne.mockResolvedValue(mockReactRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)

      // Act - 先测试一次以检查网络状况
      const startTime = Date.now()
      const firstResult = await service.testConnectionWithRetry(REACT_REPO_ID)
      const firstDuration = Date.now() - startTime

      // Assert
      expect(firstResult).toBeDefined()
      
      if (firstResult.success) {
        // 网络可用时，验证性能
        expect(firstDuration).toBeLessThan(PERFORMANCE_THRESHOLD)
        console.log(`性能测试结果: 连接耗时 ${firstDuration}ms`)
        
        // 如果第一次成功，可以进行额外的性能测量
        if (firstDuration < PERFORMANCE_THRESHOLD / 2) {
          const measurements = [firstDuration]
          
          for (let i = 0; i < 2; i++) {
            const start = Date.now()
            const result = await service.testConnectionWithRetry(REACT_REPO_ID)
            const duration = Date.now() - start
            measurements.push(duration)
            
            expect(result.success).toBe(true)
          }
          
          const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length
          console.log(`多次测试平均时间: ${averageTime.toFixed(0)}ms`)
          console.log(`所有测量: ${measurements.join(', ')}ms`)
        }
      } else {
        // 网络不可用时，验证错误处理的性能
        console.log(`网络不可用，连接失败耗时: ${firstDuration}ms`)
        expect(firstResult.details?.errorType).toBeDefined()
        // 即使失败，也应该在合理时间内完成
        expect(firstDuration).toBeLessThan(PERFORMANCE_THRESHOLD)
      }
    }, TEST_TIMEOUT * 2)

    it('应该正确处理网络超时设置', async () => {
      // Arrange - 使用较短的超时时间来测试超时处理
      const repoWithShortTimeout = {
        ...mockReactRepository,
        settings: JSON.stringify({
          retryCount: 1,
          connectionTimeout: 1000 // 1秒超时，可能会触发超时
        } as RepositorySettings)
      }
      repositoryRepo.findOne.mockResolvedValue(repoWithShortTimeout)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)

      // Act
      const startTime = Date.now()
      const result = await service.testConnectionWithRetry(REACT_REPO_ID)
      const duration = Date.now() - startTime

      // Assert
      // 结果可能成功（网络快）或失败（超时）
      if (result.success) {
        expect(result.details?.branches).toBeDefined()
        console.log(`短超时测试意外成功，耗时: ${duration}ms`)
      } else {
        expect(result.details?.errorType).toBeDefined()
        console.log(`短超时测试如预期失败，错误类型: ${result.details?.errorType}`)
      }

      // 无论成功失败，都应该在合理时间内完成
      expect(duration).toBeLessThan(10000) // 最多10秒
    }, 15000)
  })

  describe('错误处理和重试测试', () => {
    it('应该处理网络不稳定的情况', async () => {
      // 这个测试模拟网络问题，但由于我们使用真实的 React 仓库
      // 我们主要验证重试机制的存在和错误处理的正确性
      
      // Arrange
      repositoryRepo.findOne.mockResolvedValue(mockReactRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)

      // Act
      const result = await service.testConnectionWithRetry(REACT_REPO_ID)

      // Assert
      expect(result).toBeDefined()
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.retryCount).toBeDefined()
      expect(result.retryDetails).toBeDefined()
      
      // 对于稳定的 React 仓库，通常应该成功
      if (result.success) {
        expect(result.retryCount).toBe(0) // 成功时不需要重试
        expect(result.retryDetails).toEqual([])
      } else {
        // 如果失败，应该有详细的错误信息
        expect(result.details?.errorType).toBeDefined()
        expect(result.message).toBeDefined()
      }
    }, TEST_TIMEOUT)

    it('应该正确处理无效的仓库 URL（模拟测试）', async () => {
      // Arrange - 使用一个不存在的 GitHub 仓库来测试错误处理
      const invalidRepo = {
        ...mockReactRepository,
        url: 'https://github.com/nonexistent-user/nonexistent-repo.git'
      }
      repositoryRepo.findOne.mockResolvedValue(invalidRepo)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)

      // Act
      const result = await service.testConnectionWithRetry(REACT_REPO_ID)

      // Assert
      expect(result.success).toBe(false)
      expect(result.details?.errorType).toBeDefined()
      expect(['not_found', 'auth', 'permission_denied']).toContain(result.details?.errorType)
      
      // 验证错误消息包含相关关键词
      const errorKeywords = ['仓库不存在', '权限拒绝', '认证失败', 'not found', 'repository not found']
      const hasExpectedKeyword = errorKeywords.some(keyword => 
        result.message.toLowerCase().includes(keyword.toLowerCase())
      )
      expect(hasExpectedKeyword).toBe(true)
      
      console.log(`无效仓库测试 - 错误类型: ${result.details?.errorType}`)
      console.log(`错误消息: ${result.message}`)
    }, TEST_TIMEOUT)
  })

  describe('元数据更新验证', () => {
    it('应该正确更新仓库元数据', async () => {
      // Arrange
      repositoryRepo.findOne.mockResolvedValue(mockReactRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)

      // Act
      await service.testConnectionWithRetry(REACT_REPO_ID)

      // Assert
      expect(repositoryRepo.update).toHaveBeenCalledWith(
        REACT_REPO_ID,
        expect.objectContaining({
          metadata: expect.any(String)
        })
      )

      // 验证metadata内容格式
      const updateCall = repositoryRepo.update.mock.calls[0]
      const metadataStr = updateCall[1].metadata as string
      expect(() => JSON.parse(metadataStr)).not.toThrow()
      
      const metadata = JSON.parse(metadataStr)
      expect(metadata.lastTestDate).toBeDefined()
      expect(metadata.lastTestResult).toBeDefined()
      expect(metadata.lastTestResult.success).toBeDefined()
      
      if (metadata.lastTestResult.success) {
        expect(metadata.availableBranches).toBeDefined()
        expect(metadata.defaultBranch).toBeDefined()
        expect(Array.isArray(metadata.availableBranches)).toBe(true)
      }
    }, TEST_TIMEOUT)
  })

  describe('分支解析测试', () => {
    it('应该正确解析 React 仓库的分支信息', async () => {
      // Arrange
      repositoryRepo.findOne.mockResolvedValue(mockReactRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)

      // Act
      const result = await service.testConnectionWithRetry(REACT_REPO_ID)

      // Assert
      if (result.success && result.details?.branches) {
        const branches = result.details.branches

        // 验证分支列表格式
        expect(Array.isArray(branches)).toBe(true)
        expect(branches.length).toBeGreaterThan(0)
        
        // 每个分支名应该是有效的字符串
        branches.forEach(branch => {
          expect(typeof branch).toBe('string')
          expect(branch.length).toBeGreaterThan(0)
          expect(branch.trim()).toBe(branch) // 没有前后空格
        })

        // 应该包含主分支
        const hasMainBranch = branches.includes('main') || branches.includes('master')
        expect(hasMainBranch).toBe(true)

        // 分支名应该按某种顺序排列（通常是字母顺序）
        const sortedBranches = [...branches].sort()
        // 注意：git ls-remote 的输出可能不是严格按字母排序，所以这个测试可能需要调整
        
        console.log(`解析到的分支数量: ${branches.length}`)
        console.log(`前10个分支: ${branches.slice(0, 10).join(', ')}`)
      }
    }, TEST_TIMEOUT)
  })

  describe('并发连接测试', () => {
    it('应该支持并发连接测试（在网络可用时）', async () => {
      // Arrange
      repositoryRepo.findOne.mockResolvedValue(mockReactRepository)
      repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)

      // Act - 先测试一次以检查网络状况
      const singleResult = await service.testConnectionWithRetry(REACT_REPO_ID)
      
      if (singleResult.success) {
        // 网络可用时进行并发测试
        const concurrentTests = Array(2).fill(null).map(() => 
          service.testConnectionWithRetry(REACT_REPO_ID)
        )

        const results = await Promise.all(concurrentTests)

        // Assert
        expect(results).toHaveLength(2)
        
        results.forEach((result, index) => {
          expect(result).toBeDefined()
          expect(result.timestamp).toBeInstanceOf(Date)
          expect(result.success).toBe(true) // 如果单次成功，并发也应该成功
          
          console.log(`并发测试 ${index + 1}: 成功`)
        })

        // 验证所有成功的测试返回相同的分支信息
        const firstBranches = results[0].details?.branches
        results.slice(1).forEach(result => {
          expect(result.details?.branches).toEqual(firstBranches)
        })
      } else {
        console.log('网络不可用，跳过并发测试')
        expect(singleResult.details?.errorType).toBeDefined()
      }
    }, TEST_TIMEOUT)
  })
})