import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { WorkerRepository } from '../repositories/worker.repository'
import { Worker } from '../entities/worker.entity'
import { AgentService } from './agent.service'

export interface RegisterWorkerDto {
  workerId: string
  name: string
  agentId: string
  capabilities?: {
    supportedTools: string[]
    maxConcurrentTasks: number
    resourceLimits: {
      maxMemory: number
      maxCpu: number
      maxDiskIO: number
    }
  }
  config?: Record<string, any>
}

export interface UpdateWorkerDto {
  name?: string
  capabilities?: Worker['capabilities']
  config?: Record<string, any>
}

export interface WorkerHeartbeatDto {
  workerId: string
  agentId: string
  status: Worker['status']
  systemInfo?: Worker['systemInfo']
  currentTaskId?: string
  currentTaskType?: string
}

@Injectable()
export class WorkerService {
  constructor(
    private readonly workerRepository: WorkerRepository,
    private readonly agentService: AgentService
  ) {}

  /**
   * 注册新的 Worker
   */
  async registerWorker(data: RegisterWorkerDto): Promise<Worker> {
    // 验证 Agent 是否存在且已连接
    const agent = await this.agentService.getAgentById(data.agentId)
    if (agent.status !== 'connected') {
      throw new BadRequestException('Agent is not connected')
    }
    
    // 检查 Worker 是否已存在
    const existing = await this.workerRepository.findByWorkerAndAgent(
      data.workerId,
      data.agentId
    )
    
    if (existing) {
      // 如果已存在，更新状态为 idle
      await this.workerRepository.update(existing.id, {
        status: 'idle',
        lastHeartbeat: new Date(),
        startedAt: new Date()
      })
      return this.workerRepository.findById(existing.id)
    }
    
    // 创建新 Worker
    const worker = await this.workerRepository.create({
      ...data,
      status: 'idle',
      startedAt: new Date(),
      lastHeartbeat: new Date(),
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        successRate: 0,
        lastTaskCompletedAt: null
      }
    })
    
