import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, FindManyOptions, Between } from 'typeorm'
import { BaseRepository } from './base.repository'
import { AuditLogEntity } from '../entities/audit-log.entity'
import { AuditLogQueryParams, AuditLogQueryResult } from '../types/audit.types'

@Injectable()
export class AuditLogRepository extends BaseRepository<AuditLogEntity> {
  constructor(
    @InjectRepository(AuditLogEntity)
    private auditLogRepository: Repository<AuditLogEntity>
  ) {
    super(auditLogRepository)
  }

  /**
   * 分页查询审计日志
   */
  async findWithPagination(params: AuditLogQueryParams): Promise<AuditLogQueryResult> {
    const {
      repositoryId,
      userId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = params

    const where: any = {}
    
    if (repositoryId) {
      where.repositoryId = repositoryId
    }
    
    if (userId) {
      where.userId = userId
    }
    
    if (action) {
      where.action = action
    }
    
    if (startDate && endDate) {
      where.timestamp = Between(startDate, endDate)
    } else if (startDate) {
      where.timestamp = Between(startDate, new Date())
    } else if (endDate) {
      where.timestamp = Between(new Date(0), endDate)
    }

    const options: FindManyOptions<AuditLogEntity> = {
      where,
      relations: ['repository', 'user'],
      order: {
        timestamp: 'DESC'
      },
      skip: (page - 1) * limit,
      take: limit
    }

    const [logs, total] = await this.auditLogRepository.findAndCount(options)
    const totalPages = Math.ceil(total / limit)

    return {
      logs,
      total,
      page,
      limit,
      totalPages
    }
  }

  /**
   * 获取指定仓库的审计日志
   */
  async findByRepositoryId(repositoryId: string, limit: number = 100): Promise<AuditLogEntity[]> {
    return this.auditLogRepository.find({
      where: { repositoryId },
      relations: ['user'],
      order: { timestamp: 'DESC' },
      take: limit
    })
  }

  /**
   * 获取指定用户的审计日志
   */
  async findByUserId(userId: string, limit: number = 100): Promise<AuditLogEntity[]> {
    return this.auditLogRepository.find({
      where: { userId },
      relations: ['repository'],
      order: { timestamp: 'DESC' },
      take: limit
    })
  }

  /**
   * 清理指定天数之前的审计日志
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const result = await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoffDate', { cutoffDate })
      .execute()

    return result.affected || 0
  }

  /**
   * 获取统计信息
   */
  async getStatistics(repositoryId?: string): Promise<{
    totalLogs: number
    actionCounts: Record<string, number>
    successRate: number
    recentActivity: AuditLogEntity[]
  }> {
    const baseQuery = this.auditLogRepository.createQueryBuilder('log')
    
    if (repositoryId) {
      baseQuery.where('log.repositoryId = :repositoryId', { repositoryId })
    }

    // 总日志数
    const totalLogs = await baseQuery.getCount()

    // 按操作类型统计
    const actionCounts = await baseQuery
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.action')
      .getRawMany()
      .then(results => 
        results.reduce((acc, { action, count }) => {
          acc[action] = parseInt(count)
          return acc
        }, {} as Record<string, number>)
      )

    // 成功率
    const successCount = await baseQuery
      .where(repositoryId ? 'log.repositoryId = :repositoryId AND log.success = true' : 'log.success = true', 
             repositoryId ? { repositoryId } : {})
      .getCount()
    
    const successRate = totalLogs > 0 ? (successCount / totalLogs) * 100 : 0

    // 最近活动
    const recentActivity = await this.auditLogRepository.find({
      where: repositoryId ? { repositoryId } : {},
      relations: ['repository', 'user'],
      order: { timestamp: 'DESC' },
      take: 10
    })

    return {
      totalLogs,
      actionCounts,
      successRate,
      recentActivity
    }
  }
}