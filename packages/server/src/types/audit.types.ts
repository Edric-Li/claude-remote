/**
 * 审计操作类型枚举
 */
export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  TEST = 'test',
  CLONE = 'clone'
}

/**
 * 审计日志详细信息接口
 */
export interface AuditLogDetails {
  /** 字段变更记录 */
  changes?: Record<string, any>
  /** 测试结果（如果是测试操作） */
  testResult?: {
    success: boolean
    message: string
    errorType?: 'auth' | 'host' | 'not_found' | 'timeout' | 'unknown'
    branches?: string[]
    defaultBranch?: string
  }
  /** 错误信息（如果操作失败） */
  errorMessage?: string
  /** 其他元数据 */
  metadata?: Record<string, any>
}

/**
 * 审计日志查询参数接口
 */
export interface AuditLogQueryParams {
  /** 仓库ID */
  repositoryId?: string
  /** 用户ID */
  userId?: string
  /** 操作类型 */
  action?: AuditAction
  /** 开始时间 */
  startDate?: Date
  /** 结束时间 */
  endDate?: Date
  /** 页码 */
  page?: number
  /** 每页数量 */
  limit?: number
  /** 排序字段 */
  sortBy?: string
  /** 排序顺序 */
  sortOrder?: 'ASC' | 'DESC'
}

/**
 * 审计日志查询结果接口
 */
export interface AuditLogQueryResult {
  /** 日志列表 */
  logs: any[]
  /** 总数 */
  total: number
  /** 当前页 */
  page: number
  /** 每页数量 */
  limit: number
  /** 总页数 */
  totalPages: number
  /** 是否有下一页 */
  hasNext?: boolean
  /** 是否有上一页 */
  hasPrev?: boolean
}