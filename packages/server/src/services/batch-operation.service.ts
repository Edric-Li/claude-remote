import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { Agent } from '../entities/agent.entity'
import { AgentRepository } from '../repositories/agent.repository'
import { OperationLogRepository } from '../repositories/operation-log.repository'
import { BatchOperationDto, BatchOperationResult } from './agent.service'

export interface BatchProgressCallback {
  (current: number, total: number, currentAgent?: string): void
}

export interface BatchOperationOptions {
  batchSize?: number
  delayBetweenBatches?: number
  continueOnError?: boolean
  validateBeforeOperation?: boolean
  onProgress?: BatchProgressCallback
}

export interface BatchValidationResult {
  agentId: string
  valid: boolean
  reason?: string
  canProceed: boolean
}

@Injectable()
export class BatchOperationService {
  private readonly logger = new Logger(BatchOperationService.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly agentRepository: AgentRepository,
    private readonly operationLogRepository: OperationLogRepository
  ) {}

  /**
   * 执行批量操作
   */
  async executeBatchOperation(
    operation: BatchOperationDto,
    options: BatchOperationOptions = {}
  ): Promise<BatchOperationResult> {
    const {
      batchSize = 10,
      delayBetweenBatches = 1000,
      continueOnError = true,
      validateBeforeOperation = true,
      onProgress
    } = options

    this.logger.log(`Starting batch operation: ${operation.type} for ${operation.agentIds.length} agents`)

    // 预验证
    let validationResults: BatchValidationResult[] = []
    if (validateBeforeOperation) {
      validationResults = await this.validateBatchOperation(operation)
      const invalidAgents = validationResults.filter(r => !r.canProceed)
      
      if (invalidAgents.length > 0 && !continueOnError) {
        throw new BadRequestException(
          `Validation failed for agents: ${invalidAgents.map(a => a.agentId).join(', ')}`
        )
      }
    }

    const result: BatchOperationResult = {
      totalCount: operation.agentIds.length,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      results: []
    }

    // 处理预验证失败的Agent
    for (const validation of validationResults) {
      if (!validation.canProceed) {
        result.results.push({
          agentId: validation.agentId,
          success: false,
          skipped: true,
          reason: validation.reason
        })
        result.skippedCount++
      }
    }

    // 获取可以处理的Agent IDs
    const validAgentIds = validationResults.length > 0 
      ? validationResults.filter(r => r.canProceed).map(r => r.agentId)
      : operation.agentIds

    // 分批处理
    for (let i = 0; i < validAgentIds.length; i += batchSize) {
      const batch = validAgentIds.slice(i, i + batchSize)
      
      this.logger.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validAgentIds.length / batchSize)}`)

      const batchResults = await this.processBatch(operation, batch, options)
      
      // 合并批次结果
      for (const batchResult of batchResults) {
        result.results.push(batchResult)
        if (batchResult.success) {
          result.successCount++
        } else if (batchResult.skipped) {
          result.skippedCount++
        } else {
          result.failureCount++
        }
      }

      // 更新进度
      onProgress?.(i + batch.length, validAgentIds.length)

      // 批次间延迟
      if (i + batchSize < validAgentIds.length && delayBetweenBatches > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
      }
    }

    // 记录批量操作日志
    await this.logBatchOperation(operation, result)

    this.logger.log(
      `Batch operation completed: ${result.successCount} success, ${result.failureCount} failed, ${result.skippedCount} skipped`
    )

    return result
  }

  /**
   * 批量删除Agent
   */
  async batchDeleteAgents(
    agentIds: string[],
    userId: string,
    options: BatchOperationOptions = {}
  ): Promise<BatchOperationResult> {
    const operation: BatchOperationDto = {
      type: 'delete',
      agentIds,
      userId
    }

    return this.executeBatchOperation(operation, {
      ...options,
      validateBeforeOperation: true
    })
  }

  /**
   * 批量更新Agent状态
   */
  async batchUpdateStatus(
    agentIds: string[],
    status: 'pending' | 'connected' | 'offline',
    userId: string,
    options: BatchOperationOptions = {}
  ): Promise<BatchOperationResult> {
    const operation: BatchOperationDto = {
      type: 'update_status',
      agentIds,
      payload: { status },
      userId
    }

    return this.executeBatchOperation(operation, options)
  }

  /**
   * 批量更新Agent标签
   */
  async batchUpdateTags(
    agentIds: string[],
    tags: string[],
    mode: 'replace' | 'add' | 'remove',
    userId: string,
    options: BatchOperationOptions = {}
  ): Promise<BatchOperationResult> {
    const operation: BatchOperationDto = {
      type: 'update_tags',
      agentIds,
      payload: { tags, mode },
      userId
    }

    return this.executeBatchOperation(operation, options)
  }

  /**
   * 批量更新监控配置
   */
  async batchUpdateMonitoring(
    agentIds: string[],
    monitoringConfig: any,
    userId: string,
    options: BatchOperationOptions = {}
  ): Promise<BatchOperationResult> {
    const operation: BatchOperationDto = {
      type: 'update_monitoring',
      agentIds,
      payload: { monitoringConfig },
      userId
    }

    return this.executeBatchOperation(operation, options)
  }

  /**
   * 验证批量操作
   */
  async validateBatchOperation(operation: BatchOperationDto): Promise<BatchValidationResult[]> {
    const results: BatchValidationResult[] = []

    // 获取所有相关Agent信息
    const agents = await this.agentRepository.findAll({
      where: { id: this.dataSource.createQueryBuilder().where('id IN (:...ids)', { ids: operation.agentIds }).getSql() }
    })

    const existingAgentIds = agents.map(a => a.id)
    const missingAgentIds = operation.agentIds.filter(id => !existingAgentIds.includes(id))

    // 处理不存在的Agent
    for (const missingId of missingAgentIds) {
      results.push({
        agentId: missingId,
        valid: false,
        reason: 'Agent not found',
        canProceed: false
      })
    }

    // 验证现有Agent
    for (const agent of agents) {
      const validation = this.validateSingleAgentOperation(agent, operation)
      results.push(validation)
    }

    return results
  }

  /**
   * 获取批量操作预览
   */
  async getBatchOperationPreview(operation: BatchOperationDto): Promise<{
    totalCount: number
    validCount: number
    invalidCount: number
    validations: BatchValidationResult[]
    estimatedDuration: number
  }> {
    const validations = await this.validateBatchOperation(operation)
    const validCount = validations.filter(v => v.canProceed).length
    const invalidCount = validations.filter(v => !v.canProceed).length

    // 估算执行时间（毫秒）
    const estimatedDurationPerAgent = this.getEstimatedDurationForOperation(operation.type)
    const estimatedDuration = validCount * estimatedDurationPerAgent

    return {
      totalCount: operation.agentIds.length,
      validCount,
      invalidCount,
      validations,
      estimatedDuration
    }
  }

  /**
   * 处理单个批次
   */
  private async processBatch(
    operation: BatchOperationDto,
    agentIds: string[],
    options: BatchOperationOptions
  ): Promise<Array<{
    agentId: string
    success: boolean
    error?: string
    skipped?: boolean
    reason?: string
  }>> {
    const results = []

    // 使用事务处理批次操作
    await this.dataSource.transaction(async manager => {
      for (const agentId of agentIds) {
        try {
          const agent = await manager.findOne(Agent, { where: { id: agentId } })
          if (!agent) {
            results.push({
              agentId,
              success: false,
              error: 'Agent not found'
            })
            continue
          }

          const success = await this.executeOperationOnAgent(agent, operation, manager)
          results.push({
            agentId,
            success
          })

        } catch (error) {
          this.logger.error(`Failed to process agent ${agentId} in batch:`, error)
          results.push({
            agentId,
            success: false,
            error: error.message
          })

          if (!options.continueOnError) {
            throw error
          }
        }
      }
    })

    return results
  }

  /**
   * 在单个Agent上执行操作
   */
  private async executeOperationOnAgent(
    agent: Agent,
    operation: BatchOperationDto,
    manager: any
  ): Promise<boolean> {
    switch (operation.type) {
      case 'delete':
        if (agent.status === 'connected') {
          throw new Error('Cannot delete connected agent')
        }
        await manager.remove(agent)
        return true

      case 'update_status':
        agent.status = operation.payload.status
        agent.lastSeenAt = operation.payload.status === 'connected' ? new Date() : agent.lastSeenAt
        await manager.save(agent)
        return true

      case 'update_tags':
        const { tags, mode } = operation.payload
        switch (mode) {
          case 'replace':
            agent.tags = tags
            break
          case 'add':
            agent.tags = [...(agent.tags || []), ...tags].filter((tag, index, arr) => arr.indexOf(tag) === index)
            break
          case 'remove':
            agent.tags = (agent.tags || []).filter(tag => !tags.includes(tag))
            break
        }
        await manager.save(agent)
        return true

      case 'update_monitoring':
        agent.metadata = {
          ...agent.metadata,
          monitoringConfig: operation.payload.monitoringConfig
        }
        await manager.save(agent)
        return true

      default:
        throw new Error(`Unsupported operation type: ${operation.type}`)
    }
  }

  /**
   * 验证单个Agent操作
   */
  private validateSingleAgentOperation(
    agent: Agent,
    operation: BatchOperationDto
  ): BatchValidationResult {
    const result: BatchValidationResult = {
      agentId: agent.id,
      valid: true,
      canProceed: true
    }

    switch (operation.type) {
      case 'delete':
        if (agent.status === 'connected') {
          result.valid = false
          result.reason = 'Cannot delete connected agent'
          result.canProceed = false
        }
        break

      case 'update_status':
        if (!operation.payload?.status) {
          result.valid = false
          result.reason = 'Status is required'
          result.canProceed = false
        }
        break

      case 'update_tags':
        if (!operation.payload?.tags || !Array.isArray(operation.payload.tags)) {
          result.valid = false
          result.reason = 'Valid tags array is required'
          result.canProceed = false
        }
        break

      case 'update_monitoring':
        if (!operation.payload?.monitoringConfig) {
          result.valid = false
          result.reason = 'Monitoring configuration is required'
          result.canProceed = false
        }
        break
    }

    return result
  }

  /**
   * 获取操作预估时间
   */
  private getEstimatedDurationForOperation(operationType: string): number {
    const durations = {
      'delete': 500,
      'update_status': 200,
      'update_tags': 300,
      'update_monitoring': 400
    }

    return durations[operationType] || 300
  }

  /**
   * 记录批量操作日志
   */
  private async logBatchOperation(
    operation: BatchOperationDto,
    result: BatchOperationResult
  ): Promise<void> {
    try {
      await this.operationLogRepository.logOperation(
        'batch_operation',
        operation.userId,
        undefined, // 批量操作不关联特定Agent
        {
          batchSize: operation.agentIds.length,
          operationType: operation.type,
          affectedAgents: operation.agentIds,
          successCount: result.successCount,
          failureCount: result.failureCount,
          skippedCount: result.skippedCount,
          payload: operation.payload
        },
        result.failureCount === 0,
        result.failureCount > 0 ? `${result.failureCount} operations failed` : undefined,
        undefined,
        undefined,
        undefined,
        result.failureCount === 0 ? 'info' : 'warning'
      )
    } catch (error) {
      this.logger.error('Failed to log batch operation:', error)
    }
  }

  /**
   * 获取批量操作历史
   */
  async getBatchOperationHistory(
    userId?: string,
    days: number = 7,
    limit: number = 50
  ): Promise<any[]> {
    const query = {
      operation: 'batch_operation',
      userId,
      startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      limit
    }

    const { logs } = await this.operationLogRepository.findOperationLogs(query)
    
    return logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      userId: log.userId,
      operationType: log.details?.operationType,
      batchSize: log.details?.batchSize,
      successCount: log.details?.successCount,
      failureCount: log.details?.failureCount,
      skippedCount: log.details?.skippedCount,
      success: log.success,
      duration: log.details?.duration
    }))
  }

  /**
   * 取消正在进行的批量操作
   */
  async cancelBatchOperation(operationId: string): Promise<boolean> {
    // 这里需要实现操作取消逻辑
    // 在实际系统中，可能需要使用消息队列或者其他机制来处理长时间运行的批量操作
    this.logger.warn(`Cancellation requested for batch operation ${operationId} (not implemented)`)
    return false
  }
}