import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException
} from '@nestjs/common'
import { AgentRepository, AgentFilters, PaginationOptions, PaginatedResult } from '../repositories/agent.repository'
import { Agent } from '../entities/agent.entity'
import * as crypto from 'crypto'

export interface CreateAgentDto {
  name: string
  description?: string
  maxWorkers: number
  tags?: string[]
  allowedTools?: string[]
  createdBy: string
}

export interface UpdateAgentDto {
  name?: string
  description?: string
  maxWorkers?: number
  tags?: string[]
  allowedTools?: string[]
  workerStrategy?: {
    mode: 'auto' | 'manual' | 'dynamic'
    config: Record<string, any>
  }
  metadata?: {
    monitoringConfig?: {
      enabled: boolean
      heartbeatInterval: number
      alertThresholds: {
        cpuUsage: number
        memoryUsage: number
        diskUsage: number
        responseTime: number
      }
      notificationChannels: string[]
    }
    alertRules?: Array<{
      id: string
      name: string
      condition: string
      threshold: number
      severity: 'low' | 'medium' | 'high' | 'critical'
      enabled: boolean
    }>
    permissions?: {
      allowedOperations: string[]
      accessLevel: 'read' | 'write' | 'admin'
      restrictions: string[]
    }
  }
}

export interface ValidationResult {
  success: boolean
  timestamp: Date
  responseTime?: number
  errorMessage?: string
  warnings?: string[]
  metrics?: {
    connectivity: boolean
    authentication: boolean
    resourceAvailability: boolean
  }
}

export interface BatchOperationDto {
  type: 'delete' | 'update_status' | 'update_tags' | 'update_monitoring'
  agentIds: string[]
  payload?: any
  userId: string
}

export interface BatchOperationResult {
  totalCount: number
  successCount: number
  failureCount: number
  skippedCount: number
  results: Array<{
    agentId: string
    success: boolean
    error?: string
    skipped?: boolean
    reason?: string
  }>
}

export interface ConnectAgentDto {
  secretKey: string
  hostname: string
  platform: string
  ipAddress: string
  resources: {
    cpuCores: number
    memory: number
    diskSpace: number
  }
}

@Injectable()
export class AgentService {
  constructor(private readonly agentRepository: AgentRepository) {}

  /**
   * 生成唯一的密钥
   */
  private generateSecretKey(): string {
    const segments = []
    for (let i = 0; i < 4; i++) {
      segments.push(crypto.randomBytes(2).toString('hex').toUpperCase())
    }
    return `AIO-${segments.join('-')}`
  }

  /**
   * 创建新的 Agent
   */
  async createAgent(data: CreateAgentDto): Promise<Agent> {
    // 生成唯一密钥
    let secretKey = this.generateSecretKey()
    let attempts = 0

    // 确保密钥唯一
    while (!(await this.agentRepository.isSecretKeyUnique(secretKey)) && attempts < 10) {
      secretKey = this.generateSecretKey()
      attempts++
    }

    if (attempts >= 10) {
      throw new Error('Failed to generate unique secret key')
    }

    const agent = await this.agentRepository.create({
      ...data,
      secretKey,
      status: 'pending'
    })

    return agent
  }

  /**
   * 获取所有 Agent
   */
  async getAllAgents(createdBy?: string): Promise<Agent[]> {
    if (createdBy) {
      return this.agentRepository.findByCreator(createdBy)
    }
    return this.agentRepository.findAll({
      order: {
        createdAt: 'DESC'
      }
    })
  }

