import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OperationLog } from '../entities/operation-log.entity'
import { BaseRepository } from './base.repository'

export interface OperationLogQuery {
  agentId?: string
  userId?: string
  operation?: string
  success?: boolean
  startDate?: Date
  endDate?: Date
  severity?: 'info' | 'warning' | 'error' | 'critical'
  limit?: number
  offset?: number
}

export interface OperationLogStats {
  totalOperations: number
  successRate: number
  operationCounts: Record<string, number>
  userActivity: Record<string, number>
  recentErrors: OperationLog[]
}

@Injectable()
export class OperationLogRepository extends BaseRepository<OperationLog> {
  constructor(
    @InjectRepository(OperationLog)
    repository: Repository<OperationLog>
  ) {
    super(repository)
  }

  /**
   * 记录操作日志
   */
  async logOperation(
    operation: 'create' | 'update' | 'delete' | 'validate' | 'batch_operation' | 'connect' | 'disconnect' | 'reset_key' | 'import' | 'export',
    userId: string,
    agentId?: string,
    details?: any,
    success: boolean = true,
    errorMessage?: string,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'info',
    metadata?: any
  ): Promise<OperationLog> {
    const log = this.repository.create({
      operation,
      userId,
      agentId,
      details,
      success,
      errorMessage,
      timestamp: new Date(),
      ipAddress,
      userAgent,
      sessionId,
      severity,
      metadata
    })

    return this.repository.save(log)
  }

  /**
   * 查询操作日志
   */
  async findOperationLogs(query: OperationLogQuery): Promise<{
    logs: OperationLog[]
    total: number
  }> {
    const queryBuilder = this.repository.createQueryBuilder('log')
      .leftJoinAndSelect('log.agent', 'agent')

    if (query.agentId) {
      queryBuilder.andWhere('log.agentId = :agentId', { agentId: query.agentId })
    }

    if (query.userId) {
      queryBuilder.andWhere('log.userId = :userId', { userId: query.userId })
    }

    if (query.operation) {
      queryBuilder.andWhere('log.operation = :operation', { operation: query.operation })
    }

    if (query.success !== undefined) {
      queryBuilder.andWhere('log.success = :success', { success: query.success })
    }

    if (query.startDate) {
      queryBuilder.andWhere('log.timestamp >= :startDate', { startDate: query.startDate })
    }

    if (query.endDate) {
      queryBuilder.andWhere('log.timestamp <= :endDate', { endDate: query.endDate })
    }

    if (query.severity) {
      queryBuilder.andWhere('log.severity = :severity', { severity: query.severity })
    }

    queryBuilder.orderBy('log.timestamp', 'DESC')

    if (query.offset) {
      queryBuilder.skip(query.offset)
    }

    if (query.limit) {
      queryBuilder.take(query.limit)
    }

    const [logs, total] = await queryBuilder.getManyAndCount()

    return { logs, total }
  }

  /**
   * 获取操作统计信息
   */
  async getOperationStatistics(days: number = 30): Promise<OperationLogStats> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // 总操作数和成功率
    const [totalOperations, successfulOperations] = await Promise.all([
      this.repository.count({
        where: {
          timestamp: this.repository.createQueryBuilder()
            .where('timestamp >= :startDate', { startDate })
            .getSql()
        }
      }),
      this.repository.count({
        where: {
          success: true,
          timestamp: this.repository.createQueryBuilder()
            .where('timestamp >= :startDate', { startDate })
            .getSql()
        }
      })
    ])

    const successRate = totalOperations > 0 ? Math.round(successfulOperations / totalOperations * 10000) / 100 : 0

    // 操作类型统计
    const operationStats = await this.repository
      .createQueryBuilder('log')
      .select('log.operation', 'operation')
      .addSelect('COUNT(*)', 'count')
      .where('log.timestamp >= :startDate', { startDate })
      .groupBy('log.operation')
      .getRawMany()

    const operationCounts = operationStats.reduce((acc, item) => {
      acc[item.operation] = parseInt(item.count)
      return acc
    }, {})

    // 用户活动统计
    const userStats = await this.repository
      .createQueryBuilder('log')
      .select('log.userId', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('log.timestamp >= :startDate', { startDate })
      .groupBy('log.userId')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany()

    const userActivity = userStats.reduce((acc, item) => {
      acc[item.userId] = parseInt(item.count)
      return acc
    }, {})

    // 最近的错误日志
    const recentErrors = await this.repository.find({
      where: {
        success: false,
        timestamp: this.repository.createQueryBuilder()
          .where('timestamp >= :startDate', { startDate })
          .getSql()
      },
      order: { timestamp: 'DESC' },
      take: 10,
      relations: ['agent']
    })

    return {
      totalOperations,
      successRate,
      operationCounts,
      userActivity,
      recentErrors
    }
  }

  /**
   * 获取用户的操作历史
   */
  async getUserOperationHistory(
    userId: string,
    days: number = 7,
    limit: number = 50
  ): Promise<OperationLog[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    return this.repository.find({
      where: {
        userId,
        timestamp: this.repository.createQueryBuilder()
          .where('timestamp >= :startDate', { startDate })
          .getSql()
      },
      order: { timestamp: 'DESC' },
      take: limit,
      relations: ['agent']
    })
  }

  /**
   * 获取Agent的操作历史
   */
  async getAgentOperationHistory(
    agentId: string,
    days: number = 30,
    limit: number = 100
  ): Promise<OperationLog[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    return this.repository.find({
      where: {
        agentId,
        timestamp: this.repository.createQueryBuilder()
          .where('timestamp >= :startDate', { startDate })
          .getSql()
      },
      order: { timestamp: 'DESC' },
      take: limit
    })
  }

  /**
   * 清理旧的操作日志
   */
  async cleanupOldLogs(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
    
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoffDate', { cutoffDate })
      .execute()

    return result.affected || 0
  }

  /**
   * 获取安全相关的操作日志
   */
  async getSecurityLogs(days: number = 7): Promise<OperationLog[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const securityOperations = ['reset_key', 'delete', 'connect', 'disconnect']

    return this.repository.find({
      where: {
        operation: this.repository.createQueryBuilder()
          .where('operation IN (:...operations)', { operations: securityOperations })
          .getSql(),
        timestamp: this.repository.createQueryBuilder()
          .where('timestamp >= :startDate', { startDate })
          .getSql()
      },
      order: { timestamp: 'DESC' },
      relations: ['agent']
    })
  }

  /**
   * 按时间段统计操作量
   */
  async getOperationVolumeByHour(days: number = 1): Promise<Array<{
    hour: string
    count: number
    successCount: number
    errorCount: number
  }>> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const results = await this.repository
      .createQueryBuilder('log')
      .select("DATE_TRUNC('hour', log.timestamp)", 'hour')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(CASE WHEN log.success = true THEN 1 ELSE 0 END)', 'successCount')
      .addSelect('SUM(CASE WHEN log.success = false THEN 1 ELSE 0 END)', 'errorCount')
      .where('log.timestamp >= :startDate', { startDate })
      .groupBy("DATE_TRUNC('hour', log.timestamp)")
      .orderBy('hour', 'ASC')
      .getRawMany()

    return results.map(result => ({
      hour: result.hour.toISOString(),
      count: parseInt(result.count),
      successCount: parseInt(result.successCount),
      errorCount: parseInt(result.errorCount)
    }))
  }
}