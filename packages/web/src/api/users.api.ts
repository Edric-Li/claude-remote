import { CrudApi } from './base.api'
import type {
  User,
  CreateUserDto,
  UpdateUserDto,
  UserStats,
  UpdateUserStatusDto,
  PaginationParams,
  PaginatedResponse
} from '../types/api.types'

/**
 * 用户管理API服务
 */
export class UsersApi extends CrudApi<User, CreateUserDto, UpdateUserDto, UserStats> {
  constructor() {
    super('/api/users')
  }

  /**
   * 获取分页用户列表
   */
  async findAllPaginated(params?: PaginationParams & {
    search?: string
    status?: string
    sortBy?: string
    sortOrder?: 'ASC' | 'DESC'
  }): Promise<PaginatedResponse<User>> {
    return this.get<PaginatedResponse<User>>('', params)
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<User> {
    return this.get<User>('/me')
  }

  /**
   * 更新当前用户信息
   */
  async updateCurrentUser(updateDto: UpdateUserDto): Promise<User> {
    return this.put<User>('/me', updateDto)
  }

  /**
   * 修改用户状态
   */
  async updateUserStatus(userId: string, statusDto: UpdateUserStatusDto): Promise<User> {
    return this.patch<User>(`/${userId}/status`, statusDto)
  }

  /**
   * 重置用户密码 (管理员功能)
   */
  async resetPassword(userId: string, newPassword: string): Promise<{ message: string }> {
    return this.post<{ message: string }>(`/${userId}/reset-password`, { newPassword })
  }

  /**
   * 批量删除用户
   */
  async bulkDelete(userIds: string[]): Promise<{ message: string; deletedCount: number }> {
    return this.post<{ message: string; deletedCount: number }>('/bulk-delete', { userIds })
  }

  /**
   * 导出用户数据
   */
  async exportUsers(params?: {
    format?: 'csv' | 'excel'
    status?: string
    dateFrom?: string
    dateTo?: string
  }): Promise<Blob> {
    const response = await fetch(`${this.basePath}/export?${new URLSearchParams(params || {})}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    })

    if (!response.ok) {
      throw new Error(`导出失败: ${response.statusText}`)
    }

    return response.blob()
  }

}

// 导出单例实例
export const usersApi = new UsersApi()