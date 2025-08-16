import { Injectable, Logger } from '@nestjs/common'
import { AuditLogRepository } from '../repositories/audit-log.repository'
import { CreateAuditLogDto, QueryAuditLogDto, RepositoryAuditLogDto } from '../dto/audit-log.dto'
import { AuditAction, AuditLogDetails, AuditLogQueryParams } from '../types/audit.types'
import { TestResult } from '../types/repository.types'

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name)

  constructor(private auditLogRepository: AuditLogRepository) {}

  /**
   * 记录操作日志
   */
  async logOperation(
    action: AuditAction,
    repositoryId: string,
    userId: string,
    details?: AuditLogDetails,
    options?: {
      ipAddress?: string
      userAgent?: string
      success?: boolean
      durationMs?: number
    }
  ) {
    try {
      const auditLog = await this.auditLogRepository.create({
        repositoryId,
        userId,
        action,
        details,
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
        success: options?.success ?? true,
        durationMs: options?.durationMs
      })

      this.logger.log(
        `审计日志已记录: ${action} - 仓库 ${repositoryId} - 用户 ${userId} - 成功: ${auditLog.success}`
      )

      return auditLog
    } catch (error) {
      this.logger.error('记录审计日志失败', error)
      // 审计日志记录失败不应影响主要操作
      return null
    }
  }

  /**
   * 记录仓库创建
   */
  async logRepositoryCreate(
    repositoryId: string,
    userId: string,
    repositoryData: any,
    options?: { ipAddress?: string; userAgent?: string; durationMs?: number }
  ) {
    return this.logOperation(
      AuditAction.CREATE,
      repositoryId,
      userId,
      {
        metadata: {
          repositoryName: repositoryData.name,
          repositoryUrl: repositoryData.url,
          repositoryType: repositoryData.type
        }
      },
      options
    )
  }

  /**
   * 记录仓库更新
   */
  async logRepositoryUpdate(
    repositoryId: string,
    userId: string,
    changes: Record<string, any>,
    options?: { ipAddress?: string; userAgent?: string; durationMs?: number }
  ) {
    return this.logOperation(
      AuditAction.UPDATE,
      repositoryId,
      userId,
      { changes },
      options
    )
  }

  /**
   * 记录仓库删除
   */
  async logRepositoryDelete(
    repositoryId: string,
    userId: string,
    repositoryData: any,
    options?: { ipAddress?: string; userAgent?: string; durationMs?: number }
  ) {
    return this.logOperation(
      AuditAction.DELETE,
      repositoryId,
      userId,
      {
        metadata: {
          repositoryName: repositoryData.name,
          repositoryUrl: repositoryData.url
        }
      },
      options
    )
  }

  /**
   * 记录仓库测试
   */
  async logRepositoryTest(
    repositoryId: string,
    userId: string,
    testResult: TestResult,
    options?: { ipAddress?: string; userAgent?: string; durationMs?: number }
  ) {
    return this.logOperation(
      AuditAction.TEST,
      repositoryId,
      userId,
      { testResult },
      {
        ...options,
        success: testResult.success
      }
    )
  }

  /**
   * 记录仓库克隆
   */
  async logRepositoryClone(
    repositoryId: string,
    userId: string,
    cloneResult: { success: boolean; localPath?: string; errorMessage?: string },
    options?: { ipAddress?: string; userAgent?: string; durationMs?: number }
  ) {
    return this.logOperation(
      AuditAction.CLONE,
      repositoryId,
      userId,
      {
        metadata: {
          localPath: cloneResult.localPath,
          errorMessage: cloneResult.errorMessage
        }
      },
      {
        ...options,
        success: cloneResult.success
      }
    )
  }

  /**
   * 获取审计日志
   */
  async getAuditLog(params: QueryAuditLogDto) {
    const queryParams: AuditLogQueryParams = {
      ...params,
      startDate: params.startDate ? new Date(params.startDate) : undefined,
      endDate: params.endDate ? new Date(params.endDate) : undefined
    }

    return this.auditLogRepository.findWithPagination(queryParams)
  }

  /**
   * 获取指定仓库的审计日志
   */
  async getRepositoryAuditLog(repositoryId: string, limit: number = 100) {
    return this.auditLogRepository.findByRepositoryId(repositoryId, limit)
  }

  /**
   * 增强版 - 获取指定仓库的审计日志（支持完整分页和排序）
   */
  async getRepositoryAuditLogPaginated(repositoryId: string, params: RepositoryAuditLogDto) {
    const {
      userId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'timestamp',
      sortOrder = 'DESC'
    } = params

    const queryParams: AuditLogQueryParams = {
      repositoryId,
      userId,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page,
      limit,
      sortBy,
      sortOrder
    }

    return this.auditLogRepository.findWithPagination(queryParams)
  }

  /**
   * 获取指定用户的审计日志
   */
  async getUserAuditLog(userId: string, limit: number = 100) {
    return this.auditLogRepository.findByUserId(userId, limit)
  }

  /**
   * 清理旧的审计日志
   */
  async cleanupOldLogs(retentionDays: number = 90) {
    const deletedCount = await this.auditLogRepository.cleanupOldLogs(retentionDays)
    this.logger.log(`已清理 ${deletedCount} 条超过 ${retentionDays} 天的审计日志`)
    return deletedCount
  }

  /**
   * 获取审计统计信息
   */
  async getStatistics(repositoryId?: string) {
    return this.auditLogRepository.getStatistics(repositoryId)
  }

  /**
   * 批量记录审计日志（用于数据迁移等场景）
   */
  async bulkLogOperations(operations: CreateAuditLogDto[]) {
    try {
      const logs = []
      for (const operation of operations) {
        const log = await this.auditLogRepository.create(operation)
        logs.push(log)
      }
      
      this.logger.log(`批量记录了 ${logs.length} 条审计日志`)
      return logs
    } catch (error) {
      this.logger.error('批量记录审计日志失败', error)
      throw error
    }
  }
}