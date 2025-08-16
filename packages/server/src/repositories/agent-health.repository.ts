import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AgentHealth } from '../entities/agent-health.entity'
import { BaseRepository } from './base.repository'

export interface HealthMetricsQuery {
  agentId: string
  startDate?: Date
  endDate?: Date
  status?: 'healthy' | 'warning' | 'critical' | 'offline'
  limit?: number
}

@Injectable()
export class AgentHealthRepository extends BaseRepository<AgentHealth> {
  constructor(
    @InjectRepository(AgentHealth)
    repository: Repository<AgentHealth>
  ) {
    super(repository)
  }

  /**
   * 获取Agent的最新健康状态
   */
  async getLatestHealthStatus(agentId: string): Promise<AgentHealth | null> {
    return this.repository.findOne({
      where: { agentId },
      order: { timestamp: 'DESC' }
    })
  }

  /**
   * 获取Agent的健康历史记录
   */
  async getHealthHistory(query: HealthMetricsQuery): Promise<AgentHealth[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('health')
      .where('health.agentId = :agentId', { agentId: query.agentId })

    if (query.startDate) {
      queryBuilder.andWhere('health.timestamp >= :startDate', { startDate: query.startDate })
    }

    if (query.endDate) {
      queryBuilder.andWhere('health.timestamp <= :endDate', { endDate: query.endDate })
    }

    if (query.status) {
      queryBuilder.andWhere('health.status = :status', { status: query.status })
    }

    queryBuilder.orderBy('health.timestamp', 'DESC')

    if (query.limit) {
      queryBuilder.take(query.limit)
    }

    return queryBuilder.getMany()
  }

  /**
   * 记录健康状态
   */
  async recordHealthMetrics(
    agentId: string,
    status: 'healthy' | 'warning' | 'critical' | 'offline',
    metrics: {
      cpuUsage: number
      memoryUsage: number
      diskUsage: number
      responseTime: number
      networkLatency: number
    },
    alerts?: Array<{
      id: string
      type: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      message: string
      threshold: number
      currentValue: number
      triggeredAt: Date
    }>,
    additionalData?: any
  ): Promise<AgentHealth> {
    const healthRecord = this.repository.create({
      agentId,
      timestamp: new Date(),
      status,
      metrics,
      alerts,
      additionalData
    })

    return this.repository.save(healthRecord)
  }

  /**
   * 获取Agent健康统计
   */
  async getHealthStatistics(agentId: string, days: number = 7): Promise<{
    averageMetrics: {
      cpuUsage: number
      memoryUsage: number
      diskUsage: number
      responseTime: number
      networkLatency: number
    }
    statusDistribution: Record<string, number>
    alertCount: number
    uptimePercentage: number
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const records = await this.repository
      .createQueryBuilder('health')
      .where('health.agentId = :agentId', { agentId })
      .andWhere('health.timestamp >= :startDate', { startDate })
      .orderBy('health.timestamp', 'ASC')
      .getMany()

    if (records.length === 0) {
      return {
        averageMetrics: {
          cpuUsage: 0,
          memoryUsage: 0,
          diskUsage: 0,
          responseTime: 0,
          networkLatency: 0
        },
        statusDistribution: {},
        alertCount: 0,
        uptimePercentage: 0
      }
    }

    // 计算平均指标
    const averageMetrics = records.reduce(
      (acc, record) => {
        acc.cpuUsage += record.metrics.cpuUsage
        acc.memoryUsage += record.metrics.memoryUsage
        acc.diskUsage += record.metrics.diskUsage
        acc.responseTime += record.responseTime || 0
        acc.networkLatency += record.metrics.networkLatency
        return acc
      },
      { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, responseTime: 0, networkLatency: 0 }
    )

    Object.keys(averageMetrics).forEach(key => {
      averageMetrics[key] = Math.round(averageMetrics[key] / records.length * 100) / 100
    })

    // 状态分布统计
    const statusDistribution = records.reduce((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1
      return acc
    }, {})

    // 告警数量统计
    const alertCount = records.reduce((count, record) => {
      return count + (record.alerts?.length || 0)
    }, 0)

    // 运行时间百分比计算
    const healthyAndWarningCount = (statusDistribution['healthy'] || 0) + (statusDistribution['warning'] || 0)
    const uptimePercentage = Math.round(healthyAndWarningCount / records.length * 10000) / 100

    return {
      averageMetrics,
      statusDistribution,
      alertCount,
      uptimePercentage
    }
  }

  /**
   * 清理旧的健康记录
   */
  async cleanupOldRecords(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
    
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoffDate', { cutoffDate })
      .execute()

    return result.affected || 0
  }

  /**
   * 获取需要告警的Agent
   */
  async getAgentsWithCriticalStatus(minutesAgo: number = 5): Promise<AgentHealth[]> {
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000)
    
    return this.repository
      .createQueryBuilder('health')
      .where('health.status = :status', { status: 'critical' })
      .andWhere('health.timestamp >= :cutoffTime', { cutoffTime })
      .orderBy('health.timestamp', 'DESC')
      .getMany()
  }
}