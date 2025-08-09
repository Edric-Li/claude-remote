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
  WorkerService, 
  RegisterWorkerDto, 
  UpdateWorkerDto,
  WorkerHeartbeatDto 
} from '../services/worker.service'
import { Worker } from '../entities/worker.entity'

@Controller('api/workers')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  /**
   * 注册新 Worker
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() data: RegisterWorkerDto): Promise<Worker> {
    return this.workerService.registerWorker(data)
  }

  /**
   * 注销 Worker
   */
  @Post('unregister')
  @HttpCode(HttpStatus.OK)
  async unregister(
    @Body() data: { workerId: string; agentId: string }
  ): Promise<{ message: string }> {
    await this.workerService.unregisterWorker(data.workerId, data.agentId)
    return { message: 'Worker unregistered successfully' }
  }

  /**
   * 发送心跳
   */
  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(@Body() data: WorkerHeartbeatDto): Promise<{ message: string }> {
    await this.workerService.handleHeartbeat(data)
    return { message: 'Heartbeat received' }
  }

  /**
   * 批量发送心跳
   */
  @Post('heartbeat/batch')
  @HttpCode(HttpStatus.OK)
  async heartbeatBatch(
    @Body() data: { heartbeats: WorkerHeartbeatDto[] }
  ): Promise<{ message: string }> {
    await this.workerService.handleHeartbeatBatch(data.heartbeats)
    return { message: `${data.heartbeats.length} heartbeats received` }
  }

  /**
   * 获取 Agent 的所有 Worker
   */
  @Get('agent/:agentId')
  async getByAgent(@Param('agentId') agentId: string): Promise<Worker[]> {
    return this.workerService.getWorkersByAgent(agentId)
  }

  /**
   * 获取单个 Worker
   */
  @Get(':id')
  async getById(@Param('id') id: string): Promise<Worker> {
    return this.workerService.getWorkerById(id)
  }

  /**
   * 更新 Worker
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateWorkerDto
  ): Promise<Worker> {
    return this.workerService.updateWorker(id, data)
  }

  /**
   * 删除 Worker
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.workerService.deleteWorker(id)
  }

  /**
   * 获取活跃的 Worker
   */
  @Get('active')
  async getActive(@Query('agentId') agentId?: string): Promise<Worker[]> {
    return this.workerService.getActiveWorkers(agentId)
  }

  /**
   * 获取 Worker 统计信息
   */
  @Get('stats/:agentId')
  async getStats(@Param('agentId') agentId: string): Promise<{
    total: number
    idle: number
    busy: number
    offline: number
    error: number
  }> {
    return this.workerService.getWorkerStats(agentId)
  }

  /**
   * 报告任务完成
   */
  @Post('task/complete')
  @HttpCode(HttpStatus.OK)
  async reportTaskComplete(
    @Body() data: {
      workerId: string
      agentId: string
      success: boolean
      executionTime: number
    }
  ): Promise<{ message: string }> {
    await this.workerService.reportTaskComplete(
      data.workerId,
      data.agentId,
      data.success,
      data.executionTime
    )
    return { message: 'Task completion reported' }
  }

  /**
   * 报告错误
   */
  @Post('error')
  @HttpCode(HttpStatus.OK)
  async reportError(
    @Body() data: {
      workerId: string
      agentId: string
      error: string
    }
  ): Promise<{ message: string }> {
    await this.workerService.reportError(
      data.workerId,
      data.agentId,
      data.error
    )
    return { message: 'Error reported' }
  }

  /**
   * 更新 Worker 状态
   */
  @Post('status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Body() data: {
      workerId: string
      agentId: string
      status: Worker['status']
      taskInfo?: {
        taskId?: string
        taskType?: string
      }
    }
  ): Promise<{ message: string }> {
    await this.workerService.updateWorkerStatus(
      data.workerId,
      data.agentId,
      data.status,
      data.taskInfo
    )
    return { message: 'Status updated' }
  }

  /**
   * 清理离线 Worker
   */
  @Post('cleanup/:agentId')
  @HttpCode(HttpStatus.OK)
  async cleanup(@Param('agentId') agentId: string): Promise<{
    message: string
    cleaned: number
  }> {
    const cleaned = await this.workerService.cleanupOfflineWorkers(agentId)
    return {
      message: 'Cleanup completed',
      cleaned
    }
  }
}