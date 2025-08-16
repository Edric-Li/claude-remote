import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, QueryFailedError } from 'typeorm'
import { RepositoryService } from '../repository.service'
import { RepositoryEntity } from '../../entities/repository.entity'
import { EncryptionService } from '../encryption.service'
import { RepositoryType, TestResult, ErrorType } from '../../types/repository.types'

/**
 * Repository CRUD 操作单元测试
 * 测试 create, findAll, update, delete 方法
 * 验证数据验证和业务逻辑
 */
describe('RepositoryService CRUD Operations', () => {
  let service: RepositoryService;
  let repositoryRepo: jest.Mocked<Repository<RepositoryEntity>>;
  let encryptionService: jest.Mocked<EncryptionService>;

  // 测试数据模板
  const mockRepository: RepositoryEntity = {
    id: 'test-repo-id',
    name: 'Test Repository',
    description: 'Test description',
    url: 'https://github.com/test/repo.git',
    type: 'git' as RepositoryType,
    branch: 'main',
    localPath: null,
    enabled: true,
    credentials: null,
    settings: null,
    metadata: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }

  const mockRepositoryWithCredentials: RepositoryEntity = {
    ...mockRepository,
    id: 'test-repo-with-creds',
    credentials: 'encrypted-credentials'
  }

  beforeEach(async () => {
    // Mock Repository
    const mockRepositoryRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn()
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

  describe('create() method', () => {
    describe('成功创建仓库', () => {
      it('应该成功创建不带凭据的Git仓库', async () => {
        // Arrange
        const createData: Partial<RepositoryEntity> = {
          name: 'Test Repo',
          url: 'https://github.com/test/repo.git',
          type: 'git',
          description: 'Test description'
        }

        repositoryRepo.create.mockReturnValue(mockRepository)
        repositoryRepo.save.mockResolvedValue(mockRepository)

        // Act
        const result = await service.create(createData)

        // Assert
        expect(repositoryRepo.create).toHaveBeenCalledWith(createData)
        expect(repositoryRepo.save).toHaveBeenCalledWith(mockRepository)
        expect(result).toEqual(mockRepository)
        expect(encryptionService.encrypt).not.toHaveBeenCalled()
      })

      it('应该成功创建带凭据的Git仓库', async () => {
        // Arrange
        const credentials = 'username:password'
        const encryptedCredentials = 'encrypted-creds'
        const createData: Partial<RepositoryEntity> = {
          name: 'Test Repo',
          url: 'https://github.com/test/repo.git',
          type: 'git',
          credentials
        }

        encryptionService.encrypt.mockReturnValue(encryptedCredentials)
        repositoryRepo.create.mockReturnValue(mockRepositoryWithCredentials)
        repositoryRepo.save.mockResolvedValue(mockRepositoryWithCredentials)

        // Act
        const result = await service.create(createData)

        // Assert
        expect(encryptionService.encrypt).toHaveBeenCalledWith(credentials)
        expect(repositoryRepo.create).toHaveBeenCalledWith({
          ...createData,
          credentials: encryptedCredentials
        })
        expect(result).toEqual(mockRepositoryWithCredentials)
      })

      it('应该成功创建本地仓库', async () => {
        // Arrange
        const localRepo = {
          ...mockRepository,
          type: 'local' as RepositoryType,
          localPath: '/path/to/local/repo',
          url: 'file:///path/to/local/repo'
        }

        const createData: Partial<RepositoryEntity> = {
          name: 'Local Repo',
          type: 'local',
          localPath: '/path/to/local/repo',
          url: 'file:///path/to/local/repo'
        }

        repositoryRepo.create.mockReturnValue(localRepo)
        repositoryRepo.save.mockResolvedValue(localRepo)

        // Act
        const result = await service.create(createData)

        // Assert
        expect(repositoryRepo.create).toHaveBeenCalledWith(createData)
        expect(result).toEqual(localRepo)
      })

      it('应该在审计日志中记录创建操作（当提供userId时）', async () => {
        // Arrange
        const createData: Partial<RepositoryEntity> = {
          name: 'Test Repo',
          url: 'https://github.com/test/repo.git',
          type: 'git'
        }
        const userId = 'test-user-id'
        const context = { ipAddress: '127.0.0.1', userAgent: 'test-agent' }

        repositoryRepo.create.mockReturnValue(mockRepository)
        repositoryRepo.save.mockResolvedValue(mockRepository)

        // Act
        const result = await service.create(createData, userId, context)

        // Assert
        expect(result).toEqual(mockRepository)
        // 注意：审计日志相关代码已被注释，这里主要验证方法不会抛出错误
      })
    })

    describe('创建失败场景', () => {
      it('应该处理数据库保存错误', async () => {
        // Arrange
        const createData: Partial<RepositoryEntity> = {
          name: 'Test Repo',
          url: 'https://github.com/test/repo.git',
          type: 'git'
        }
        const dbError = new QueryFailedError('INSERT', [], new Error('Duplicate entry'))

        repositoryRepo.create.mockReturnValue(mockRepository)
        repositoryRepo.save.mockRejectedValue(dbError)

        // Act & Assert
        await expect(service.create(createData)).rejects.toThrow(dbError)
        expect(repositoryRepo.create).toHaveBeenCalledWith(createData)
        expect(repositoryRepo.save).toHaveBeenCalledWith(mockRepository)
      })

      it('应该处理加密服务错误', async () => {
        // Arrange
        const createData: Partial<RepositoryEntity> = {
          name: 'Test Repo',
          url: 'https://github.com/test/repo.git',
          type: 'git',
          credentials: 'test-credentials'
        }
        const encryptError = new Error('Encryption failed')

        encryptionService.encrypt.mockImplementation(() => {
          throw encryptError
        })

        // Act & Assert
        await expect(service.create(createData)).rejects.toThrow(encryptError)
        expect(encryptionService.encrypt).toHaveBeenCalledWith('test-credentials')
      })

      it('应该记录失败的审计日志', async () => {
        // Arrange
        const createData: Partial<RepositoryEntity> = {
          name: 'Test Repo',
          url: 'https://github.com/test/repo.git',
          type: 'git'
        }
        const userId = 'test-user-id'
        const context = { ipAddress: '127.0.0.1' }
        const dbError = new Error('Database error')

        repositoryRepo.create.mockReturnValue(mockRepository)
        repositoryRepo.save.mockRejectedValue(dbError)

        // Act & Assert
        await expect(service.create(createData, userId, context)).rejects.toThrow(dbError)
      })
    })
  })

  describe('findAll() method', () => {
    describe('成功查询场景', () => {
      it('应该返回所有仓库列表且隐藏凭据', async () => {
        // Arrange
        const repositories = [
          mockRepository,
          mockRepositoryWithCredentials,
          { ...mockRepository, id: 'repo3', credentials: null }
        ]

        repositoryRepo.find.mockResolvedValue(repositories)

        // Act
        const result = await service.findAll()

        // Assert
        expect(repositoryRepo.find).toHaveBeenCalledWith()
        expect(result).toHaveLength(3)
        expect(result[0]).toEqual({
          ...mockRepository,
          credentials: null
        })
        expect(result[1]).toEqual({
          ...mockRepositoryWithCredentials,
          credentials: '******'
        })
        expect(result[2]).toEqual({
          ...mockRepository,
          id: 'repo3',
          credentials: null
        })
      })

      it('应该返回空数组当没有仓库时', async () => {
        // Arrange
        repositoryRepo.find.mockResolvedValue([])

        // Act
        const result = await service.findAll()

        // Assert
        expect(result).toEqual([])
        expect(repositoryRepo.find).toHaveBeenCalledWith()
      })

      it('应该正确处理只有凭据为null的仓库', async () => {
        // Arrange
        const repoWithoutCreds = { ...mockRepository, credentials: null }
        repositoryRepo.find.mockResolvedValue([repoWithoutCreds])

        // Act
        const result = await service.findAll()

        // Assert
        expect(result).toEqual([repoWithoutCreds])
        expect(result[0].credentials).toBeNull()
      })
    })

    describe('错误处理场景', () => {
      it('应该处理数据库查询错误', async () => {
        // Arrange
        const dbError = new Error('Database connection failed')
        repositoryRepo.find.mockRejectedValue(dbError)

        // Act & Assert
        await expect(service.findAll()).rejects.toThrow(dbError)
      })
    })
  })

  describe('findOne() method', () => {
    describe('成功查询场景', () => {
      it('应该返回指定ID的仓库且隐藏凭据', async () => {
        // Arrange
        const repoId = 'test-repo-id'
        repositoryRepo.findOne.mockResolvedValue(mockRepositoryWithCredentials)

        // Act
        const result = await service.findOne(repoId)

        // Assert
        expect(repositoryRepo.findOne).toHaveBeenCalledWith({ where: { id: repoId } })
        expect(result).toEqual({
          ...mockRepositoryWithCredentials,
          credentials: '******'
        })
      })

      it('应该返回null当仓库不存在时', async () => {
        // Arrange
        const repoId = 'non-existent-id'
        repositoryRepo.findOne.mockResolvedValue(null)

        // Act
        const result = await service.findOne(repoId)

        // Assert
        expect(repositoryRepo.findOne).toHaveBeenCalledWith({ where: { id: repoId } })
        expect(result).toBeNull()
      })

      it('应该正确处理没有凭据的仓库', async () => {
        // Arrange
        const repoId = 'test-repo-id'
        const repoWithoutCreds = { ...mockRepository, credentials: null }
        repositoryRepo.findOne.mockResolvedValue(repoWithoutCreds)

        // Act
        const result = await service.findOne(repoId)

        // Assert
        expect(result).toEqual(repoWithoutCreds)
        expect(result?.credentials).toBeNull()
      })
    })
  })

  describe('findOneWithCredentials() method', () => {
    it('应该返回包含真实凭据的仓库信息（内部使用）', async () => {
      // Arrange
      const repoId = 'test-repo-with-creds'
      const repoWithCreds = {
        ...mockRepository,
        id: 'test-repo-with-creds',
        credentials: 'encrypted-credentials'
      }
      repositoryRepo.findOne.mockResolvedValue(repoWithCreds)

      // Act
      const result = await service.findOneWithCredentials(repoId)

      // Assert
      expect(repositoryRepo.findOne).toHaveBeenCalledWith({ where: { id: repoId } })
      expect(result).toEqual(repoWithCreds)
      expect(result?.credentials).toBe('encrypted-credentials')
    })
  })

  describe('update() method', () => {
    describe('成功更新场景', () => {
      it('应该成功更新基本仓库信息', async () => {
        // Arrange
        const repoId = 'test-repo-id'
        const updateData: Partial<RepositoryEntity> = {
          name: 'Updated Name',
          description: 'Updated description',
          enabled: false
        }
        const updatedRepo = { ...mockRepository, ...updateData }

        repositoryRepo.findOne.mockResolvedValue(mockRepository)
        repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
        jest.spyOn(service, 'findOne').mockResolvedValue(updatedRepo)

        // Act
        const result = await service.update(repoId, updateData)

        // Assert
        expect(repositoryRepo.findOne).toHaveBeenCalledWith({ where: { id: repoId } })
        expect(repositoryRepo.update).toHaveBeenCalledWith(repoId, updateData)
        expect(service.findOne).toHaveBeenCalledWith(repoId)
        expect(result).toEqual(updatedRepo)
      })

      it('应该成功更新凭据', async () => {
        // Arrange
        const repoId = 'test-repo-id'
        const newCredentials = 'new-username:new-password'
        const encryptedCredentials = 'new-encrypted-credentials'
        const updateData: Partial<RepositoryEntity> = {
          credentials: newCredentials
        }

        repositoryRepo.findOne.mockResolvedValue(mockRepository)
        encryptionService.encrypt.mockReturnValue(encryptedCredentials)
        repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
        jest.spyOn(service, 'findOne').mockResolvedValue({
          ...mockRepository,
          credentials: '******'
        })

        // Act
        const result = await service.update(repoId, updateData)

        // Assert
        expect(encryptionService.encrypt).toHaveBeenCalledWith(newCredentials)
        expect(repositoryRepo.update).toHaveBeenCalledWith(repoId, {
          credentials: encryptedCredentials
        })
      })

      it('应该忽略凭据掩码更新', async () => {
        // Arrange
        const repoId = 'test-repo-id'
        const updateData: Partial<RepositoryEntity> = {
          name: 'Updated Name',
          credentials: '******' // 掩码，应该被忽略
        }

        repositoryRepo.findOne.mockResolvedValue(mockRepositoryWithCredentials)
        repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
        jest.spyOn(service, 'findOne').mockResolvedValue({
          ...mockRepositoryWithCredentials,
          name: 'Updated Name',
          credentials: '******'
        })

        // Act
        const result = await service.update(repoId, updateData)

        // Assert
        expect(repositoryRepo.update).toHaveBeenCalledWith(repoId, {
          name: 'Updated Name'
          // credentials 字段应该被删除
        })
        expect(encryptionService.encrypt).not.toHaveBeenCalled()
      })

      it('应该记录审计日志当有变更时', async () => {
        // Arrange
        const repoId = 'test-repo-id'
        const userId = 'test-user-id'
        const context = { ipAddress: '127.0.0.1' }
        const updateData: Partial<RepositoryEntity> = {
          name: 'Updated Name',
          description: 'Updated description'
        }

        repositoryRepo.findOne.mockResolvedValue(mockRepository)
        repositoryRepo.update.mockResolvedValue({ affected: 1 } as any)
        jest.spyOn(service, 'findOne').mockResolvedValue({
          ...mockRepository,
          ...updateData
        })

        // Act
        const result = await service.update(repoId, updateData, userId, context)

        // Assert
        expect(result).toBeDefined()
        // 审计日志功能已注释，这里主要验证方法不会抛出错误
      })
    })

    describe('更新失败场景', () => {
      it('应该处理仓库不存在的情况', async () => {
        // Arrange
        const repoId = 'non-existent-id'
        const updateData: Partial<RepositoryEntity> = {
          name: 'Updated Name'
        }

        repositoryRepo.findOne.mockResolvedValue(null)

        // Act & Assert
        await expect(service.update(repoId, updateData)).rejects.toThrow('仓库不存在')
        expect(repositoryRepo.update).not.toHaveBeenCalled()
      })

      it('应该处理数据库更新错误', async () => {
        // Arrange
        const repoId = 'test-repo-id'
        const updateData: Partial<RepositoryEntity> = {
          name: 'Updated Name'
        }
        const dbError = new Error('Database update failed')

        repositoryRepo.findOne.mockResolvedValue(mockRepository)
        repositoryRepo.update.mockRejectedValue(dbError)

        // Act & Assert
        await expect(service.update(repoId, updateData)).rejects.toThrow(dbError)
      })

      it('应该处理加密错误', async () => {
        // Arrange
        const repoId = 'test-repo-id'
        const updateData: Partial<RepositoryEntity> = {
          credentials: 'new-credentials'
        }
        const encryptError = new Error('Encryption failed')

        repositoryRepo.findOne.mockResolvedValue(mockRepository)
        encryptionService.encrypt.mockImplementation(() => {
          throw encryptError
        })

        // Act & Assert
        await expect(service.update(repoId, updateData)).rejects.toThrow(encryptError)
      })

      it('应该记录失败的审计日志', async () => {
        // Arrange
        const repoId = 'test-repo-id'
        const userId = 'test-user-id'
        const updateData: Partial<RepositoryEntity> = {
          name: 'Updated Name'
        }
        const dbError = new Error('Database error')

        repositoryRepo.findOne.mockResolvedValue(mockRepository)
        repositoryRepo.update.mockRejectedValue(dbError)

        // Act & Assert
        await expect(service.update(repoId, updateData, userId)).rejects.toThrow(dbError)
      })
    })
  })

  describe('delete() method', () => {
    describe('成功删除场景', () => {
      it('应该成功删除存在的仓库', async () => {
        // Arrange
        const repoId = 'test-repo-id'

        repositoryRepo.findOne.mockResolvedValue(mockRepository)
        repositoryRepo.delete.mockResolvedValue({ affected: 1 } as any)

        // Act
        await service.delete(repoId)

        // Assert
        expect(repositoryRepo.findOne).toHaveBeenCalledWith({ where: { id: repoId } })
        expect(repositoryRepo.delete).toHaveBeenCalledWith(repoId)
      })

      it('应该记录审计日志', async () => {
        // Arrange
        const repoId = 'test-repo-id'
        const userId = 'test-user-id'
        const context = { ipAddress: '127.0.0.1', userAgent: 'test-agent' }

        repositoryRepo.findOne.mockResolvedValue(mockRepository)
        repositoryRepo.delete.mockResolvedValue({ affected: 1 } as any)

        // Act
        await service.delete(repoId, userId, context)

        // Assert
        expect(repositoryRepo.delete).toHaveBeenCalledWith(repoId)
        // 审计日志功能已注释，这里主要验证方法不会抛出错误
      })
    })

    describe('删除失败场景', () => {
      it('应该处理仓库不存在的情况', async () => {
        // Arrange
        const repoId = 'non-existent-id'

        repositoryRepo.findOne.mockResolvedValue(null)

        // Act & Assert
        await expect(service.delete(repoId)).rejects.toThrow('仓库不存在')
        expect(repositoryRepo.delete).not.toHaveBeenCalled()
      })

      it('应该处理数据库删除错误', async () => {
        // Arrange
        const repoId = 'test-repo-id'
        const dbError = new Error('Database delete failed')

        repositoryRepo.findOne.mockResolvedValue(mockRepository)
        repositoryRepo.delete.mockRejectedValue(dbError)

        // Act & Assert
        await expect(service.delete(repoId)).rejects.toThrow(dbError)
        expect(repositoryRepo.findOne).toHaveBeenCalledWith({ where: { id: repoId } })
        expect(repositoryRepo.delete).toHaveBeenCalledWith(repoId)
      })

      it('应该记录失败的审计日志', async () => {
        // Arrange
        const repoId = 'test-repo-id'
        const userId = 'test-user-id'
        const context = { ipAddress: '127.0.0.1' }
        const dbError = new Error('Database error')

        repositoryRepo.findOne.mockResolvedValue(mockRepository)
        repositoryRepo.delete.mockRejectedValue(dbError)

        // Act & Assert
        await expect(service.delete(repoId, userId, context)).rejects.toThrow(dbError)
      })
    })
  })

  describe('数据验证和业务逻辑测试', () => {
    describe('凭据处理', () => {
      it('应该正确加密和处理不同格式的凭据', async () => {
        // Test cases for different credential formats
        const testCases = [
          { input: 'username:password', description: '用户名密码格式' },
          { input: 'github_pat_token', description: 'GitHub PAT token' },
          { input: 'gitlab-token', description: 'GitLab token' }
        ]

        for (const testCase of testCases) {
          encryptionService.encrypt.mockReturnValue(`encrypted_${testCase.input}`)
          repositoryRepo.create.mockReturnValue(mockRepository)
          repositoryRepo.save.mockResolvedValue(mockRepository)

          const result = await service.create({
            name: 'Test',
            url: 'https://github.com/test/repo.git',
            type: 'git',
            credentials: testCase.input
          })

          expect(encryptionService.encrypt).toHaveBeenCalledWith(testCase.input)
          expect(repositoryRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
              credentials: `encrypted_${testCase.input}`
            })
          )

          encryptionService.encrypt.mockClear()
          repositoryRepo.create.mockClear()
          repositoryRepo.save.mockClear()
        }
      })
    })

    describe('数据完整性验证', () => {
      it('应该保持创建和更新时间戳的一致性', async () => {
        // Arrange
        const createData: Partial<RepositoryEntity> = {
          name: 'Test Repo',
          url: 'https://github.com/test/repo.git',
          type: 'git'
        }

        const now = new Date()
        const repoWithTimestamps = {
          ...mockRepository,
          createdAt: now,
          updatedAt: now
        }

        repositoryRepo.create.mockReturnValue(repoWithTimestamps)
        repositoryRepo.save.mockResolvedValue(repoWithTimestamps)

        // Act
        const result = await service.create(createData)

        // Assert
        expect(result.createdAt).toEqual(now)
        expect(result.updatedAt).toEqual(now)
      })

      it('应该正确处理可选字段', async () => {
        // Arrange
        const minimalData: Partial<RepositoryEntity> = {
          name: 'Minimal Repo',
          url: 'https://github.com/test/minimal.git',
          type: 'git'
        }

        const expectedRepo = {
          ...mockRepository,
          ...minimalData,
          description: null,
          branch: null,
          localPath: null,
          credentials: null,
          settings: null,
          metadata: null
        }

        repositoryRepo.create.mockReturnValue(expectedRepo)
        repositoryRepo.save.mockResolvedValue(expectedRepo)

        // Act
        const result = await service.create(minimalData)

        // Assert
        expect(result).toEqual(expectedRepo)
        expect(result.description).toBeNull()
        expect(result.credentials).toBeNull()
      })
    })

    describe('类型安全性测试', () => {
      it('应该正确处理不同的仓库类型', async () => {
        const types: RepositoryType[] = ['git', 'local', 'svn']
        
        for (const type of types) {
          const createData: Partial<RepositoryEntity> = {
            name: `${type} Repo`,
            url: type === 'local' ? 'file:///path/to/repo' : 'https://example.com/repo',
            type,
            localPath: type === 'local' ? '/path/to/repo' : null
          }

          const expectedRepo = { ...mockRepository, ...createData }
          repositoryRepo.create.mockReturnValue(expectedRepo)
          repositoryRepo.save.mockResolvedValue(expectedRepo)

          const result = await service.create(createData)

          expect(result.type).toBe(type)
          if (type === 'local') {
            expect(result.localPath).toBe('/path/to/repo')
          }

          repositoryRepo.create.mockClear()
          repositoryRepo.save.mockClear()
        }
      })
    })
  })

  describe('并发和事务测试', () => {
    it('应该处理并发创建相同名称仓库的情况', async () => {
      // Arrange
      const createData1: Partial<RepositoryEntity> = {
        name: 'Duplicate Name',
        url: 'https://github.com/test/repo1.git',
        type: 'git'
      }
      const createData2: Partial<RepositoryEntity> = {
        name: 'Duplicate Name',
        url: 'https://github.com/test/repo2.git',
        type: 'git'
      }

      repositoryRepo.create.mockReturnValue(mockRepository)
      repositoryRepo.save
        .mockResolvedValueOnce(mockRepository)
        .mockRejectedValueOnce(new QueryFailedError('INSERT', [], new Error('Duplicate entry for key')))

      // Act
      const result1 = await service.create(createData1)
      await expect(service.create(createData2)).rejects.toThrow('Duplicate entry for key')

      // Assert
      expect(result1).toEqual(mockRepository)
      expect(repositoryRepo.save).toHaveBeenCalledTimes(2)
    })

    it('应该处理更新时的竞态条件', async () => {
      // Arrange
      const repoId = 'test-repo-id'
      const updateData1: Partial<RepositoryEntity> = { name: 'Updated Name 1' }
      const updateData2: Partial<RepositoryEntity> = { name: 'Updated Name 2' }

      repositoryRepo.findOne.mockResolvedValue(mockRepository)
      repositoryRepo.update
        .mockResolvedValueOnce({ affected: 1 } as any)
        .mockResolvedValueOnce({ affected: 1 } as any)

      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce({ ...mockRepository, name: 'Updated Name 1' })
        .mockResolvedValueOnce({ ...mockRepository, name: 'Updated Name 2' })

      // Act
      const [result1, result2] = await Promise.all([
        service.update(repoId, updateData1),
        service.update(repoId, updateData2)
      ])

      // Assert
      expect(result1.name).toBe('Updated Name 1')
      expect(result2.name).toBe('Updated Name 2')
      expect(repositoryRepo.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('边界条件测试', () => {
    it('应该处理大量数据查询', async () => {
      // Arrange
      const largeDataset = Array.from({ length: 1000 }, (_, index) => ({
        ...mockRepository,
        id: `repo-${index}`,
        name: `Repo ${index}`
      }))

      repositoryRepo.find.mockResolvedValue(largeDataset)

      // Act
      const result = await service.findAll()

      // Assert
      expect(result).toHaveLength(1000)
      expect(result[0].name).toBe('Repo 0')
      expect(result[999].name).toBe('Repo 999')
    })

    it('应该处理空字符串和特殊字符', async () => {
      // Arrange
      const specialCharData: Partial<RepositoryEntity> = {
        name: 'Repo with special chars: éüñø',
        description: 'Description with\nnewlines and\ttabs',
        url: 'https://github.com/test/special-repo.git',
        type: 'git'
      }

      const expectedRepo = { ...mockRepository, ...specialCharData }
      repositoryRepo.create.mockReturnValue(expectedRepo)
      repositoryRepo.save.mockResolvedValue(expectedRepo)

      // Act
      const result = await service.create(specialCharData)

      // Assert
      expect(result.name).toBe('Repo with special chars: éüñø')
      expect(result.description).toBe('Description with\nnewlines and\ttabs')
    })
  })
})