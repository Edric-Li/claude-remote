import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import request from 'supertest'
import { JwtService } from '@nestjs/jwt'
import { RepositoryController } from '../repository.controller'
import { RepositoryService } from '../../services/repository.service'
import { SearchPaginationService } from '../../services/search-pagination.service'
import { RepositoryEntity } from '../../entities/repository.entity'
import { EncryptionService } from '../../services/encryption.service'
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard'
import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator'
import { CreateRepositoryDto, UpdateRepositoryDto, TestRepositoryDto } from '../../dto/repository.dto'
import { PaginatedResult, TestResult, RepositoryType } from '../../types/repository.types'

/**
 * Repository Controller API 集成测试
 * 
 * 测试覆盖范围：
 * - 所有 API 端点的请求响应
 * - JWT 认证和权限控制
 * - 错误处理和状态码
 * - 请求数据验证
 * - 业务逻辑正确性
 */
describe('RepositoryController Integration Tests', () => {
  let app: INestApplication
  let repositoryService: jest.Mocked<RepositoryService>
  let searchPaginationService: jest.Mocked<SearchPaginationService>
  let jwtService: JwtService
  let validToken: string
  let invalidToken: string

  // 测试数据
  const mockUser = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com'
  }

  const mockRepository: RepositoryEntity = {
    id: 'test-repo-id',
    name: 'Test Repository',
    description: 'Test repository description',
    url: 'https://github.com/test/repo.git',
    type: 'git',
    branch: 'main',
    localPath: null,
    enabled: true,
    credentials: null,
    settings: JSON.stringify({
      retryCount: 3,
      connectionTimeout: 10000,
      autoUpdate: false
    }),
    metadata: JSON.stringify({
      lastTestDate: new Date().toISOString(),
      lastTestResult: { success: true },
      availableBranches: ['main', 'develop'],
      defaultBranch: 'main'
    }),
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const createRepositoryDto: CreateRepositoryDto = {
    name: 'New Repository',
    description: 'New repository description',
    url: 'https://github.com/test/new-repo.git',
    type: 'git',
    branch: 'main',
    enabled: true,
    settings: {
      retryCount: 3,
      connectionTimeout: 10000
    }
  }

  const updateRepositoryDto: UpdateRepositoryDto = {
    name: 'Updated Repository',
    description: 'Updated description',
    enabled: false
  }

  const testRepositoryDto: TestRepositoryDto = {
    url: 'https://github.com/test/test-repo.git',
    type: 'git',
    credentials: 'test-credentials'
  }

  beforeAll(async () => {
    // 创建测试模块
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RepositoryController],
      providers: [
        {
          provide: RepositoryService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            testConfig: jest.fn(),
            testConfigWithRetry: jest.fn(),
            testConnection: jest.fn(),
            testConnectionWithRetry: jest.fn(),
            getBranches: jest.fn(),
            createWorkspace: jest.fn(),
            cloneRepository: jest.fn(),
            batchRetryTest: jest.fn(),
            getRetryStatistics: jest.fn(),
            getDefaultRetryConfig: jest.fn(),
            updateDefaultRetryConfig: jest.fn(),
            advancedSearch: jest.fn(),
            searchPaginated: jest.fn(),
            findAllPaginated: jest.fn(),
            batchValidateRepositories: jest.fn(),
            getPaginationConfig: jest.fn(),
            getRecentRepositories: jest.fn()
          }
        },
        {
          provide: SearchPaginationService,
          useValue: {
            searchRepositories: jest.fn(),
            getPaginatedList: jest.fn(),
            getSearchSuggestions: jest.fn(),
            getSearchStatistics: jest.fn(),
            fullTextSearch: jest.fn(),
            fuzzySearch: jest.fn()
          }
        },
        {
          provide: getRepositoryToken(RepositoryEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
          }
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn(),
            decrypt: jest.fn()
          }
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn()
          }
        }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn((context) => {
          const request = context.switchToHttp().getRequest()
          const authHeader = request.headers.authorization
          
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return false
          }
          
          const token = authHeader.split(' ')[1]
          if (token === validToken) {
            // 模拟有效用户
            request.user = mockUser
            return true
          }
          
          return false
        })
      })
      .compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    await app.init()

    repositoryService = moduleRef.get(RepositoryService)
    searchPaginationService = moduleRef.get(SearchPaginationService)
    jwtService = moduleRef.get(JwtService)

    // 生成测试用的 JWT token
    validToken = 'valid-jwt-token'
    invalidToken = 'invalid-jwt-token'
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('认证和权限控制', () => {
    it('应该拒绝没有 Authorization 头的请求', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/repositories')
        .expect(401)

      expect(response.body).toHaveProperty('statusCode', 401)
    })

    it('应该拒绝无效的 JWT token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/repositories')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401)

      expect(response.body).toHaveProperty('statusCode', 401)
    })

    it('应该接受有效的 JWT token', async () => {
      repositoryService.findAll.mockResolvedValue([mockRepository])

      const response = await request(app.getHttpServer())
        .get('/api/repositories')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual([mockRepository])
    })
  })

  describe('GET /api/repositories - 获取所有仓库', () => {
    it('应该返回所有仓库列表', async () => {
      const repositories = [mockRepository]
      repositoryService.findAll.mockResolvedValue(repositories)

      const response = await request(app.getHttpServer())
        .get('/api/repositories')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual(repositories)
      expect(repositoryService.findAll).toHaveBeenCalledTimes(1)
    })

    it('应该处理空仓库列表', async () => {
      repositoryService.findAll.mockResolvedValue([])

      const response = await request(app.getHttpServer())
        .get('/api/repositories')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual([])
    })

    it('应该处理服务错误', async () => {
      repositoryService.findAll.mockRejectedValue(new Error('Database error'))

      await request(app.getHttpServer())
        .get('/api/repositories')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500)
    })
  })

  describe('GET /api/repositories/search - 搜索仓库', () => {
    const mockSearchResult: PaginatedResult<RepositoryEntity> = {
      data: [mockRepository],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false
    }

    it('应该返回搜索结果', async () => {
      searchPaginationService.searchRepositories.mockResolvedValue(mockSearchResult)

      const response = await request(app.getHttpServer())
        .get('/api/repositories/search')
        .query({ query: 'test', page: 1, limit: 20 })
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual(mockSearchResult)
      expect(searchPaginationService.searchRepositories).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
        searchCriteria: {
          query: 'test',
          type: undefined,
          enabled: undefined
        }
      })
    })

    it('应该支持类型过滤', async () => {
      searchPaginationService.searchRepositories.mockResolvedValue(mockSearchResult)

      await request(app.getHttpServer())
        .get('/api/repositories/search')
        .query({ query: 'test', type: 'git' })
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(searchPaginationService.searchRepositories).toHaveBeenCalledWith(
        expect.objectContaining({
          searchCriteria: expect.objectContaining({
            type: 'git'
          })
        })
      )
    })

    it('应该支持启用状态过滤', async () => {
      searchPaginationService.searchRepositories.mockResolvedValue(mockSearchResult)

      await request(app.getHttpServer())
        .get('/api/repositories/search')
        .query({ enabled: 'true' })
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(searchPaginationService.searchRepositories).toHaveBeenCalledWith(
        expect.objectContaining({
          searchCriteria: expect.objectContaining({
            enabled: true
          })
        })
      )
    })
  })

  describe('GET /api/repositories/paginated - 分页查询', () => {
    it('应该返回分页数据', async () => {
      const mockPaginatedResult: PaginatedResult<RepositoryEntity> = {
        data: [mockRepository],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }
      searchPaginationService.getPaginatedList.mockResolvedValue(mockPaginatedResult)

      const response = await request(app.getHttpServer())
        .get('/api/repositories/paginated')
        .query({ page: 1, limit: 20 })
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual(mockPaginatedResult)
      expect(searchPaginationService.getPaginatedList).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: 'updatedAt',
        sortOrder: 'DESC'
      })
    })

    it('应该使用默认分页参数', async () => {
      const mockPaginatedResult: PaginatedResult<RepositoryEntity> = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
      searchPaginationService.getPaginatedList.mockResolvedValue(mockPaginatedResult)

      await request(app.getHttpServer())
        .get('/api/repositories/paginated')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(searchPaginationService.getPaginatedList).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: 'updatedAt',
        sortOrder: 'DESC'
      })
    })
  })

  describe('POST /api/repositories - 创建仓库', () => {
    it('应该创建新仓库', async () => {
      const createdRepository: RepositoryEntity = { ...mockRepository, ...createRepositoryDto, settings: JSON.stringify(createRepositoryDto.settings) }
      repositoryService.create.mockResolvedValue(createdRepository)

      const response = await request(app.getHttpServer())
        .post('/api/repositories')
        .send(createRepositoryDto)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(201)

      expect(response.body).toEqual(createdRepository)
      expect(repositoryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: createRepositoryDto.name,
          url: createRepositoryDto.url,
          type: createRepositoryDto.type,
          settings: JSON.stringify(createRepositoryDto.settings)
        }),
        mockUser.id,
        expect.objectContaining({
          ipAddress: expect.any(String),
          userAgent: expect.any(String)
        })
      )
    })

    it('应该验证必填字段', async () => {
      const invalidData = { name: '', url: 'invalid-url' }

      await request(app.getHttpServer())
        .post('/api/repositories')
        .send(invalidData)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400)
    })

    it('应该验证 URL 格式', async () => {
      const invalidData = {
        ...createRepositoryDto,
        url: 'invalid-url-format'
      }

      await request(app.getHttpServer())
        .post('/api/repositories')
        .send(invalidData)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400)
    })

    it('应该验证仓库类型', async () => {
      const invalidData = {
        ...createRepositoryDto,
        type: 'invalid-type' as any
      }

      await request(app.getHttpServer())
        .post('/api/repositories')
        .send(invalidData)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400)
    })
  })

  describe('GET /api/repositories/:id - 获取单个仓库', () => {
    it('应该返回指定的仓库', async () => {
      repositoryService.findOne.mockResolvedValue(mockRepository)

      const response = await request(app.getHttpServer())
        .get(`/api/repositories/${mockRepository.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual(mockRepository)
      expect(repositoryService.findOne).toHaveBeenCalledWith(mockRepository.id)
    })

    it('应该处理仓库不存在的情况', async () => {
      repositoryService.findOne.mockResolvedValue(null)

      await request(app.getHttpServer())
        .get('/api/repositories/non-existent-id')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404)
    })
  })

  describe('PUT /api/repositories/:id - 更新仓库', () => {
    it('应该更新仓库信息', async () => {
      const updatedRepository: RepositoryEntity = { 
        ...mockRepository, 
        ...updateRepositoryDto,
        settings: updateRepositoryDto.settings ? JSON.stringify(updateRepositoryDto.settings) : mockRepository.settings
      }
      repositoryService.update.mockResolvedValue(updatedRepository)

      const response = await request(app.getHttpServer())
        .put(`/api/repositories/${mockRepository.id}`)
        .send(updateRepositoryDto)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual(updatedRepository)
      expect(repositoryService.update).toHaveBeenCalledWith(
        mockRepository.id,
        expect.objectContaining(updateRepositoryDto),
        mockUser.id,
        expect.objectContaining({
          ipAddress: expect.any(String),
          userAgent: expect.any(String)
        })
      )
    })

    it('应该处理仓库不存在的情况', async () => {
      repositoryService.update.mockRejectedValue(new Error('Repository not found'))

      await request(app.getHttpServer())
        .put('/api/repositories/non-existent-id')
        .send(updateRepositoryDto)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404)
    })

    it('应该验证更新数据', async () => {
      const invalidData = { name: '' } // 空名称

      await request(app.getHttpServer())
        .put(`/api/repositories/${mockRepository.id}`)
        .send(invalidData)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400)
    })
  })

  describe('DELETE /api/repositories/:id - 删除仓库', () => {
    it('应该删除仓库', async () => {
      repositoryService.delete.mockResolvedValue(undefined)

      const response = await request(app.getHttpServer())
        .delete(`/api/repositories/${mockRepository.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        message: '仓库删除成功'
      })
      expect(repositoryService.delete).toHaveBeenCalledWith(
        mockRepository.id,
        mockUser.id,
        expect.objectContaining({
          ipAddress: expect.any(String),
          userAgent: expect.any(String)
        })
      )
    })

    it('应该处理仓库不存在的情况', async () => {
      repositoryService.delete.mockRejectedValue(new Error('Repository not found'))

      await request(app.getHttpServer())
        .delete('/api/repositories/non-existent-id')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404)
    })
  })

  describe('POST /api/repositories/test-config - 测试配置', () => {
    const mockTestResult: TestResult = {
      success: true,
      message: '连接成功',
      timestamp: new Date(),
      details: {
        isGitRepo: true,
        branches: ['main', 'develop'],
        defaultBranch: 'main'
      }
    }

    it('应该测试仓库配置', async () => {
      repositoryService.testConfig.mockResolvedValue(mockTestResult)

      const response = await request(app.getHttpServer())
        .post('/api/repositories/test-config')
        .send(testRepositoryDto)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual(mockTestResult)
      expect(repositoryService.testConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          url: testRepositoryDto.url,
          type: testRepositoryDto.type,
          credentials: testRepositoryDto.credentials
        })
      )
    })

    it('应该处理连接失败', async () => {
      const failedResult: TestResult = {
        success: false,
        message: '连接失败',
        timestamp: new Date(),
        details: { errorType: 'timeout' }
      }
      repositoryService.testConfig.mockResolvedValue(failedResult)

      const response = await request(app.getHttpServer())
        .post('/api/repositories/test-config')
        .send(testRepositoryDto)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual(failedResult)
    })

    it('应该验证测试数据', async () => {
      const invalidData = { url: 'invalid-url', type: 'invalid' }

      await request(app.getHttpServer())
        .post('/api/repositories/test-config')
        .send(invalidData)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400)
    })
  })

  describe('POST /api/repositories/test-config-with-retry - 带重试的测试配置', () => {
    const mockRetryResult: TestResult = {
      success: true,
      message: '连接成功',
      timestamp: new Date(),
      retryCount: 1,
      retryDetails: [
        { attempt: 1, error: '第一次尝试失败', duration: 1000, timestamp: new Date() },
        { attempt: 2, error: '第二次尝试成功', duration: 2000, timestamp: new Date() }
      ],
      details: {
        isGitRepo: true,
        branches: ['main'],
        defaultBranch: 'main'
      }
    }

    it('应该执行带重试的配置测试', async () => {
      repositoryService.testConfigWithRetry.mockResolvedValue(mockRetryResult)

      const requestBody = {
        data: testRepositoryDto,
        retryConfig: {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 5000
        }
      }

      const response = await request(app.getHttpServer())
        .post('/api/repositories/test-config-with-retry')
        .send(requestBody)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual(mockRetryResult)
      expect(repositoryService.testConfigWithRetry).toHaveBeenCalledWith(
        expect.objectContaining(testRepositoryDto),
        requestBody.retryConfig
      )
    })

    it('应该使用默认重试配置', async () => {
      repositoryService.testConfigWithRetry.mockResolvedValue(mockRetryResult)

      const requestBody = { data: testRepositoryDto }

      await request(app.getHttpServer())
        .post('/api/repositories/test-config-with-retry')
        .send(requestBody)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(repositoryService.testConfigWithRetry).toHaveBeenCalledWith(
        expect.objectContaining(testRepositoryDto),
        undefined
      )
    })
  })

  describe('POST /api/repositories/:id/test - 测试现有仓库连接', () => {
    it('应该测试现有仓库的连接', async () => {
      const mockTestResult: TestResult = {
        success: true,
        message: '连接测试成功',
        timestamp: new Date()
      }
      repositoryService.testConnection.mockResolvedValue(mockTestResult)

      const response = await request(app.getHttpServer())
        .post(`/api/repositories/${mockRepository.id}/test`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual(mockTestResult)
      expect(repositoryService.testConnection).toHaveBeenCalledWith(
        mockRepository.id,
        mockUser.id,
        expect.objectContaining({
          ipAddress: expect.any(String),
          userAgent: expect.any(String)
        })
      )
    })
  })

  describe('GET /api/repositories/:id/branches - 获取分支列表', () => {
    it('应该返回仓库的分支列表', async () => {
      const mockBranchesResult = {
        branches: ['main', 'develop', 'feature/test'],
        defaultBranch: 'main'
      }
      repositoryService.getBranches.mockResolvedValue(mockBranchesResult)

      const response = await request(app.getHttpServer())
        .get(`/api/repositories/${mockRepository.id}/branches`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.body).toEqual(mockBranchesResult)
      expect(repositoryService.getBranches).toHaveBeenCalledWith(mockRepository.id)
    })
  })

  describe('搜索相关端点', () => {
    describe('GET /api/repositories/search/suggestions', () => {
      it('应该返回搜索建议', async () => {
        const mockSuggestions = ['test-repo', 'test-project']
        searchPaginationService.getSearchSuggestions.mockResolvedValue(mockSuggestions)

        const response = await request(app.getHttpServer())
          .get('/api/repositories/search/suggestions')
          .query({ query: 'test', field: 'name', limit: 10 })
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200)

        expect(response.body).toEqual(mockSuggestions)
        expect(searchPaginationService.getSearchSuggestions).toHaveBeenCalledWith('test', 'name', 10)
      })
    })

    describe('GET /api/repositories/search/statistics', () => {
      it('应该返回搜索统计信息', async () => {
        const mockStatistics = {
          total: 100,
          byType: {
            git: 80,
            local: 20,
            svn: 0
          },
          byEnabled: {
            'true': 90,
            'false': 10
          },
          recentSearches: ['test', 'repository', 'project']
        }
        searchPaginationService.getSearchStatistics.mockResolvedValue(mockStatistics)

        const response = await request(app.getHttpServer())
          .get('/api/repositories/search/statistics')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200)

        expect(response.body).toEqual(mockStatistics)
      })
    })

    describe('GET /api/repositories/search/fulltext', () => {
      it('应该执行全文搜索', async () => {
        const mockSearchResult: PaginatedResult<RepositoryEntity> = {
          data: [mockRepository],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
        searchPaginationService.fullTextSearch.mockResolvedValue(mockSearchResult)

        const response = await request(app.getHttpServer())
          .get('/api/repositories/search/fulltext')
          .query({ q: 'test repository' })
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200)

        expect(response.body).toEqual(mockSearchResult)
        expect(searchPaginationService.fullTextSearch).toHaveBeenCalledWith(
          'test repository',
          expect.objectContaining({
            page: 1,
            limit: 20,
            sortBy: 'updatedAt',
            sortOrder: 'DESC'
          })
        )
      })
    })

    describe('GET /api/repositories/search/fuzzy', () => {
      it('应该执行模糊搜索', async () => {
        const mockSearchResult: PaginatedResult<RepositoryEntity> = {
          data: [mockRepository],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
        searchPaginationService.fuzzySearch.mockResolvedValue(mockSearchResult)

        const response = await request(app.getHttpServer())
          .get('/api/repositories/search/fuzzy')
          .query({ q: 'test', threshold: 0.5 })
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200)

        expect(response.body).toEqual(mockSearchResult)
        expect(searchPaginationService.fuzzySearch).toHaveBeenCalledWith(
          'test',
          0.5,
          expect.objectContaining({
            page: 1,
            limit: 20,
            sortBy: 'updatedAt',
            sortOrder: 'DESC'
          })
        )
      })
    })

    describe('POST /api/repositories/search/batch', () => {
      it('应该执行批量搜索', async () => {
        const searchQueries = [
          { query: 'test1', type: 'git' as const },
          { query: 'test2', type: 'local' as const }
        ]

        const mockBatchResult = {
          success: true,
          results: [
            {
              index: 0,
              query: searchQueries[0],
              result: { data: [mockRepository], total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
              success: true
            },
            {
              index: 1,
              query: searchQueries[1],
              result: { data: [], total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false },
              success: true
            }
          ],
          totalQueries: 2,
          successfulQueries: 2,
          failedQueries: 0
        }

        searchPaginationService.searchRepositories.mockResolvedValue({
          data: [mockRepository],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        })

        const response = await request(app.getHttpServer())
          .post('/api/repositories/search/batch')
          .send(searchQueries)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.totalQueries).toBe(2)
        expect(response.body.results).toHaveLength(2)
      })

      it('应该限制批量搜索数量', async () => {
        const tooManyQueries = Array(12).fill({ query: 'test' })

        const response = await request(app.getHttpServer())
          .post('/api/repositories/search/batch')
          .send(tooManyQueries)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200)

        expect(response.body.error).toBe('批量搜索最多支持10个查询')
      })

      it('应该验证批量搜索输入', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/repositories/search/batch')
          .send([])
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200)

        expect(response.body.error).toBe('请提供搜索查询数组')
      })
    })
  })

  describe('重试机制相关端点', () => {
    describe('GET /api/repositories/retry/config', () => {
      it('应该返回默认重试配置', async () => {
        const mockConfig = {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          totalTimeout: 30000
        }
        repositoryService.getDefaultRetryConfig.mockReturnValue(mockConfig as any)

        const response = await request(app.getHttpServer())
          .get('/api/repositories/retry/config')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200)

        expect(response.body).toEqual(mockConfig)
      })
    })

    describe('PUT /api/repositories/retry/config', () => {
      it('应该更新默认重试配置', async () => {
        const newConfig = {
          maxRetries: 5,
          baseDelay: 2000,
          maxDelay: 15000,
          totalTimeout: 60000
        }
        repositoryService.updateDefaultRetryConfig.mockResolvedValue(newConfig as any)

        const response = await request(app.getHttpServer())
          .put('/api/repositories/retry/config')
          .send(newConfig)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200)

        expect(response.body).toEqual(newConfig)
        expect(repositoryService.updateDefaultRetryConfig).toHaveBeenCalledWith(newConfig)
      })
    })

    describe('GET /api/repositories/retry/statistics', () => {
      it('应该返回重试统计信息', async () => {
        const mockStatistics = {
          summary: {
            totalRetries: 150,
            successfulRetries: 120,
            failedRetries: 30,
            averageRetryCount: 2.1,
            mostCommonErrors: [
              { errorType: 'timeout', count: 15 },
              { errorType: 'network', count: 10 }
            ]
          },
          recentRetries: [
            {
              repositoryId: 'test-repo-1',
              repositoryName: 'Test Repo 1',
              timestamp: new Date(),
              success: true,
              retryCount: 2,
              duration: 3000
            }
          ]
        }
        repositoryService.getRetryStatistics.mockResolvedValue(mockStatistics)

        const response = await request(app.getHttpServer())
          .get('/api/repositories/retry/statistics')
          .query({ startDate: '2024-01-01', endDate: '2024-12-31' })
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200)

        expect(response.body).toEqual(mockStatistics)
      })
    })
  })

  describe('错误处理和边界条件', () => {
    it('应该处理无效的仓库 ID 格式', async () => {
      await request(app.getHttpServer())
        .get('/api/repositories/invalid-id-format-with-special-chars!')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400)
    })

    it('应该处理过大的分页参数', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/repositories/paginated')
        .query({ page: 1, limit: 1000 }) // 超过最大限制
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400)

      expect(response.body.message).toContain('limit')
    })

    it('应该处理负数分页参数', async () => {
      await request(app.getHttpServer())
        .get('/api/repositories/paginated')
        .query({ page: -1, limit: 20 })
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400)
    })

    it('应该处理服务层抛出的特定错误', async () => {
      repositoryService.findOne.mockRejectedValue(new Error('Repository not found'))

      await request(app.getHttpServer())
        .get('/api/repositories/test-id')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404)
    })

    it('应该处理数据库连接错误', async () => {
      repositoryService.findAll.mockRejectedValue(new Error('Database connection failed'))

      await request(app.getHttpServer())
        .get('/api/repositories')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500)
    })
  })

  describe('数据验证', () => {
    it('应该验证仓库名称长度', async () => {
      const invalidData = {
        ...createRepositoryDto,
        name: 'a'.repeat(101) // 超过最大长度
      }

      await request(app.getHttpServer())
        .post('/api/repositories')
        .send(invalidData)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400)
    })

    it('应该验证描述长度', async () => {
      const invalidData = {
        ...createRepositoryDto,
        description: 'a'.repeat(501) // 超过最大长度
      }

      await request(app.getHttpServer())
        .post('/api/repositories')
        .send(invalidData)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400)
    })

    it('应该验证设置对象的字段', async () => {
      const invalidData = {
        ...createRepositoryDto,
        settings: {
          retryCount: -1, // 无效值
          connectionTimeout: 'invalid' // 错误类型
        }
      }

      await request(app.getHttpServer())
        .post('/api/repositories')
        .send(invalidData)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400)
    })
  })

  describe('响应格式验证', () => {
    it('应该返回正确的 Content-Type', async () => {
      repositoryService.findAll.mockResolvedValue([mockRepository])

      const response = await request(app.getHttpServer())
        .get('/api/repositories')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(response.headers['content-type']).toMatch(/application\/json/)
    })

    it('应该在成功响应中包含必要的字段', async () => {
      repositoryService.findAll.mockResolvedValue([mockRepository])

      const response = await request(app.getHttpServer())
        .get('/api/repositories')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id')
        expect(response.body[0]).toHaveProperty('name')
        expect(response.body[0]).toHaveProperty('url')
        expect(response.body[0]).toHaveProperty('type')
      }
    })

    it('应该在错误响应中包含错误信息', async () => {
      repositoryService.findAll.mockRejectedValue(new Error('Test error'))

      const response = await request(app.getHttpServer())
        .get('/api/repositories')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500)

      expect(response.body).toHaveProperty('statusCode')
      expect(response.body).toHaveProperty('message')
    })
  })

  describe('并发请求处理', () => {
    it('应该正确处理并发的仓库查询请求', async () => {
      repositoryService.findAll.mockResolvedValue([mockRepository])

      const promises = Array(5).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/api/repositories')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200)
      )

      const responses = await Promise.all(promises)

      responses.forEach(response => {
        expect(response.body).toEqual([mockRepository])
      })

      expect(repositoryService.findAll).toHaveBeenCalledTimes(5)
    })

    it('应该正确处理并发的创建请求', async () => {
      repositoryService.create.mockResolvedValue(mockRepository)

      const promises = Array(3).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/api/repositories')
          .send(createRepositoryDto)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(201)
      )

      const responses = await Promise.all(promises)

      responses.forEach(response => {
        expect(response.body).toEqual(mockRepository)
      })

      expect(repositoryService.create).toHaveBeenCalledTimes(3)
    })
  })
})