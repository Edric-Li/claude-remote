import { Injectable } from '@nestjs/common'
import { BaseRepository } from './base.repository'
import { Task } from '../entities/task.entity'
import { DataSource, FindOptionsWhere, LessThan, IsNull, Not } from 'typeorm'

@Injectable()
export class TaskRepository extends BaseRepository<Task> {
  private dataSource: DataSource
  
  constructor(dataSource: DataSource) {
    super(dataSource.getRepository(Task))
    this.dataSource = dataSource
  }
  

  /**
   * 查找待处理的任务
   */
  async findPendingTasks(limit: number = 10): Promise<Task[]> {
    return this.repository.find({
      where: {
        status: 'pending',
        scheduledFor: LessThan(new Date())
      },
      order: {
        priority: 'DESC',
        createdAt: 'ASC'
      },
      take: limit,
      relations: ['agent', 'worker']
    })
  }

  /**
   * 查找 Agent 的任务
   */
  async findByAgentId(agentId: string, status?: Task['status']): Promise<Task[]> {
    const where: FindOptionsWhere<Task> = { agentId }
    
    if (status) {
      where.status = status
    }
    
    return this.repository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['agent', 'worker']
    })
  }

  /**
   * 查找 Worker 的任务
   */
  async findByWorkerId(workerId: string, status?: Task['status']): Promise<Task[]> {
    const where: FindOptionsWhere<Task> = { workerId }
    
    if (status) {
      where.status = status
    }
    
    return this.repository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['agent', 'worker']
    })
  }

  /**
   * 分配任务给 Worker
   */
  async assignToWorker(taskId: string, workerId: string, agentId: string): Promise<void> {
    await this.repository.update(taskId, {
      workerId,
      agentId,
      status: 'assigned',
      assignedAt: new Date()
    })
  }

  /**
   * 更新任务状态
   */
  async updateStatus(
    id: string,
    status: Task['status'],
    additionalData?: {
      result?: any
      error?: string
      executionTime?: number
    }
  ): Promise<void> {
    const updateData: any = { status }
    
    if (status === 'running') {
      updateData.startedAt = new Date()
    } else if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date()
      
      if (additionalData) {
        if (additionalData.result !== undefined) {
          updateData.result = additionalData.result
        }
        if (additionalData.error !== undefined) {
          updateData.error = additionalData.error
        }
        if (additionalData.executionTime !== undefined) {
          updateData.executionTime = additionalData.executionTime
        }
      }
    }
    
    await this.repository.update(id, updateData)
  }

  /**
   * 查找过期的任务
   */
  async findExpiredTasks(): Promise<Task[]> {
    return this.repository.find({
      where: {
        status: 'pending',
        expiresAt: LessThan(new Date())
      }
    })
  }

  /**
   * 查找需要重试的任务
   */
  async findTasksToRetry(): Promise<Task[]> {
    return this.repository
      .createQueryBuilder('task')
      .where('task.status = :status', { status: 'failed' })
      .andWhere('task.retryCount < task.maxRetries')
      .orderBy('task.priority', 'DESC')
      .addOrderBy('task.createdAt', 'ASC')
      .getMany()
  }

  /**
   * 增加重试计数
   */
  async incrementRetryCount(id: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(Task)
      .set({
        retryCount: () => 'retryCount + 1',
        status: 'pending'
      })
      .where('id = :id', { id })
      .execute()
  }

  /**
   * 获取任务统计信息
   */
  async getStats(agentId?: string): Promise<{
    total: number
    pending: number
    running: number
    completed: number
    failed: number
    avgExecutionTime: number
  }> {
    let query = this.repository.createQueryBuilder('task')
    
    if (agentId) {
      query = query.where('task.agentId = :agentId', { agentId })
    }
    
    const stats = await query
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN task.status = "pending" THEN 1 ELSE 0 END)', 'pending')
      .addSelect('SUM(CASE WHEN task.status = "running" THEN 1 ELSE 0 END)', 'running')
      .addSelect('SUM(CASE WHEN task.status = "completed" THEN 1 ELSE 0 END)', 'completed')
      .addSelect('SUM(CASE WHEN task.status = "failed" THEN 1 ELSE 0 END)', 'failed')
      .addSelect('AVG(task.executionTime)', 'avgExecutionTime')
      .getRawOne()
    
    return {
      total: parseInt(stats.total) || 0,
      pending: parseInt(stats.pending) || 0,
      running: parseInt(stats.running) || 0,
      completed: parseInt(stats.completed) || 0,
      failed: parseInt(stats.failed) || 0,
      avgExecutionTime: parseFloat(stats.avgExecutionTime) || 0
    }
  }

  /**
   * 清理旧任务
   */
  async cleanupOldTasks(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    const result = await this.repository.delete({
      status: 'completed' as any,
      completedAt: LessThan(cutoffDate)
    })
    
    return result.affected || 0
  }

  /**
   * 取消任务
   */
  async cancelTask(id: string): Promise<void> {
    await this.repository.update(id, {
      status: 'cancelled',
      completedAt: new Date()
    })
  }

  /**
   * 批量取消任务
   */
  async cancelTasksByAgent(agentId: string): Promise<number> {
    const result = await this.repository.update(
      {
        agentId,
        status: Not('completed' as any) && Not('failed' as any) && Not('cancelled' as any)
      },
      {
        status: 'cancelled',
        completedAt: new Date()
      }
    )
    
    return result.affected || 0
  }
}