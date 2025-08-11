import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { TaskRepository } from '../repositories/task.repository'
import { Task } from '../entities/task.entity'
// import { WorkerService } from './worker.service' // 已移除
import { AgentService } from './agent.service'
import { EventEmitter2 } from '@nestjs/event-emitter'

export interface CreateTaskDto {
  type: string
  payload: Record<string, any>
  priority?: number
  requirements?: {
    tools?: string[]
    minMemory?: number
    minCpu?: number
    tags?: string[]
  }
  metadata?: Record<string, any>
  scheduledFor?: Date
  expiresAt?: Date
  maxRetries?: number
  createdBy: string
}

export interface UpdateTaskDto {
  priority?: number
  payload?: Record<string, any>
  requirements?: Task['requirements']
  metadata?: Record<string, any>
  scheduledFor?: Date
  expiresAt?: Date
}

@Injectable()
export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    // private readonly workerService: WorkerService, // 已移除
    private readonly agentService: AgentService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * 创建新任务
   */
  async createTask(data: CreateTaskDto): Promise<Task> {
    const task = await this.taskRepository.create({
      ...data,
      status: 'pending',
      priority: data.priority || 5,
      maxRetries: data.maxRetries || 3,
      retryCount: 0,
      scheduledFor: data.scheduledFor || new Date()
    })

    // 触发任务创建事件
    this.eventEmitter.emit('task.created', task)

    // 尝试立即分配任务
    await this.tryAssignTask(task)

    return task
  }

  /**
   * 批量创建任务
   */
  async createTasksBatch(tasks: CreateTaskDto[]): Promise<Task[]> {
    const createdTasks: Task[] = []

    for (const taskData of tasks) {
      const task = await this.createTask(taskData)
      createdTasks.push(task)
    }

    return createdTasks
  }

  /**
   * 获取所有任务
   */
  async getAllTasks(filters?: {
    status?: Task['status']
    agentId?: string
    workerId?: string
    createdBy?: string
  }): Promise<Task[]> {
    let where: any = {}

    if (filters) {
      if (filters.status) where.status = filters.status
      if (filters.agentId) where.agentId = filters.agentId
      if (filters.workerId) where.workerId = filters.workerId
      if (filters.createdBy) where.createdBy = filters.createdBy
    }

    return this.taskRepository.findAll({
      where,
      order: { createdAt: 'DESC' },
      relations: ['agent', 'worker']
    })
  }

  /**
   * 获取单个任务
   */
  async getTaskById(id: string): Promise<Task> {
    const task = await this.taskRepository.findById(id)
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`)
    }
    return task
  }

  /**
   * 更新任务
   */
  async updateTask(id: string, data: UpdateTaskDto): Promise<Task> {
    await this.getTaskById(id) // 确保存在

    const updated = await this.taskRepository.update(id, data)
    if (!updated) {
      throw new Error('Failed to update task')
    }

    return updated
  }

  /**
   * 取消任务
   */
  async cancelTask(id: string): Promise<void> {
    const task = await this.getTaskById(id)

    if (task.status === 'completed' || task.status === 'cancelled') {
      throw new BadRequestException('Task is already completed or cancelled')
    }

    await this.taskRepository.cancelTask(id)

    // 如果任务已分配给 Worker，更新 Worker 状态
    // Worker已移除 - 注释掉workerId相关代码
    // if (task.workerId) {
    //   await this.workerService.updateWorkerStatus(task.workerId, task.agentId, 'idle', {
    //     taskId: null,
    //     taskType: null
    //   })
    // }

    // 触发任务取消事件
    this.eventEmitter.emit('task.cancelled', task)
  }

  /**
   * 删除任务
   */
  async deleteTask(id: string): Promise<void> {
    const task = await this.getTaskById(id)

    if (task.status === 'running') {
      throw new BadRequestException('Cannot delete a running task')
    }

    const deleted = await this.taskRepository.delete(id)
    if (!deleted) {
      throw new Error('Failed to delete task')
    }
  }

  /**
   * 尝试分配任务给 Worker
   */
  async tryAssignTask(task: Task): Promise<boolean> {
    // 获取所有已连接的 Agent
    const connectedAgents = await this.agentService.getConnectedAgents()

    if (connectedAgents.length === 0) {
      return false
    }

    // 按优先级排序（可以根据负载、性能等因素）
    for (const agent of connectedAgents) {
      // 检查 Agent 是否符合任务要求
      if (task.requirements?.tags) {
        const agentTags = agent.tags || []
        const hasAllTags = task.requirements.tags.every(tag => agentTags.includes(tag))
        if (!hasAllTags) continue
      }

      // 查找最佳可用 Worker
      // Worker已移除 - 注释掉Worker相关代码
      // const worker = await this.workerService.findBestWorkerForTask(agent.id, task.requirements)
      const worker = null

      if (worker) {
        // 分配任务
        await this.assignTaskToWorker(task.id, worker.id, agent.id)
        return true
      }
    }

    return false
  }

  /**
   * 分配任务给 Worker
   */
  async assignTaskToWorker(taskId: string, workerId: string, agentId: string): Promise<void> {
    const task = await this.getTaskById(taskId)

    if (task.status !== 'pending') {
      throw new BadRequestException('Task is not in pending status')
    }

    // 更新任务状态
    await this.taskRepository.assignToWorker(taskId, workerId, agentId)

    // 更新 Worker 状态
    // Worker已移除 - 注释掉Worker相关代码
    // await this.workerService.updateWorkerStatus(workerId, agentId, 'busy', {
    //   taskId,
    //   taskType: task.type
    // })

    // 触发任务分配事件
    this.eventEmitter.emit('task.assigned', {
      task,
      workerId,
      agentId
    })
  }

  /**
   * 开始执行任务
   */
  async startTask(taskId: string): Promise<void> {
    const task = await this.getTaskById(taskId)

    if (task.status !== 'assigned') {
      throw new BadRequestException('Task must be assigned before starting')
    }

    await this.taskRepository.updateStatus(taskId, 'running')

    // 触发任务开始事件
    this.eventEmitter.emit('task.started', task)
  }

  /**
   * 完成任务
   */
  async completeTask(taskId: string, result: any, executionTime: number): Promise<void> {
    const task = await this.getTaskById(taskId)

    if (task.status !== 'running') {
      throw new BadRequestException('Task is not running')
    }

    await this.taskRepository.updateStatus(taskId, 'completed', {
      result,
      executionTime
    })

    // 更新 Worker 状态和指标
    // Worker已移除 - 注释掉workerId相关代码
    // if (task.workerId && task.agentId) {
    //   await this.workerService.reportTaskComplete(task.workerId, task.agentId, true, executionTime)
    // }

    // 触发任务完成事件
    this.eventEmitter.emit('task.completed', {
      task,
      result,
      executionTime
    })
  }

  /**
   * 任务失败
   */
  async failTask(taskId: string, error: string, executionTime?: number): Promise<void> {
    const task = await this.getTaskById(taskId)

    if (task.status !== 'running') {
      throw new BadRequestException('Task is not running')
    }

    await this.taskRepository.updateStatus(taskId, 'failed', {
      error,
      executionTime
    })

    // 更新 Worker 状态和指标
    // Worker已移除
    // if (task.workerId && task.agentId) {
    //   await this.workerService.reportTaskComplete(
    //     task.workerId,
    //     task.agentId,
    //     false,
    //     executionTime || 0
    //   )
    // }

    // 检查是否需要重试
    if (task.retryCount < task.maxRetries) {
      await this.retryTask(taskId)
    }

    // 触发任务失败事件
    this.eventEmitter.emit('task.failed', {
      task,
      error,
      executionTime
    })
  }

  /**
   * 重试任务
   */
  async retryTask(taskId: string): Promise<void> {
    const task = await this.getTaskById(taskId)

    if (task.retryCount >= task.maxRetries) {
      throw new BadRequestException('Task has reached maximum retry attempts')
    }

    await this.taskRepository.incrementRetryCount(taskId)

    // 重新尝试分配任务
    const updatedTask = await this.getTaskById(taskId)
    await this.tryAssignTask(updatedTask)

    // 触发任务重试事件
    this.eventEmitter.emit('task.retried', updatedTask)
  }

  /**
   * 处理待处理的任务
   */
  async processPendingTasks(): Promise<void> {
    const pendingTasks = await this.taskRepository.findPendingTasks(50)

    for (const task of pendingTasks) {
      await this.tryAssignTask(task)
    }
  }

  /**
   * 处理过期的任务
   */
  async processExpiredTasks(): Promise<void> {
    const expiredTasks = await this.taskRepository.findExpiredTasks()

    for (const task of expiredTasks) {
      await this.taskRepository.updateStatus(task.id, 'failed', {
        error: 'Task expired'
      })

      // 触发任务过期事件
      this.eventEmitter.emit('task.expired', task)
    }
  }

  /**
   * 获取任务统计信息
   */
  async getTaskStats(agentId?: string): Promise<{
    total: number
    pending: number
    running: number
    completed: number
    failed: number
    avgExecutionTime: number
  }> {
    return this.taskRepository.getStats(agentId)
  }

  /**
   * 清理旧任务
   */
  async cleanupOldTasks(daysToKeep: number = 30): Promise<number> {
    return this.taskRepository.cleanupOldTasks(daysToKeep)
  }

  /**
   * 取消 Agent 的所有任务
   */
  async cancelTasksByAgent(agentId: string): Promise<number> {
    return this.taskRepository.cancelTasksByAgent(agentId)
  }
}
