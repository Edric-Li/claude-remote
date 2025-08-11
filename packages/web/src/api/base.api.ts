import { HttpClient } from '../utils/httpClient'
import type { PaginationParams } from '../types/api.types'

/**
 * API错误类
 */
export class ApiErrorClass extends Error {
  public readonly statusCode: number
  public readonly error?: string
  public readonly timestamp: string
  public readonly path: string

  constructor(statusCode: number, message: string | string[], error?: string, timestamp?: string, path?: string) {
    super(Array.isArray(message) ? message.join(', ') : message)
    this.name = 'ApiErrorClass'
    this.statusCode = statusCode
    this.error = error
    this.timestamp = timestamp || new Date().toISOString()
    this.path = path || ''
  }
}

/**
 * 基础API客户端类
 */
export abstract class BaseApi {
  protected readonly basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  /**
   * 处理API响应，统一错误处理
   */
  protected async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorData: any
      try {
        errorData = await response.json()
      } catch {
        throw new ApiErrorClass(
          response.status,
          response.statusText,
          undefined,
          new Date().toISOString(),
          response.url
        )
      }

      if (errorData.statusCode && errorData.message) {
        throw new ApiErrorClass(
          errorData.statusCode,
          errorData.message,
          errorData.error,
          errorData.timestamp,
          errorData.path
        )
      }

      throw new ApiErrorClass(
        response.status,
        errorData.message || response.statusText,
        undefined,
        new Date().toISOString(),
        response.url
      )
    }

    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    }

    return response as unknown as T
  }

  /**
   * GET请求
   */
  protected async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    let url = `${this.basePath}${endpoint}`
    
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    const response = await HttpClient.get(url)
    return this.handleResponse<T>(response)
  }

  /**
   * POST请求
   */
  protected async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await HttpClient.post(`${this.basePath}${endpoint}`, data)
    return this.handleResponse<T>(response)
  }

  /**
   * PUT请求
   */
  protected async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await HttpClient.put(`${this.basePath}${endpoint}`, data)
    return this.handleResponse<T>(response)
  }

  /**
   * PATCH请求
   */
  protected async patch<T>(endpoint: string, data?: any): Promise<T> {
    // 使用fetch直接发送PATCH请求，因为HttpClient没有暴露makeRequest
    const authToken = this.getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const response = await fetch(`${this.basePath}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    })
    
    return this.handleResponse<T>(response)
  }

  /**
   * 获取认证Token (辅助方法)
   */
  protected getAuthToken(): string | null {
    try {
      const authStorage = localStorage.getItem('auth-storage')
      if (authStorage) {
        const authState = JSON.parse(authStorage)
        return authState?.state?.accessToken || null
      }
    } catch (error) {
      console.error('Failed to get auth token:', error)
    }
    return null
  }

  /**
   * DELETE请求
   */
  protected async httpDelete<T = void>(endpoint: string): Promise<T> {
    const response = await HttpClient.delete(`${this.basePath}${endpoint}`)
    return this.handleResponse<T>(response)
  }

  /**
   * 构建分页参数
   */
  protected buildPaginationParams(params?: PaginationParams): Record<string, any> {
    const result: Record<string, any> = {}
    
    if (params?.page !== undefined) {
      result.page = params.page
    }
    if (params?.limit !== undefined) {
      result.limit = params.limit
    }
    
    return result
  }
}

/**
 * 通用CRUD操作的基础类
 */
export abstract class CrudApi<
  TEntity,
  TCreateDto,
  TUpdateDto,
  TStats = any
> extends BaseApi {
  
  /**
   * 创建资源
   */
  async create(createDto: TCreateDto): Promise<TEntity> {
    return this.post<TEntity>('', createDto)
  }

  /**
   * 获取资源列表
   */
  async findAll(params?: PaginationParams & Record<string, any>): Promise<TEntity[]> {
    return this.get<TEntity[]>('', params)
  }

  /**
   * 根据ID获取资源
   */
  async findById(id: string): Promise<TEntity> {
    return this.get<TEntity>(`/${id}`)
  }

  /**
   * 更新资源
   */
  async update(id: string, updateDto: TUpdateDto): Promise<TEntity> {
    return this.put<TEntity>(`/${id}`, updateDto)
  }

  /**
   * 删除资源
   */
  async delete(id: string): Promise<void> {
    await this.httpDelete<void>(`/${id}`)
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<TStats> {
    return this.get<TStats>('/stats')
  }
}