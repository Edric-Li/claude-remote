// 通用类型定义
export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// 用户相关类型
export interface User extends BaseEntity {
  username: string
  email?: string
  displayName?: string
  avatarUrl?: string
  status: 'active' | 'inactive' | 'banned'
  lastLoginAt?: string
}

export interface CreateUserDto {
  username: string
  email?: string
  password: string
  displayName?: string
  avatarUrl?: string
}

export interface UpdateUserDto {
  displayName?: string
  avatarUrl?: string
  email?: string
}

export interface ChangePasswordDto {
  currentPassword: string
  newPassword: string
}

export interface UpdateUserStatusDto {
  status: 'active' | 'inactive' | 'banned'
}

export interface UserStats {
  total: number
  byStatus: Record<string, number>
  newUsersThisMonth: number
}

// AI配置相关类型
export type ToolType = 'claude' | 'openai' | 'gemini' | 'ollama' | 'custom'

export interface UserAiConfig extends BaseEntity {
  userId: string
  name: string
  toolType: ToolType
  configData: Record<string, any>
  isDefault: boolean
  description?: string
}

export interface CreateAiConfigDto {
  name: string
  toolType: ToolType
  configData: Record<string, any>
  isDefault?: boolean
  description?: string
}

export interface UpdateAiConfigDto {
  name?: string
  configData?: Record<string, any>
  isDefault?: boolean
  description?: string
}

export interface AiConfigStats {
  total: number
  byToolType: Record<string, number>
}

// 仓库相关类型
export type RepositoryType = 'git' | 'local' | 'svn'

export type ErrorType = 'auth' | 'host' | 'not_found' | 'timeout' | 'unknown'

export interface TestResult {
  success: boolean
  message: string
  timestamp: string
  details?: {
    branches?: string[]
    defaultBranch?: string
    isGitRepo?: boolean
    errorType?: ErrorType
    retryCount?: number
    error?: string
  }
}

export interface RepositorySettings {
  autoUpdate?: boolean
  cachePath?: string
  retryCount?: number
  connectionTimeout?: number
}

export interface RepositoryMetadata {
  lastTestDate?: string
  lastTestResult?: TestResult
  availableBranches?: string[]
  defaultBranch?: string
}

export interface Repository extends BaseEntity {
  name: string
  description?: string
  url: string
  type: RepositoryType
  branch?: string
  localPath?: string
  enabled: boolean
  credentials?: string
  settings?: RepositorySettings
  metadata?: RepositoryMetadata
}

export interface CreateRepositoryDto {
  name: string
  description?: string
  url: string
  type: RepositoryType
  branch?: string
  localPath?: string
  enabled?: boolean
  credentials?: string
  settings?: RepositorySettings
}

export interface UpdateRepositoryDto {
  name?: string
  description?: string
  url?: string
  type?: RepositoryType
  branch?: string
  localPath?: string
  enabled?: boolean
  credentials?: string
  settings?: RepositorySettings
}

export interface TestConnectionResult {
  success: boolean
  message: string
}

// 认证相关类型
export interface LoginDto {
  username: string
  password: string
}

export interface RegisterDto {
  username: string
  email: string
  password: string
  displayName?: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken?: string
}

// API错误类型
export interface ApiError {
  statusCode: number
  message: string | string[]
  error?: string
  timestamp: string
  path: string
}

// 通用响应类型
export interface ApiResponse<T = any> {
  data?: T
  message?: string
  error?: ApiError
}