    return worker
  }

  /**
   * 注销 Worker
   */
  async unregisterWorker(workerId: string, agentId: string): Promise<void> {
    const worker = await this.workerRepository.findByWorkerAndAgent(workerId, agentId)
    
    if (!worker) {
      throw new NotFoundException('Worker not found')
    }
    
    await this.workerRepository.update(worker.id, {
      status: 'offline',
      currentTaskId: null,
      currentTaskType: null
    })
  }

  /**
   * 获取 Agent 的所有 Worker
   */
  async getWorkersByAgent(agentId: string): Promise<Worker[]> {
    return this.workerRepository.findByAgentId(agentId)
  }

  /**
   * 获取单个 Worker
   */
  async getWorkerById(id: string): Promise<Worker> {
    const worker = await this.workerRepository.findById(id)
    if (!worker) {
      throw new NotFoundException(`Worker with ID ${id} not found`)
    }
    return worker
  }

  /**
   * 更新 Worker
   */
  async updateWorker(id: string, data: UpdateWorkerDto): Promise<Worker> {
    await this.getWorkerById(id) // 确保存在
    
    const updated = await this.workerRepository.update(id, data)
    if (!updated) {
      throw new Error('Failed to update worker')
    }
    
    return updated
  }

  /**
   * 删除 Worker
   */
  async deleteWorker(id: string): Promise<void> {
    const worker = await this.getWorkerById(id)
    
    // 不能删除正在工作的 Worker
    if (worker.status === 'busy') {
      throw new BadRequestException('Cannot delete a busy worker')
    }
    
    const deleted = await this.workerRepository.delete(id)
    if (!deleted) {
      throw new Error('Failed to delete worker')
    }
  }

  /**
   * 处理 Worker 心跳
   */
  async handleHeartbeat(data: WorkerHeartbeatDto): Promise<void> {
    const worker = await this.workerRepository.findByWorkerAndAgent(
      data.workerId,
      data.agentId
    )
    
    if (!worker) {
      throw new NotFoundException('Worker not found')
    }
    
    const updateData: any = {
      lastHeartbeat: new Date(),
      status: data.status
    }
    
    if (data.systemInfo) {
      updateData.systemInfo = data.systemInfo
    }
    
    if (data.currentTaskId !== undefined) {
      updateData.currentTaskId = data.currentTaskId
    }
    
    if (data.currentTaskType !== undefined) {
      updateData.currentTaskType = data.currentTaskType
    }
    
    await this.workerRepository.update(worker.id, updateData)
    
    // 同时更新 Agent 的最后活跃时间
    await this.agentService.updateLastSeen(data.agentId)
  }

  /**
   * 批量处理心跳
   */
  async handleHeartbeatBatch(heartbeats: WorkerHeartbeatDto[]): Promise<void> {
    const workerIds: string[] = []
    const agentIds = new Set<string>()
    
    for (const heartbeat of heartbeats) {
      const worker = await this.workerRepository.findByWorkerAndAgent(
        heartbeat.workerId,
        heartbeat.agentId
      )
      
      if (worker) {
        workerIds.push(worker.id)
        agentIds.add(heartbeat.agentId)
        
        // 更新详细信息
        await this.handleHeartbeat(heartbeat)
      }
    }
    
    // 批量更新 Agent 最后活跃时间
    for (const agentId of agentIds) {
      await this.agentService.updateLastSeen(agentId)
    }
  }

  /**
   * 更新 Worker 状态
   */
  async updateWorkerStatus(
    workerId: string,
    agentId: string,
    status: Worker['status'],
    taskInfo?: { taskId?: string; taskType?: string }
  ): Promise<void> {
    const worker = await this.workerRepository.findByWorkerAndAgent(workerId, agentId)
    
    if (!worker) {
      throw new NotFoundException('Worker not found')
    }
    
    await this.workerRepository.updateStatus(worker.id, status, taskInfo)
  }

  /**
   * 报告任务完成
   */
  async reportTaskComplete(
    workerId: string,
    agentId: string,
    success: boolean,
    executionTime: number
  ): Promise<void> {
    const worker = await this.workerRepository.findByWorkerAndAgent(workerId, agentId)
    
    if (!worker) {
      throw new NotFoundException('Worker not found')
    }
    
    const metrics = worker.metrics || {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      successRate: 0,
      lastTaskCompletedAt: null
    }
    
    if (success) {
      metrics.tasksCompleted++
    } else {
      metrics.tasksFailed++
    }
    
    metrics.totalExecutionTime += executionTime
    metrics.lastTaskCompletedAt = new Date()
    
    await this.workerRepository.updateMetrics(worker.id, metrics)
    
    // 重置 Worker 状态为 idle
    await this.workerRepository.updateStatus(worker.id, 'idle', {
      taskId: null,
      taskType: null
    })
  }

  /**
   * 报告 Worker 错误
   */
  async reportError(
    workerId: string,
    agentId: string,
    error: string
  ): Promise<void> {
    const worker = await this.workerRepository.findByWorkerAndAgent(workerId, agentId)
    
    if (!worker) {
      throw new NotFoundException('Worker not found')
    }
    
    await this.workerRepository.setError(worker.id, error)
  }

  /**
   * 获取活跃的 Worker
   */
  async getActiveWorkers(agentId?: string): Promise<Worker[]> {
    return this.workerRepository.findActiveWorkers(agentId)
  }

  /**
   * 获取 Worker 统计信息
   */
  async getWorkerStats(agentId: string): Promise<{
    total: number
    idle: number
    busy: number
    offline: number
    error: number
  }> {
    return this.workerRepository.getStatsByAgent(agentId)
  }

  /**
   * 清理离线 Worker
   */
  async cleanupOfflineWorkers(agentId: string): Promise<number> {
    return this.workerRepository.cleanupOfflineWorkers(agentId)
  }

  /**
   * 检查并标记超时的 Worker
   */
  async checkAndMarkTimeoutWorkers(timeoutSeconds: number = 60): Promise<void> {
    const timeoutWorkers = await this.workerRepository.findTimeoutWorkers(timeoutSeconds)
    
    for (const worker of timeoutWorkers) {
      await this.workerRepository.updateStatus(worker.id, 'offline')
    }
  }

  /**
   * 查找最佳可用 Worker
   */
  async findBestWorkerForTask(
    agentId: string,
    requirements?: {
      tools?: string[]
      minMemory?: number
      minCpu?: number
    }
  ): Promise<Worker | null> {
    return this.workerRepository.findBestAvailableWorker(agentId, requirements)
  }
}