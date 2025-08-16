/**
 * 重试详情接口
 */
export interface RetryDetails {
  /** 重试次数 */
  attempt: number
  /** 错误信息 */
  error: string
  /** 重试持续时间（毫秒） */
  duration: number
  /** 重试时间戳 */
  timestamp: Date
}

/**
 * 分支验证结果接口
 */
export interface BranchValidationResult {
  /** 分支是否有效 */
  isValid: boolean
  /** 验证消息 */
  message: string
  /** 建议的分支名称 */
  suggestedBranch?: string
  /** 可用的分支列表 */
  availableBranches?: string[]
}

/**
 * 仓库测试结果接口
 */
export interface TestResult {
  /** 测试是否成功 */
  success: boolean
  /** 测试消息 */
  message: string
  /** 测试时间戳 */
  timestamp: Date
  /** 总重试次数 */
  retryCount?: number
  /** 重试详情 */
  retryDetails?: RetryDetails[]
  /** 详细信息 */
  details?: {
    /** 可用分支列表 */
    branches?: string[]
    /** 默认分支 */
    defaultBranch?: string
    /** 是否为 Git 仓库 */
    isGitRepo?: boolean
    /** 错误类型 */
    errorType?: ErrorType
    /** 错误详细信息 */
    error?: string
    /** 分支验证结果 */
    branchValidation?: BranchValidationResult
    /** 实际使用的分支 */
    actualBranch?: string
  }
}

/**
 * 仓库设置接口
 */
export interface RepositorySettings {
  /** 是否在任务开始前自动拉取最新代码 */
  autoUpdate?: boolean
  /** Agent端缓存路径（可选，默认使用系统路径） */
  cachePath?: string
  /** 重试次数（默认 3） */
  retryCount?: number
  /** 连接超时时间（默认 15000ms） */
  connectionTimeout?: number
}

/**
 * 仓库元数据接口
 */
export interface RepositoryMetadata {
  /** 最后测试时间 */
  lastTestDate?: Date
  /** 最后测试结果 */
  lastTestResult?: TestResult
  /** 可用分支列表 */
  availableBranches?: string[]
  /** 默认分支 */
  defaultBranch?: string
}

/**
 * 仓库类型枚举
 */
export type RepositoryType = 'git' | 'local' | 'svn'

/**
 * 错误类型枚举
 */
export type ErrorType = 'auth' | 'host' | 'not_found' | 'timeout' | 'unknown' | 'network' | 'connection_reset' | 'dns_resolution' | 'permission_denied' | 'invalid_format'

/**
 * 重试配置接口
 */
export interface RetryConfig {
  /** 最大重试次数（默认3） */
  maxRetries?: number
  /** 基础延迟时间，毫秒（默认1000） */
  baseDelay?: number
  /** 最大延迟时间，毫秒（默认15000） */
  maxDelay?: number
  /** 总超时时间，毫秒（默认15000） */
  totalTimeout?: number
  /** 是否可重试的错误类型 */
  retryableErrors?: ErrorType[]
}

/**
 * 可重试的错误类型常量
 */
export const RETRYABLE_ERROR_TYPES: ErrorType[] = ['timeout', 'network', 'connection_reset', 'dns_resolution', 'unknown']

/**
 * 不可重试的错误类型常量
 */
export const NON_RETRYABLE_ERROR_TYPES: ErrorType[] = ['auth', 'not_found', 'permission_denied', 'invalid_format']

/**
 * 搜索条件接口
 */
export interface SearchCriteria {
  /** 搜索关键词（在名称、描述、URL中搜索） */
  query?: string
  /** 仓库类型过滤 */
  type?: RepositoryType
  /** 启用状态过滤 */
  enabled?: boolean
}

/**
 * 分页选项接口
 */
export interface PaginationOptions {
  /** 页码（从1开始） */
  page: number
  /** 每页数量（1-100，默认20） */
  limit: number
  /** 排序字段 */
  sortBy?: string
  /** 排序方向 */
  sortOrder?: 'ASC' | 'DESC'
}

/**
 * 分页结果接口
 */
export interface PaginatedResult<T> {
  /** 数据列表 */
  data: T[]
  /** 总记录数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页数量 */
  limit: number
  /** 总页数 */
  totalPages: number
  /** 是否有下一页 */
  hasNext: boolean
  /** 是否有上一页 */
  hasPrev: boolean
}

/**
 * 搜索和分页查询选项接口
 */
export interface SearchPaginationOptions extends PaginationOptions {
  /** 搜索条件 */
  searchCriteria?: SearchCriteria
  /** 过滤条件 */
  filters?: Record<string, any>
}

/**
 * 支持的排序字段
 */
export const SUPPORTED_SORT_FIELDS = ['name', 'createdAt', 'updatedAt', 'type', 'enabled'] as const
export type SortField = typeof SUPPORTED_SORT_FIELDS[number]

/**
 * 分页查询选项接口（服务层专用）
 */
export interface RepositoryPaginationOptions {
  /** 页码（从1开始） */
  page?: number
  /** 每页数量（1-100，默认20） */
  limit?: number
  /** 排序字段 */
  sortBy?: string
  /** 排序方向 */
  sortOrder?: 'ASC' | 'DESC'
}

/**
 * 搜索分页选项接口（服务层专用）
 */
export interface RepositorySearchPaginationOptions extends RepositoryPaginationOptions {
  /** 搜索关键词 */
  query?: string
  /** 仓库类型 */
  type?: string
  /** 启用状态 */
  enabled?: boolean
}

/**
 * 分页结果响应接口（带搜索条件）
 */
export interface PaginatedSearchResult<T> extends PaginatedResult<T> {
  /** 搜索条件 */
  searchCriteria?: {
    query?: string
    type?: string
    enabled?: boolean
    branch?: string
    excludeQuery?: string
    types?: string[]
    createdAfter?: string
    createdBefore?: string
    updatedAfter?: string
    updatedBefore?: string
    hasCredentials?: boolean
  }
}

/**
 * 默认分页配置
 */
export const DEFAULT_PAGINATION_CONFIG = {
  /** 默认页码 */
  DEFAULT_PAGE: 1,
  /** 默认每页数量 */
  DEFAULT_LIMIT: 20,
  /** 最大每页数量 */
  MAX_LIMIT: 100,
  /** 默认排序字段 */
  DEFAULT_SORT_BY: 'updatedAt',
  /** 默认排序方向 */
  DEFAULT_SORT_ORDER: 'DESC' as const,
  /** 搜索关键词最大长度 */
  MAX_QUERY_LENGTH: 100
}