import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  HttpCode,
  HttpStatus,
  UseGuards
} from '@nestjs/common'
import { 
  TaskService,
  CreateTaskDto,
  UpdateTaskDto
} from '../services/task.service'
import { Task } from '../entities/task.entity'

@Controller('api/tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  /**
   * 创建新任务
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() data: CreateTaskDto): Promise<Task> {
    return this.taskService.createTask(data)
  }

  /**
   * 批量创建任务
   */
  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async createBatch(
    @Body() data: { tasks: CreateTaskDto[] }
  ): Promise<Task[]> {
    return this.taskService.createTasksBatch(data.tasks)
  }

  /**
   * 获取所有任务
   */
  @Get()
  async getAll(
    @Query('status') status?: Task['status'],
    @Query('agentId') agentId?: string,
    @Query('workerId') workerId?: string,
    @Query('createdBy') createdBy?: string
  ): Promise<Task[]> {
    return this.taskService.getAllTasks({
      status,
      agentId,
      workerId,
      createdBy
    })
  }

  /**
   * 获取单个任务
   */
  @Get(':id')
  async getById(@Param('id') id: string): Promise<Task> {
    return this.taskService.getTaskById(id)
  }

  /**
   * 更新任务
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateTaskDto
  ): Promise<Task> {
    return this.taskService.updateTask(id, data)
  }

  /**
   * 取消任务
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string): Promise<{ message: string }> {
    await this.taskService.cancelTask(id)
    return { message: 'Task cancelled successfully' }
  }

  /**
   * 删除任务
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.taskService.deleteTask(id)
  }

  /**
   * 分配任务给 Worker
   */
  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  async assign(
    @Param('id') id: string,
    @Body() data: { workerId: string; agentId: string }
  ): Promise<{ message: string }> {
    await this.taskService.assignTaskToWorker(id, data.workerId, data.agentId)
    return { message: 'Task assigned successfully' }
  }

  /**
   * 开始执行任务
   */
  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async start(@Param('id') id: string): Promise<{ message: string }> {
    await this.taskService.startTask(id)
    return { message: 'Task started successfully' }
  }

  /**
   * 完成任务
   */
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @Param('id') id: string,
    @Body() data: { result: any; executionTime: number }
  ): Promise<{ message: string }> {
    await this.taskService.completeTask(id, data.result, data.executionTime)
    return { message: 'Task completed successfully' }
  }

  /**
   * 任务失败
   */
  @Post(':id/fail')
  @HttpCode(HttpStatus.OK)
  async fail(
    @Param('id') id: string,
    @Body() data: { error: string; executionTime?: number }
  ): Promise<{ message: string }> {
    await this.taskService.failTask(id, data.error, data.executionTime)
    return { message: 'Task marked as failed' }
  }

  /**
   * 重试任务
   */
  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retry(@Param('id') id: string): Promise<{ message: string }> {
    await this.taskService.retryTask(id)
    return { message: 'Task retry initiated' }
  }

  /**
   * 获取任务统计信息
   */
  @Get('stats')
  async getStats(@Query('agentId') agentId?: string): Promise<{
    total: number
    pending: number
    running: number
    completed: number
    failed: number
    avgExecutionTime: number
  }> {
    return this.taskService.getTaskStats(agentId)
  }

  /**
   * 处理待处理的任务
   */
  @Post('process/pending')
  @HttpCode(HttpStatus.OK)
  async processPending(): Promise<{ message: string }> {
    await this.taskService.processPendingTasks()
    return { message: 'Pending tasks processed' }
  }

  /**
   * 处理过期的任务
   */
  @Post('process/expired')
  @HttpCode(HttpStatus.OK)
  async processExpired(): Promise<{ message: string }> {
    await this.taskService.processExpiredTasks()
    return { message: 'Expired tasks processed' }
  }

  /**
   * 清理旧任务
   */
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanup(
    @Body() data: { daysToKeep?: number }
  ): Promise<{ message: string; cleaned: number }> {
    const cleaned = await this.taskService.cleanupOldTasks(data.daysToKeep)
    return {
      message: 'Cleanup completed',
      cleaned
    }
  }

  /**
   * 取消 Agent 的所有任务
   */
  @Post('cancel/agent/:agentId')
  @HttpCode(HttpStatus.OK)
  async cancelByAgent(@Param('agentId') agentId: string): Promise<{
    message: string
    cancelled: number
  }> {
    const cancelled = await this.taskService.cancelTasksByAgent(agentId)
    return {
      message: 'Tasks cancelled',
      cancelled
    }
  }
}