  /**
   * 获取单个 Agent
   */
  async getAgentById(id: string): Promise<Agent> {
    const agent = await this.agentRepository.findById(id)
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`)
    }
    return agent
  }

  /**
   * 更新 Agent
   */
  async updateAgent(id: string, data: UpdateAgentDto): Promise<Agent> {
    await this.getAgentById(id) // 确保存在

    const updated = await this.agentRepository.update(id, data)
    if (!updated) {
      throw new Error('Failed to update agent')
    }

    return updated
  }

  /**
   * 删除 Agent
   */
  async deleteAgent(id: string): Promise<void> {
    const agent = await this.getAgentById(id)

    // 不能删除已连接的 Agent
    if (agent.status === 'connected') {
      throw new ConflictException('Cannot delete a connected agent')
    }

    const deleted = await this.agentRepository.delete(id)
    if (!deleted) {
      throw new Error('Failed to delete agent')
    }
  }

  /**
   * 重置 Agent 密钥
   */
  async resetSecretKey(id: string): Promise<string> {
    const agent = await this.getAgentById(id)

    // 不能重置已连接的 Agent 密钥
    if (agent.status === 'connected') {
      throw new ConflictException('Cannot reset key for a connected agent')
    }

    let secretKey = this.generateSecretKey()
    let attempts = 0

    while (!(await this.agentRepository.isSecretKeyUnique(secretKey, id)) && attempts < 10) {
      secretKey = this.generateSecretKey()
      attempts++
    }

    await this.agentRepository.update(id, { secretKey })

    return secretKey
  }

  /**
   * 验证并连接 Agent
   */
  async validateAndConnect(data: ConnectAgentDto): Promise<Agent> {
    const agent = await this.agentRepository.findBySecretKey(data.secretKey)

    if (!agent) {
      throw new BadRequestException('Invalid secret key')
    }

    if (agent.status === 'connected') {
      throw new ConflictException('Agent already connected')
    }

    // 更新连接信息
    const updated = await this.agentRepository.update(agent.id, {
      status: 'connected',
      hostname: data.hostname,
      platform: data.platform,
      ipAddress: data.ipAddress,
      resources: data.resources,
      lastSeenAt: new Date()
    })

    if (!updated) {
      throw new Error('Failed to update agent connection')
    }

    return updated
  }

  /**
   * 断开 Agent 连接
   */
  async disconnectAgent(id: string): Promise<void> {
    await this.agentRepository.setOffline(id)
  }

  /**
   * 更新 Agent 最后活跃时间
   */
  async updateLastSeen(id: string): Promise<void> {
    await this.agentRepository.updateLastSeen(id)
  }

  /**
   * 获取已连接的 Agent
   */
  async getConnectedAgents(): Promise<Agent[]> {
    return this.agentRepository.findConnectedAgents()
  }

  /**
   * 根据密钥获取 Agent
   */
  async getAgentBySecretKey(secretKey: string): Promise<Agent | null> {
    return this.agentRepository.findBySecretKey(secretKey)
  }

  /**
   * 验证 Agent 密钥
   */
  async validateAgentKey(secretKey: string): Promise<Agent | null> {
    if (!secretKey) {
      return null
    }
    return this.agentRepository.findBySecretKey(secretKey)
  }

  /**
   * 更新 Agent 状态
   */
  async updateAgentStatus(
    id: string,
    updates: {
      status?: 'pending' | 'connected' | 'offline'
      lastSeenAt?: Date
      ipAddress?: string
    }
  ): Promise<void> {
    const updateData: any = {}

    if (updates.status) {
      updateData.status = updates.status
    }
    if (updates.lastSeenAt) {
      updateData.lastSeenAt = updates.lastSeenAt
    }
    if (updates.ipAddress) {
      updateData.ipAddress = updates.ipAddress
    }

    await this.agentRepository.update(id, updateData)
  }

  /**
   * 高级查询和筛选 Agent
   */
  async getAgentsWithFilters(
    filters: AgentFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Agent>> {
    return this.agentRepository.findWithFilters(filters, pagination)
  }

  /**
   * 更新 Agent 验证结果
   */
  async updateValidationResult(id: string, result: ValidationResult): Promise<void> {
    const agent = await this.getAgentById(id)
    
    const updatedMetadata = {
      ...agent.metadata,
      lastValidationResult: result
    }

    await this.agentRepository.update(id, {
      metadata: updatedMetadata,
      lastValidatedAt: new Date()
    })
  }

  /**
   * 更新 Agent 监控配置
   */
  async updateMonitoringConfig(
    id: string,
    config: {
      enabled: boolean
      heartbeatInterval: number
      alertThresholds: {
        cpuUsage: number
        memoryUsage: number
        diskUsage: number
        responseTime: number
      }
      notificationChannels: string[]
    }
  ): Promise<void> {
    const agent = await this.getAgentById(id)
    
    const updatedMetadata = {
      ...agent.metadata,
      monitoringConfig: config
    }

    await this.agentRepository.update(id, { metadata: updatedMetadata })
  }

  /**
   * 添加或更新告警规则
   */
  async updateAlertRules(
    id: string,
    rules: Array<{
      id: string
      name: string
      condition: string
      threshold: number
      severity: 'low' | 'medium' | 'high' | 'critical'
      enabled: boolean
    }>
  ): Promise<void> {
    const agent = await this.getAgentById(id)
    
    const updatedMetadata = {
      ...agent.metadata,
      alertRules: rules
    }

    await this.agentRepository.update(id, { metadata: updatedMetadata })
  }

  /**
   * 获取需要验证的 Agent
   */
  async getAgentsNeedingValidation(olderThanMinutes: number = 30): Promise<Agent[]> {
    return this.agentRepository.findAgentsNeedingValidation(olderThanMinutes)
  }

  /**
   * 根据标签查找 Agent
   */
  async getAgentsByTags(tags: string[]): Promise<Agent[]> {
    return this.agentRepository.findByTags(tags)
  }

  /**
   * 获取 Agent 统计信息
   */
  async getAgentStatistics(): Promise<{
    total: number
    byStatus: Record<string, number>
    byPlatform: Record<string, number>
    recentlyActive: number
    withMonitoring: number
  }> {
    return this.agentRepository.getStatistics()
  }

  /**
   * 批量操作 Agent
   */
  async performBatchOperation(operation: BatchOperationDto): Promise<BatchOperationResult> {
    const { type, agentIds, payload, userId } = operation
    
    const result: BatchOperationResult = {
      totalCount: agentIds.length,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      results: []
    }

    switch (type) {
      case 'delete':
        const deleteResult = await this.agentRepository.batchDelete(agentIds)
        result.successCount = deleteResult.successCount
        result.failureCount = deleteResult.failureCount
        result.results = deleteResult.results
        break

      case 'update_status':
        if (!payload?.status) {
          throw new BadRequestException('Status is required for update_status operation')
        }
        
        const updateResult = await this.agentRepository.batchUpdate({
          ids: agentIds,
          updates: { status: payload.status },
          userId
        })
        result.successCount = updateResult.successCount
        result.failureCount = updateResult.failureCount
        result.results = updateResult.results
        break

      case 'update_tags':
        if (!payload?.tags) {
          throw new BadRequestException('Tags are required for update_tags operation')
        }
        
        const tagsResult = await this.agentRepository.batchUpdate({
          ids: agentIds,
          updates: { tags: payload.tags },
          userId
        })
        result.successCount = tagsResult.successCount
        result.failureCount = tagsResult.failureCount
        result.results = tagsResult.results
        break

      case 'update_monitoring':
        if (!payload?.monitoringConfig) {
          throw new BadRequestException('Monitoring config is required for update_monitoring operation')
        }
        
        // 批量更新监控配置需要特殊处理
        for (const agentId of agentIds) {
          try {
            await this.updateMonitoringConfig(agentId, payload.monitoringConfig)
            result.results.push({ agentId, success: true })
            result.successCount++
          } catch (error) {
            result.results.push({ agentId, success: false, error: error.message })
            result.failureCount++
          }
        }
        break

      default:
        throw new BadRequestException(`Unsupported batch operation type: ${type}`)
    }

    return result
  }

  /**
   * 创建默认监控配置
   */
  private createDefaultMonitoringConfig() {
    return {
      enabled: false,
      heartbeatInterval: 30000, // 30秒
      alertThresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        diskUsage: 90,
        responseTime: 5000
      },
      notificationChannels: []
    }
  }

  /**
   * 创建 Agent 时初始化默认配置
   */
  async createAgentWithDefaults(data: CreateAgentDto): Promise<Agent> {
    const agentData = {
      ...data,
      metadata: {
        monitoringConfig: this.createDefaultMonitoringConfig(),
        alertRules: [],
        permissions: {
          allowedOperations: ['read', 'validate', 'update'],
          accessLevel: 'read' as const,
          restrictions: []
        }
      }
    }

    // 生成唯一密钥
    let secretKey = this.generateSecretKey()
    let attempts = 0

    while (!(await this.agentRepository.isSecretKeyUnique(secretKey)) && attempts < 10) {
      secretKey = this.generateSecretKey()
      attempts++
    }

    if (attempts >= 10) {
      throw new Error('Failed to generate unique secret key')
    }

    const agent = await this.agentRepository.create({
      ...agentData,
      secretKey,
      status: 'pending'
    })

    return agent
  }

  /**
   * 验证 Agent 配置
   */
  validateAgentConfiguration(data: CreateAgentDto | UpdateAgentDto): string[] {
    const errors: string[] = []

    if ('name' in data && data.name) {
      if (data.name.length < 2 || data.name.length > 100) {
        errors.push('Agent name must be between 2 and 100 characters')
      }
    }

    if ('maxWorkers' in data && data.maxWorkers !== undefined) {
      if (data.maxWorkers < 1 || data.maxWorkers > 32) {
        errors.push('Max workers must be between 1 and 32')
      }
    }

    if ('tags' in data && data.tags) {
      if (data.tags.length > 20) {
        errors.push('Maximum 20 tags allowed')
      }
      
      for (const tag of data.tags) {
        if (tag.length > 50) {
          errors.push('Tag length cannot exceed 50 characters')
        }
      }
    }

    if ('allowedTools' in data && data.allowedTools) {
      const validTools = ['claude', 'qwen', 'gpt', 'gemini']
      const invalidTools = data.allowedTools.filter(tool => !validTools.includes(tool))
      if (invalidTools.length > 0) {
        errors.push(`Invalid tools: ${invalidTools.join(', ')}`)
      }
    }

    return errors
  }
}
