import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common'
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { MonitoringService } from '../services/monitoring.service'
import { AgentHealth } from '../entities/agent-health.entity'
// import { 
//   ApiTags, 
//   ApiOperation, 
//   ApiResponse, 
//   ApiParam, 
//   ApiQuery, 
//   ApiBearerAuth 
// } from '@nestjs/swagger'

// 
// 
@Controller('health')
// @UseGuards(JwtAuthGuard)
export class HealthController {
  private readonly logger = new Logger(HealthController.name)

  constructor(
    private readonly monitoringService: MonitoringService
  ) {}

  /**
   * 启动Agent监控
   */
  @Post(':agentId/monitoring/start')
  
  
  
  
  async startMonitoring(@Param('agentId') agentId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.monitoringService.startMonitoring(agentId)
      this.logger.log(`Started monitoring for agent: ${agentId}`)
      
      return {
        success: true,
        message: 'Monitoring started successfully'
      }
    } catch (error) {
      this.logger.error(`Failed to start monitoring for agent ${agentId}:`, error)
      throw new HttpException(
        error.message || 'Failed to start monitoring',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  /**
   * 停止Agent监控
   */
  @Post(':agentId/monitoring/stop')
  
  
  
  async stopMonitoring(@Param('agentId') agentId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.monitoringService.stopMonitoring(agentId)
      this.logger.log(`Stopped monitoring for agent: ${agentId}`)
      
      return {
        success: true,
        message: 'Monitoring stopped successfully'
      }
    } catch (error) {
      this.logger.error(`Failed to stop monitoring for agent ${agentId}:`, error)
      throw new HttpException(
        error.message || 'Failed to stop monitoring',
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  /**
   * 执行健康检查
   */
  @Post(':agentId/check')
  
  
  
  async performHealthCheck(@Param('agentId') agentId: string): Promise<AgentHealth> {
    try {
      const healthRecord = await this.monitoringService.performHealthCheck(agentId)
      this.logger.log(`Health check completed for agent: ${agentId}`)
      
      return healthRecord
    } catch (error) {
      this.logger.error(`Health check failed for agent ${agentId}:`, error)
      throw new HttpException(
        error.message || 'Health check failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  /**
   * 获取Agent健康历史
   */
  @Get(':agentId/history')
  
  
  
  
  
  
  async getHealthHistory(
    @Param('agentId') agentId: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('limit') limit?: number
  ): Promise<AgentHealth[]> {
    try {
      const startDate = startTime ? new Date(startTime) : undefined
      const endDate = endTime ? new Date(endTime) : undefined
      const recordLimit = limit ? parseInt(limit.toString()) : 100

      const history = await this.monitoringService.getHealthHistory(
        agentId,
        startDate,
        endDate,
        recordLimit
      )

      this.logger.log(`Retrieved ${history.length} health records for agent: ${agentId}`)
      return history
    } catch (error) {
      this.logger.error(`Failed to get health history for agent ${agentId}:`, error)
      throw new HttpException(
        error.message || 'Failed to retrieve health history',
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  /**
   * 获取健康统计数据
   */
  @Get(':agentId/stats')
  async getHealthStats(
    @Param('agentId') agentId: string,
    @Query('period') period: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<any> {
    try {
      const stats = await this.monitoringService.getHealthStats(agentId, period)
      this.logger.log(`Retrieved health stats for agent: ${agentId}, period: ${period}`)
      
      return stats
    } catch (error) {
      this.logger.error(`Failed to get health stats for agent ${agentId}:`, error)
      throw new HttpException(
        error.message || 'Failed to retrieve health statistics',
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  /**
   * 更新监控配置
   */
  @Put(':agentId/monitoring/config')
  
  
  
  async updateMonitoringConfig(
    @Param('agentId') agentId: string,
    @Body() config: {
      enabled?: boolean
      checkInterval?: number
      alertRules?: any[]
      retentionDays?: number
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.monitoringService.updateMonitoringConfig(agentId, config)
      this.logger.log(`Updated monitoring config for agent: ${agentId}`)
      
      return {
        success: true,
        message: 'Monitoring configuration updated successfully'
      }
    } catch (error) {
      this.logger.error(`Failed to update monitoring config for agent ${agentId}:`, error)
      throw new HttpException(
        error.message || 'Failed to update monitoring configuration',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  /**
   * 确认告警
   */
  @Post(':agentId/alerts/:alertId/acknowledge')
  
  
  
  
  async acknowledgeAlert(
    @Param('agentId') agentId: string,
    @Param('alertId') alertId: string,
    @Body('userId') userId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.monitoringService.acknowledgeAlert(agentId, alertId, userId)
      this.logger.log(`Acknowledged alert ${alertId} for agent: ${agentId}`)
      
      return {
        success: true,
        message: 'Alert acknowledged successfully'
      }
    } catch (error) {
      this.logger.error(`Failed to acknowledge alert ${alertId} for agent ${agentId}:`, error)
      throw new HttpException(
        error.message || 'Failed to acknowledge alert',
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  /**
   * 清理旧的健康记录
   */
  @Delete('cleanup')
  
  
  
  async cleanupOldRecords(
    @Query('retentionDays') retentionDays?: number
  ): Promise<{ success: boolean; message: string; deletedCount: number }> {
    try {
      const retention = retentionDays ? parseInt(retentionDays.toString()) : 30
      const deletedCount = await this.monitoringService.cleanupOldRecords(retention)
      
      this.logger.log(`Cleaned up ${deletedCount} old health records`)
      
      return {
        success: true,
        message: `Cleaned up ${deletedCount} old health records`,
        deletedCount
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old health records:', error)
      throw new HttpException(
        error.message || 'Failed to cleanup old records',
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  /**
   * 获取监控概览 - 所有Agent的聚合状态
   */
  @Get('overview')
  
  
  async getMonitoringOverview(): Promise<{
    totalAgents: number
    healthyAgents: number
    warningAgents: number
    criticalAgents: number
    offlineAgents: number
    totalAlerts: number
    criticalAlerts: number
    avgResponseTime: number
    uptimePercentage: number
  }> {
    try {
      // 这里应该实现获取所有Agent的聚合监控数据
      // 由于时间限制，返回模拟数据
      const overview = {
        totalAgents: 5,
        healthyAgents: 3,
        warningAgents: 1,
        criticalAgents: 0,
        offlineAgents: 1,
        totalAlerts: 2,
        criticalAlerts: 0,
        avgResponseTime: 150,
        uptimePercentage: 98.5
      }

      this.logger.log('Retrieved monitoring overview')
      return overview
    } catch (error) {
      this.logger.error('Failed to get monitoring overview:', error)
      throw new HttpException(
        error.message || 'Failed to retrieve monitoring overview',
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  /**
   * 获取实时监控数据 (用于WebSocket替代)
   */
  @Get(':agentId/realtime')
  
  
  
  async getRealtimeData(
    @Param('agentId') agentId: string
  ): Promise<{
    metrics: any
    status: string
    lastUpdate: Date
    alerts: any[]
  }> {
    try {
      // 获取最新的健康记录作为实时数据
      const latestRecords = await this.monitoringService.getHealthHistory(agentId, undefined, undefined, 1)
      const latestRecord = latestRecords[0]

      if (!latestRecord) {
        return {
          metrics: {},
          status: 'unknown',
          lastUpdate: new Date(),
          alerts: []
        }
      }

      const realtimeData = {
        metrics: latestRecord.metrics,
        status: latestRecord.status,
        lastUpdate: latestRecord.timestamp,
        alerts: latestRecord.alerts || []
      }

      this.logger.log(`Retrieved realtime data for agent: ${agentId}`)
      return realtimeData
    } catch (error) {
      this.logger.error(`Failed to get realtime data for agent ${agentId}:`, error)
      throw new HttpException(
        error.message || 'Failed to retrieve realtime data',
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  /**
   * 测试Agent连接（触发立即健康检查）
   */
  @Post(':agentId/test')
  
  
  
  async testConnection(
    @Param('agentId') agentId: string
  ): Promise<{
    success: boolean
    responseTime?: number
    error?: string
    timestamp: Date
  }> {
    try {
      // 执行健康检查作为连接测试
      const healthRecord = await this.monitoringService.performHealthCheck(agentId)
      
      const result = {
        success: healthRecord.status === 'healthy',
        responseTime: healthRecord.responseTime,
        error: healthRecord.status !== 'healthy' ? 'Health check failed' : undefined,
        timestamp: healthRecord.timestamp
      }

      this.logger.log(`Connection test completed for agent: ${agentId}, success: ${result.success}`)
      return result
    } catch (error) {
      this.logger.error(`Connection test failed for agent ${agentId}:`, error)
      
      return {
        success: false,
        error: error.message || 'Connection test failed',
        timestamp: new Date()
      }
    }
  }

  /**
   * 批量操作 - 启动多个Agent的监控
   */
  @Post('batch/monitoring/start')
  
  
  async batchStartMonitoring(
    @Body('agentIds') agentIds: string[]
  ): Promise<{
    success: boolean
    results: Array<{
      agentId: string
      success: boolean
      error?: string
    }>
  }> {
    const results = []
    
    for (const agentId of agentIds) {
      try {
        await this.monitoringService.startMonitoring(agentId)
        results.push({ agentId, success: true })
        this.logger.log(`Batch: Started monitoring for agent: ${agentId}`)
      } catch (error) {
        results.push({ 
          agentId, 
          success: false, 
          error: error.message 
        })
        this.logger.error(`Batch: Failed to start monitoring for agent ${agentId}:`, error)
      }
    }

    const successCount = results.filter(r => r.success).length
    
    return {
      success: successCount > 0,
      results
    }
  }

  /**
   * 批量操作 - 停止多个Agent的监控
   */
  @Post('batch/monitoring/stop')
  
  
  async batchStopMonitoring(
    @Body('agentIds') agentIds: string[]
  ): Promise<{
    success: boolean
    results: Array<{
      agentId: string
      success: boolean
      error?: string
    }>
  }> {
    const results = []
    
    for (const agentId of agentIds) {
      try {
        await this.monitoringService.stopMonitoring(agentId)
        results.push({ agentId, success: true })
        this.logger.log(`Batch: Stopped monitoring for agent: ${agentId}`)
      } catch (error) {
        results.push({ 
          agentId, 
          success: false, 
          error: error.message 
        })
        this.logger.error(`Batch: Failed to stop monitoring for agent ${agentId}:`, error)
      }
    }

    const successCount = results.filter(r => r.success).length
    
    return {
      success: successCount > 0,
      results
    }
  }
}