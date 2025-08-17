import { CrudApi } from './base.api'
import type {
  Repository,
  RepositoryType,
  RepositorySettings,
  TestResult,
  CreateRepositoryDto,
  UpdateRepositoryDto
} from '../types/api.types'

/**
 * Repository搜索参数
 */
export interface RepositorySearchParams {
  query?: string
  type?: RepositoryType
  enabled?: boolean
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

/**
 * Repository搜索结果
 */
export interface RepositorySearchResult {
  items: Repository[]
  totalCount: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Repository统计信息
 */
export interface RepositoryStats {
  total: number
  byType: Record<RepositoryType, number>
  enabled: number
  disabled: number
  recentlyCreated: number
  averageTestSuccessRate: number
}

/**
 * 测试配置DTO
 */
export interface TestRepositoryDto {
  name: string
  url: string
  type: RepositoryType
  branch?: string
  credentials?: string
  settings?: RepositorySettings
}

/**
 * 重试配置
 */
export interface RetryConfig {
  maxRetries: number
  retryDelay: number
  backoffFactor: number
  timeout: number
}

/**
 * Repository API客户端
 */
class RepositoriesApi extends CrudApi<Repository, CreateRepositoryDto, UpdateRepositoryDto, RepositoryStats> {
  constructor() {
    super('/api/repositories')
  }

  /**
   * 搜索Repository
   */
  async search(params: RepositorySearchParams): Promise<RepositorySearchResult> {
    return this.get<RepositorySearchResult>('/search', params)
  }

  /**
   * 获取分页列表
   */
  async getPaginated(
    page?: number,
    limit?: number,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC'
  ): Promise<RepositorySearchResult> {
    return this.get<RepositorySearchResult>('/paginated', {
      page,
      limit,
      sortBy,
      sortOrder
    })
  }

  /**
   * 测试配置（不保存）
   */
  async testConfig(data: TestRepositoryDto): Promise<TestResult> {
    return this.post<TestResult>('/test-config', data)
  }

  /**
   * 测试连接
   */
  async testConnection(id: string): Promise<TestResult> {
    return this.post<TestResult>(`/${id}/test`, {})
  }

  /**
   * 测试连接（带重试）
   */
  async testConnectionWithRetry(id: string, retryConfig?: RetryConfig): Promise<TestResult> {
    return this.post<TestResult>(`/${id}/test-with-retry`, retryConfig || {})
  }

  /**
   * 获取分支列表
   */
  async getBranches(id: string): Promise<string[]> {
    return this.get<string[]>(`/${id}/branches`)
  }

  /**
   * 克隆仓库
   */
  async clone(id: string, targetPath: string): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>(`/${id}/clone`, { targetPath })
  }

  /**
   * 创建工作区
   */
  async createWorkspace(id: string, workerId: string): Promise<{ success: boolean; workspaceDir: string }> {
    return this.post<{ success: boolean; workspaceDir: string }>(`/${id}/workspace`, { workerId })
  }

  /**
   * 获取最近的Repository
   */
  async getRecent(
    page?: number,
    limit?: number,
    hours?: number
  ): Promise<RepositorySearchResult> {
    return this.get<RepositorySearchResult>('/recent', {
      page,
      limit,
      hours
    })
  }

  /**
   * 批量验证Repository
   */
  async batchValidate(params: {
    page?: number
    limit?: number
    filter?: 'enabled' | 'all'
    sortBy?: string
    sortOrder?: 'ASC' | 'DESC'
  }): Promise<{
    results: Array<{
      id: string
      name: string
      valid: boolean
      error?: string
    }>
    summary: {
      total: number
      valid: number
      invalid: number
    }
  }> {
    return this.post<any>('/batch/validate', params)
  }

  /**
   * 获取默认重试配置
   */
  async getDefaultRetryConfig(): Promise<RetryConfig> {
    return this.get<RetryConfig>('/retry/config')
  }

  /**
   * 更新默认重试配置
   */
  async updateDefaultRetryConfig(config: RetryConfig): Promise<RetryConfig> {
    return this.put<RetryConfig>('/retry/config', config)
  }
}

// 创建单例实例
export const repositoriesApi = new RepositoriesApi()
export default repositoriesApi