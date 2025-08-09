import { Injectable } from '@nestjs/common'
import { BaseRepository } from './base.repository'
import { Worker } from '../entities/worker.entity'
import { DataSource, FindOptionsWhere, MoreThan, LessThan } from 'typeorm'

@Injectable()
export class WorkerRepository extends BaseRepository<Worker> {
  private dataSource: DataSource
  
  constructor(dataSource: DataSource) {
    super(dataSource.getRepository(Worker))
    this.dataSource = dataSource
  }
  

  /**
   * 查找 Agent 的所有 Worker
   */
  async findByAgentId(agentId: string): Promise<Worker[]> {
    return this.repository.find({
      where: { agentId },
      relations: ['agent'],
      order: { createdAt: 'DESC' }
    })
  }

  /**
   * 查找活跃的 Worker
   */
  async findActiveWorkers(agentId?: string): Promise<Worker[]> {
    const where: FindOptionsWhere<Worker> = {
      status: 'idle' as any
    }
    
    if (agentId) {
      where.agentId = agentId
    }
    
    return this.repository.find({
      where,
      relations: ['agent']
    })
  }

  /**
   * 根据 workerId 和 agentId 查找
   */
  async findByWorkerAndAgent(workerId: string, agentId: string): Promise<Worker | null> {
    return this.repository.findOne({
      where: { workerId, agentId },
      relations: ['agent']
    })
  }

  /**
   * 更新 Worker 状态
   */
  async updateStatus(
    id: string, 
    status: 'idle' | 'busy' | 'offline' | 'error',
    taskInfo?: { taskId?: string; taskType?: string }
  ): Promise<void> {
    const updateData: any = { status }
    
    if (taskInfo) {
      if (taskInfo.taskId !== undefined) {
        updateData.currentTaskId = taskInfo.taskId
      }
      if (taskInfo.taskType !== undefined) {
        updateData.currentTaskType = taskInfo.taskType
      }
    }
    
    await this.repository.update(id, updateData)
  }

  /**
   * 更新心跳时间
   */
  async updateHeartbeat(id: string): Promise<void> {
    await this.repository.update(id, {
      lastHeartbeat: new Date()
    })
  }

  /**
   * 批量更新心跳时间
   */
  async updateHeartbeatBatch(workerIds: string[]): Promise<void> {
    if (workerIds.length === 0) return
    
    await this.repository
      .createQueryBuilder()
      .update(Worker)
      .set({ lastHeartbeat: new Date() })
      .whereInIds(workerIds)
      .execute()
  }

  /**
   * 查找超时的 Worker
   */
  async findTimeoutWorkers(timeoutSeconds: number = 60): Promise<Worker[]> {
    const timeout = new Date()
    timeout.setSeconds(timeout.getSeconds() - timeoutSeconds)
    
    return this.repository.find({
      where: {
        status: 'idle' as any,
        lastHeartbeat: LessThan(timeout)
      }
    })
  }

  /**
   * 更新 Worker 指标
   */
  async updateMetrics(
    id: string,
    metrics: Partial<Worker['metrics']>
  ): Promise<void> {
    const worker = await this.findById(id)
    if (!worker) return
    
    const currentMetrics = worker.metrics || {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      successRate: 0,
      lastTaskCompletedAt: null
    }
    
    const updatedMetrics = {
      ...currentMetrics,
      ...metrics
    }
    
    // 重新计算平均执行时间和成功率
    const totalTasks = updatedMetrics.tasksCompleted + updatedMetrics.tasksFailed
    if (totalTasks > 0) {
      updatedMetrics.averageExecutionTime = updatedMetrics.totalExecutionTime / updatedMetrics.tasksCompleted
      updatedMetrics.successRate = (updatedMetrics.tasksCompleted / totalTasks) * 100
    }
    
    await this.repository.update(id, {
      metrics: updatedMetrics
    })
  }

  /**
   * 设置 Worker 错误
   */
  async setError(id: string, error: string): Promise<void> {
    await this.repository.update(id, {
      status: 'error' as any,
      lastError: error,
      lastErrorAt: new Date()
    })
  }

  /**
   * 清理离线 Worker
   */
  async cleanupOfflineWorkers(agentId: string): Promise<number> {
    const result = await this.repository.delete({
      agentId,
      status: 'offline' as any
    })
    
    return result.affected || 0
  }

  /**
   * 获取 Worker 统计信息
   */
  async getStatsByAgent(agentId: string): Promise<{
    total: number
    idle: number
    busy: number
    offline: number
    error: number
  }> {
    const workers = await this.findByAgentId(agentId)
    
    return {
      total: workers.length,
      idle: workers.filter(w => w.status === 'idle').length,
      busy: workers.filter(w => w.status === 'busy').length,
      offline: workers.filter(w => w.status === 'offline').length,
      error: workers.filter(w => w.status === 'error').length
    }
  }

  /**
   * 查找最佳可用 Worker
   */
  async findBestAvailableWorker(
    agentId: string,
    requirements?: {
      tools?: string[]
      minMemory?: number
      minCpu?: number
    }
  ): Promise<Worker | null> {
    let query = this.repository
      .createQueryBuilder('worker')
      .where('worker.agentId = :agentId', { agentId })
      .andWhere('worker.status = :status', { status: 'idle' })
    
    // 根据需求筛选
    if (requirements) {
      if (requirements.tools && requirements.tools.length > 0) {
        query = query.andWhere(
          'JSON_CONTAINS(worker.capabilities->"$.supportedTools", :tools)',
          { tools: JSON.stringify(requirements.tools) }
        )
      }
      
      if (requirements.minMemory) {
        query = query.andWhere(
          'CAST(worker.capabilities->"$.resourceLimits.maxMemory" AS UNSIGNED) >= :minMemory',
          { minMemory: requirements.minMemory }
        )
      }
      
      if (requirements.minCpu) {
        query = query.andWhere(
          'CAST(worker.capabilities->"$.resourceLimits.maxCpu" AS UNSIGNED) >= :minCpu',
          { minCpu: requirements.minCpu }
        )
      }
    }
    
    // 优先选择成功率高的 Worker
    query = query.orderBy('worker.metrics->"$.successRate"', 'DESC')
    
    return query.getOne()
  }
}