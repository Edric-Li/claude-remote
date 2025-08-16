import { Injectable, Logger } from '@nestjs/common'
import { Agent } from '../entities/agent.entity'
import { ValidationResult } from './agent.service'
import { AgentRepository } from '../repositories/agent.repository'
import { OperationLogRepository } from '../repositories/operation-log.repository'
import * as crypto from 'crypto'

export interface ConnectionTestOptions {
  timeout?: number
  retries?: number
  checkResources?: boolean
  checkAuthentication?: boolean
}

export interface ValidationConfiguration {
  defaultTimeout: number
  maxRetries: number
  validationInterval: number
  enableResourceCheck: boolean
  enableAuthCheck: boolean
  batchSize: number
}

@Injectable()
export class AgentValidationService {
  private readonly logger = new Logger(AgentValidationService.name)
  
  private readonly defaultConfig: ValidationConfiguration = {
    defaultTimeout: 10000, // 10秒
    maxRetries: 3,
    validationInterval: 30 * 60 * 1000, // 30分钟
    enableResourceCheck: true,
    enableAuthCheck: true,
    batchSize: 10
  }

  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly operationLogRepository: OperationLogRepository
  ) {}

  /**
   * 测试单个Agent的连接
   */
  async testConnection(
    agent: Agent,
    options: ConnectionTestOptions = {}
  ): Promise<ValidationResult> {
    const startTime = Date.now()
    const timeout = options.timeout || this.defaultConfig.defaultTimeout
    const retries = options.retries || this.defaultConfig.maxRetries

    this.logger.log(`Starting connection test for Agent: ${agent.name} (${agent.id})`)

    const result: ValidationResult = {
      success: false,
      timestamp: new Date(),
      responseTime: 0,
      warnings: [],
      metrics: {
        connectivity: false,
        authentication: false,
        resourceAvailability: false
      }
    }

    try {
      // 模拟连接测试逻辑
      // 在实际实现中，这里会发送HTTP请求或建立Socket连接到Agent
      
      // 1. 基础连通性测试
      const connectivityResult = await this.testConnectivity(agent, timeout)
      result.metrics!.connectivity = connectivityResult.success
      
      if (!connectivityResult.success) {
        result.errorMessage = connectivityResult.error
        result.responseTime = Date.now() - startTime
        await this.logValidationResult(agent.id, result, 'admin')
        return result
      }

      // 2. 认证测试
      if (options.checkAuthentication !== false) {
        const authResult = await this.testAuthentication(agent, timeout)
        result.metrics!.authentication = authResult.success
        
        if (!authResult.success) {
          result.warnings?.push(`Authentication test failed: ${authResult.error}`)
        }
      } else {
        result.metrics!.authentication = true
      }

      // 3. 资源可用性测试
      if (options.checkResources !== false) {
        const resourceResult = await this.testResourceAvailability(agent)
        result.metrics!.resourceAvailability = resourceResult.success
        
        if (!resourceResult.success) {
          result.warnings?.push(`Resource check failed: ${resourceResult.error}`)
        }
      } else {
        result.metrics!.resourceAvailability = true
      }

      // 4. 计算最终结果
      const allTestsPassed = result.metrics!.connectivity && 
                           result.metrics!.authentication && 
                           result.metrics!.resourceAvailability

      result.success = allTestsPassed
      result.responseTime = Date.now() - startTime

      if (result.success) {
        this.logger.log(`✅ Connection test passed for Agent: ${agent.name}`)
      } else {
        this.logger.warn(`⚠️ Connection test completed with warnings for Agent: ${agent.name}`)
      }

    } catch (error) {
      this.logger.error(`❌ Connection test failed for Agent: ${agent.name}`, error.stack)
      result.success = false
      result.errorMessage = `Connection test failed: ${error.message}`
      result.responseTime = Date.now() - startTime
    }

    // 记录验证结果
    await this.logValidationResult(agent.id, result, 'system')

    return result
  }

  /**
   * 批量验证多个Agent
   */
  async batchValidateAgents(
    agentIds: string[],
    options: ConnectionTestOptions = {}
  ): Promise<Array<{ agentId: string; result: ValidationResult }>> {
    const results: Array<{ agentId: string; result: ValidationResult }> = []
    const batchSize = this.defaultConfig.batchSize

    this.logger.log(`Starting batch validation for ${agentIds.length} agents`)

    // 分批处理以避免过载
    for (let i = 0; i < agentIds.length; i += batchSize) {
      const batch = agentIds.slice(i, i + batchSize)
      const batchPromises = batch.map(async (agentId) => {
        try {
          const agent = await this.agentRepository.findById(agentId)
          if (!agent) {
            return {
              agentId,
              result: {
                success: false,
                timestamp: new Date(),
                responseTime: 0,
                errorMessage: 'Agent not found'
              } as ValidationResult
            }
          }

          const result = await this.testConnection(agent, options)
          return { agentId, result }
        } catch (error) {
          this.logger.error(`Batch validation failed for agent ${agentId}:`, error)
          return {
            agentId,
            result: {
              success: false,
              timestamp: new Date(),
              responseTime: 0,
              errorMessage: error.message
            } as ValidationResult
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // 在批次之间添加小延迟，避免过载
      if (i + batchSize < agentIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    this.logger.log(`Batch validation completed: ${results.filter(r => r.result.success).length}/${results.length} passed`)

    return results
  }

  /**
   * 验证Agent配置的完整性
   */
  validateConfiguration(agent: Agent): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // 基础字段验证
    if (!agent.name || agent.name.trim().length === 0) {
      errors.push('Agent name is required')
    }

    if (!agent.secretKey || agent.secretKey.length < 10) {
      errors.push('Valid secret key is required')
    }

    if (agent.maxWorkers < 1 || agent.maxWorkers > 32) {
      errors.push('Max workers must be between 1 and 32')
    }

    // 验证密钥格式
    if (agent.secretKey && !this.isValidSecretKeyFormat(agent.secretKey)) {
      warnings.push('Secret key format may be invalid')
    }

    // 验证标签
    if (agent.tags && agent.tags.length > 20) {
      warnings.push('Too many tags (max 20 recommended)')
    }

    // 验证工具配置
    if (agent.allowedTools && agent.allowedTools.length === 0) {
      warnings.push('No allowed tools configured')
    }

    // 验证监控配置
    if (agent.metadata?.monitoringConfig) {
      const monitoringErrors = this.validateMonitoringConfig(agent.metadata.monitoringConfig)
      warnings.push(...monitoringErrors)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 获取需要验证的Agent列表
   */
  async getAgentsRequiringValidation(): Promise<Agent[]> {
    const olderThanMinutes = this.defaultConfig.validationInterval / (60 * 1000)
    return this.agentRepository.findAgentsNeedingValidation(olderThanMinutes)
  }

  /**
   * 定期验证任务
   */
  async runPeriodicValidation(): Promise<{
    totalChecked: number
    passed: number
    failed: number
    warnings: number
  }> {
    this.logger.log('Starting periodic validation task')

    const agentsToValidate = await this.getAgentsRequiringValidation()
    
    if (agentsToValidate.length === 0) {
      this.logger.log('No agents require validation at this time')
      return { totalChecked: 0, passed: 0, failed: 0, warnings: 0 }
    }

    const agentIds = agentsToValidate.map(a => a.id)
    const results = await this.batchValidateAgents(agentIds, {
      timeout: this.defaultConfig.defaultTimeout,
      retries: 1 // 减少重试次数用于定期检查
    })

    let passed = 0
    let failed = 0
    let warnings = 0

    for (const { agentId, result } of results) {
      if (result.success) {
        passed++
      } else {
        failed++
      }
      
      if (result.warnings && result.warnings.length > 0) {
        warnings++
      }

      // 更新Agent的验证结果
      try {
        await this.updateAgentValidationResult(agentId, result)
      } catch (error) {
        this.logger.error(`Failed to update validation result for agent ${agentId}:`, error)
      }
    }

    this.logger.log(`Periodic validation completed: ${passed} passed, ${failed} failed, ${warnings} with warnings`)

    return {
      totalChecked: results.length,
      passed,
      failed,
      warnings
    }
  }

  /**
   * 私有方法：测试连通性
   */
  private async testConnectivity(agent: Agent, timeout: number): Promise<{
    success: boolean
    error?: string
  }> {
    // 模拟连通性测试
    // 实际实现中会根据Agent的连接信息进行测试
    
    try {
      // 模拟网络请求延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000))
      
      // 根据Agent状态返回结果
      if (agent.status === 'connected') {
        return { success: true }
      } else {
        return { success: false, error: 'Agent is not in connected state' }
      }
    } catch (error) {
      return { success: false, error: `Connectivity test failed: ${error.message}` }
    }
  }

  /**
   * 私有方法：测试认证
   */
  private async testAuthentication(agent: Agent, timeout: number): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // 验证密钥格式和有效性
      if (!this.isValidSecretKeyFormat(agent.secretKey)) {
        return { success: false, error: 'Invalid secret key format' }
      }

      // 模拟认证测试
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500))
      
      return { success: true }
    } catch (error) {
      return { success: false, error: `Authentication test failed: ${error.message}` }
    }
  }

  /**
   * 私有方法：测试资源可用性
   */
  private async testResourceAvailability(agent: Agent): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // 检查资源配置
      if (!agent.resources) {
        return { success: false, error: 'No resource information available' }
      }

      const { cpuCores, memory, diskSpace } = agent.resources

      // 基础资源验证
      if (cpuCores < 1) {
        return { success: false, error: 'Insufficient CPU cores' }
      }

      if (memory < 1024) { // 至少1GB内存
        return { success: false, error: 'Insufficient memory' }
      }

      if (diskSpace < 5120) { // 至少5GB磁盘空间
        return { success: false, error: 'Insufficient disk space' }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: `Resource availability test failed: ${error.message}` }
    }
  }

  /**
   * 私有方法：验证密钥格式
   */
  private isValidSecretKeyFormat(secretKey: string): boolean {
    // 验证密钥格式：AIO-XXXX-XXXX-XXXX-XXXX
    const pattern = /^AIO-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/
    return pattern.test(secretKey)
  }

  /**
   * 私有方法：验证监控配置
   */
  private validateMonitoringConfig(config: any): string[] {
    const warnings: string[] = []

    if (config.heartbeatInterval < 5000) {
      warnings.push('Heartbeat interval too short (minimum 5 seconds recommended)')
    }

    if (config.heartbeatInterval > 300000) {
      warnings.push('Heartbeat interval too long (maximum 5 minutes recommended)')
    }

    if (config.alertThresholds) {
      const { cpuUsage, memoryUsage, diskUsage, responseTime } = config.alertThresholds

      if (cpuUsage && (cpuUsage < 50 || cpuUsage > 95)) {
        warnings.push('CPU usage threshold should be between 50% and 95%')
      }

      if (memoryUsage && (memoryUsage < 50 || memoryUsage > 95)) {
        warnings.push('Memory usage threshold should be between 50% and 95%')
      }

      if (diskUsage && (diskUsage < 70 || diskUsage > 95)) {
        warnings.push('Disk usage threshold should be between 70% and 95%')
      }

      if (responseTime && responseTime < 1000) {
        warnings.push('Response time threshold too low (minimum 1 second recommended)')
      }
    }

    return warnings
  }

  /**
   * 私有方法：记录验证结果
   */
  private async logValidationResult(
    agentId: string,
    result: ValidationResult,
    userId: string
  ): Promise<void> {
    try {
      await this.operationLogRepository.logOperation(
        'validate',
        userId,
        agentId,
        {
          validationResults: {
            success: result.success,
            responseTime: result.responseTime,
            metrics: result.metrics,
            warnings: result.warnings
          }
        },
        result.success,
        result.errorMessage,
        undefined,
        undefined,
        undefined,
        result.success ? 'info' : 'warning'
      )
    } catch (error) {
      this.logger.error(`Failed to log validation result for agent ${agentId}:`, error)
    }
  }

  /**
   * 私有方法：更新Agent验证结果
   */
  private async updateAgentValidationResult(
    agentId: string,
    result: ValidationResult
  ): Promise<void> {
    const agent = await this.agentRepository.findById(agentId)
    if (!agent) return

    const updatedMetadata = {
      ...agent.metadata,
      lastValidationResult: result
    }

    await this.agentRepository.update(agentId, {
      metadata: updatedMetadata,
      lastValidatedAt: new Date()
    })
  }
}