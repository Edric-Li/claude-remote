import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Agent } from '../entities/agent.entity'
import { AgentHealth } from '../entities/agent-health.entity'
import { OperationLog } from '../entities/operation-log.entity'
import { AgentValidationService } from './agent-validation.service'
import { ChatGateway } from '../chat/chat.gateway'

export interface HealthMetrics {
  cpuUsage?: number
  memoryUsage?: number
  diskUsage?: number
  networkLatency?: number
  activeConnections?: number
  taskQueueSize?: number
  responseTime?: number
  errorRate?: number
}

export interface AlertRule {
  id: string
  name: string
  metric: keyof HealthMetrics
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals'
  threshold: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  cooldownPeriod: number // 冷却期（分钟）
}

export interface AlertEvent {
  id: string
  agentId: string
  ruleId: string
  ruleName: string
  metric: string
  value: number
  threshold: number
  severity: string
  message: string
  timestamp: Date
  acknowledged: boolean
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name)
  private monitoringIntervals = new Map<string, NodeJS.Timeout>()
  private activeAlerts = new Map<string, Date>() // ruleId -> last alert time

  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(AgentHealth)
    private healthRepository: Repository<AgentHealth>,
    @InjectRepository(OperationLog)
    private operationLogRepository: Repository<OperationLog>,
    private agentValidationService: AgentValidationService,
    private chatGateway: ChatGateway
  ) {}

  /**
   * 启动Agent监控
   */
  async startMonitoring(agentId: string): Promise<void> {
    if (this.monitoringIntervals.has(agentId)) {
      this.logger.warn(`Monitoring already started for agent ${agentId}`)
      return
    }

    const agent = await this.agentRepository.findOne({ 
      where: { id: agentId } 
    })

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    const monitoringConfig = agent.metadata?.monitoringConfig
    if (!monitoringConfig?.enabled) {
      this.logger.warn(`Monitoring disabled for agent ${agentId}`)
      return
    }

    // 启动定期健康检查
    const interval = setInterval(async () => {
      try {
        await this.performHealthCheck(agentId)
      } catch (error) {
        this.logger.error(`Health check failed for agent ${agentId}:`, error)
      }
    }, (monitoringConfig.checkInterval || 60) * 1000) // 默认60秒

    this.monitoringIntervals.set(agentId, interval)
    this.logger.log(`Started monitoring for agent ${agentId}`)

    // 记录操作日志
    await this.logOperation(agentId, 'monitoring_started', {
      interval: monitoringConfig.checkInterval || 60
    })
  }

  /**
   * 停止Agent监控
   */
  async stopMonitoring(agentId: string): Promise<void> {
    const interval = this.monitoringIntervals.get(agentId)
    if (interval) {
      clearInterval(interval)
      this.monitoringIntervals.delete(agentId)
      this.logger.log(`Stopped monitoring for agent ${agentId}`)

      // 记录操作日志
      await this.logOperation(agentId, 'monitoring_stopped')
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(agentId: string): Promise<AgentHealth> {
    const agent = await this.agentRepository.findOne({ 
      where: { id: agentId } 
    })

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    // 执行连接测试获取基本健康状态
    // TODO: 实现 validateConnection 方法
    const validationResult = { success: true, responseTime: 100, message: 'OK' }
    
    // 模拟获取详细健康指标（实际应该从Agent端获取）
    const metrics: HealthMetrics = await this.collectHealthMetrics(agent)

    // 创建健康记录
    const healthRecord = this.healthRepository.create({
      agent: { id: agentId } as any,
      status: validationResult.success ? 'healthy' : 'offline',
      metrics,
      responseTime: validationResult.responseTime,
      timestamp: new Date(),
      alerts: []
    })

    // 检查告警规则
    const alerts = await this.checkAlertRules(agent, metrics)
    if (alerts.length > 0) {
      healthRecord.alerts = alerts
      healthRecord.status = this.getWorstAlertSeverity(alerts)
    }

    // 保存健康记录
    const savedRecord = await this.healthRepository.save(healthRecord)

    // 更新Agent状态
    const newStatus = validationResult.success ? 'connected' : 'offline'
    if (agent.status !== newStatus) {
      await this.agentRepository.update(agentId, { 
        status: newStatus,
        lastSeenAt: validationResult.success ? new Date() : agent.lastSeenAt
      })

      // 通过WebSocket通知状态变化
      this.chatGateway.notifyAgentStatusChange(agentId, newStatus)
    }

    // 发送告警通知
    if (alerts.length > 0) {
      await this.sendAlertNotifications(agent, alerts)
    }

    return savedRecord
  }

  /**
   * 收集健康指标
   */
  private async collectHealthMetrics(agent: Agent): Promise<HealthMetrics> {
    // 这里应该实现实际的指标收集逻辑
    // 可以通过HTTP API、WebSocket或其他方式从Agent端获取
    
    // 模拟数据
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      networkLatency: Math.random() * 500,
      activeConnections: Math.floor(Math.random() * 10),
      taskQueueSize: Math.floor(Math.random() * 50),
      responseTime: Math.random() * 1000,
      errorRate: Math.random() * 10
    }
  }

  /**
   * 检查告警规则
   */
  private async checkAlertRules(agent: Agent, metrics: HealthMetrics): Promise<AlertEvent[]> {
    const alertRules = agent.metadata?.alertRules || []
    const alerts: AlertEvent[] = []

    for (const rule of alertRules) {
      if (!rule.enabled) continue

      const metricValue = metrics[rule.metric]
      if (metricValue === undefined) continue

      // 检查冷却期
      const lastAlertTime = this.activeAlerts.get(rule.id)
      if (lastAlertTime) {
        const cooldownMs = rule.cooldownPeriod * 60 * 1000
        if (Date.now() - lastAlertTime.getTime() < cooldownMs) {
          continue
        }
      }

      // 检查条件
      let triggered = false
      switch (rule.condition) {
        case 'greater_than':
          triggered = metricValue > rule.threshold
          break
        case 'less_than':
          triggered = metricValue < rule.threshold
          break
        case 'equals':
          triggered = metricValue === rule.threshold
          break
        case 'not_equals':
          triggered = metricValue !== rule.threshold
          break
      }

      if (triggered) {
        const alert: AlertEvent = {
          id: `${rule.id}-${Date.now()}`,
          agentId: agent.id,
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.metric,
          value: metricValue,
          threshold: rule.threshold,
          severity: rule.severity,
          message: `${rule.name}: ${rule.metric} is ${metricValue} (threshold: ${rule.threshold})`,
          timestamp: new Date(),
          acknowledged: false
        }

        alerts.push(alert)
        this.activeAlerts.set(rule.id, new Date())
      }
    }

    return alerts
  }

  /**
   * 获取最严重的告警级别
   */
  private getWorstAlertSeverity(alerts: AlertEvent[]): string {
    const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 }
    let worstSeverity = 'healthy'
    let maxSeverityValue = 0

    for (const alert of alerts) {
      const severityValue = severityOrder[alert.severity as keyof typeof severityOrder] || 0
      if (severityValue > maxSeverityValue) {
        maxSeverityValue = severityValue
        worstSeverity = alert.severity
      }
    }

    return worstSeverity
  }

  /**
   * 发送告警通知
   */
  private async sendAlertNotifications(agent: Agent, alerts: AlertEvent[]): Promise<void> {
    // 通过WebSocket发送实时告警
    this.chatGateway.notifyAgentAlerts(agent.id, alerts)

    // 记录告警日志
    for (const alert of alerts) {
      await this.logOperation(agent.id, 'alert_triggered', {
        alertId: alert.id,
        ruleName: alert.ruleName,
        severity: alert.severity,
        message: alert.message
      })

      this.logger.warn(`Alert triggered for agent ${agent.name}: ${alert.message}`)
    }
  }

  /**
   * 获取Agent健康历史
   */
  async getHealthHistory(
    agentId: string,
    startTime?: Date,
    endTime?: Date,
    limit: number = 100
  ): Promise<AgentHealth[]> {
    const queryBuilder = this.healthRepository
      .createQueryBuilder('health')
      .where('health.agentId = :agentId', { agentId })

    if (startTime) {
      queryBuilder.andWhere('health.timestamp >= :startTime', { startTime })
    }

    if (endTime) {
      queryBuilder.andWhere('health.timestamp <= :endTime', { endTime })
    }

    return queryBuilder
      .orderBy('health.timestamp', 'DESC')
      .limit(limit)
      .getMany()
  }

  /**
   * 获取健康统计
   */
  async getHealthStats(agentId: string, period: '1h' | '24h' | '7d' | '30d'): Promise<any> {
    const now = new Date()
    let startTime: Date

    switch (period) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
    }

    const records = await this.getHealthHistory(agentId, startTime, now, 1000)

    if (records.length === 0) {
      return {
        period,
        uptime: 0,
        avgResponseTime: 0,
        alertCount: 0,
        dataPoints: []
      }
    }

    // 计算统计数据
    const healthyRecords = records.filter(r => r.status === 'healthy')
    const uptime = (healthyRecords.length / records.length) * 100

    const avgResponseTime = records.reduce((sum, r) => sum + (r.responseTime || 0), 0) / records.length

    const alertCount = records.reduce((sum, r) => sum + (r.alerts?.length || 0), 0)

    // 生成数据点用于图表展示
    const dataPoints = records.slice(0, 50).reverse().map(record => ({
      timestamp: record.timestamp,
      status: record.status,
      responseTime: record.responseTime,
      metrics: record.metrics
    }))

    return {
      period,
      uptime: Math.round(uptime * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      alertCount,
      dataPoints
    }
  }

  /**
   * 更新监控配置
   */
  async updateMonitoringConfig(agentId: string, config: any): Promise<void> {
    const agent = await this.agentRepository.findOne({ where: { id: agentId } })
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    // 更新元数据中的监控配置
    const metadata = agent.metadata || {}
    metadata.monitoringConfig = { ...metadata.monitoringConfig, ...config }

    await this.agentRepository.update(agentId, { metadata })

    // 如果监控状态发生变化，重启监控
    if (config.enabled !== undefined) {
      if (config.enabled) {
        await this.startMonitoring(agentId)
      } else {
        await this.stopMonitoring(agentId)
      }
    }

    // 记录操作日志
    await this.logOperation(agentId, 'monitoring_config_updated', config)
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(agentId: string, alertId: string, userId: string): Promise<void> {
    // 这里应该实现告警确认逻辑
    // 实际应该在数据库中记录告警确认状态
    
    await this.logOperation(agentId, 'alert_acknowledged', {
      alertId,
      acknowledgedBy: userId,
      acknowledgedAt: new Date()
    })

    this.logger.log(`Alert ${alertId} acknowledged by user ${userId}`)
  }

  /**
   * 清理旧的健康记录
   */
  async cleanupOldRecords(retentionDays: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const result = await this.healthRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoffDate', { cutoffDate })
      .execute()

    this.logger.log(`Cleaned up ${result.affected} old health records`)
    return result.affected || 0
  }

  /**
   * 记录操作日志
   */
  private async logOperation(agentId: string, action: string, details?: any): Promise<void> {
    try {
      await this.operationLogRepository.save({
        agentId,
        action,
        details: details ? JSON.stringify(details) : undefined,
        timestamp: new Date(),
        userId: 'system', // 系统操作
        userRole: 'system'
      })
    } catch (error) {
      this.logger.error('Failed to log operation:', error)
    }
  }

  /**
   * 应用关闭时清理资源
   */
  onModuleDestroy() {
    for (const [agentId, interval] of this.monitoringIntervals) {
      clearInterval(interval)
      this.logger.log(`Stopped monitoring for agent ${agentId} on shutdown`)
    }
    this.monitoringIntervals.clear()
  }
}