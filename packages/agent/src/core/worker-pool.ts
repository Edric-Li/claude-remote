import { EventEmitter } from 'events'
import { ClaudeCodeWorker } from '../workers/claude-code.worker'
import { CursorWorker } from '../workers/cursor.worker'
import { QuCoderWorker } from '../workers/qucoder.worker'

export type WorkerType = 'claude-code' | 'cursor' | 'qucoder' | 'aider' | 'continue'

export interface WorkerConfig {
  type: WorkerType
  count: number
  apiKey?: string
  workingDirectory: string
  maxRetries?: number
  env?: Record<string, string>
}

export interface PoolConfig {
  workers: WorkerConfig[]
  maxQueueSize?: number
  taskTimeout?: number
}

export interface Task {
  id: string
  type: 'chat' | 'edit' | 'generate' | 'review' | 'refactor'
  prompt: string
  files?: string[]
  context?: string
  priority?: number
  preferredWorker?: WorkerType
  timeout?: number
}

export interface BaseWorker extends EventEmitter {
  id: string
  type: WorkerType
  status: 'idle' | 'busy' | 'error' | 'offline'
  
  spawn(): Promise<void>
  sendCommand(command: string): Promise<void>
  executeTask(task: Task): Promise<any>
  shutdown(): Promise<void>
  getStatus(): any
}

/**
 * Worker 池管理器
 * 管理多个 AI CLI 工具实例
 */
export class WorkerPool extends EventEmitter {
  private workers: Map<string, BaseWorker> = new Map()
  private workersByType: Map<WorkerType, BaseWorker[]> = new Map()
  private taskQueue: Task[] = []
  private config: PoolConfig
  private isRunning: boolean = false
  
  constructor(config: PoolConfig) {
    super()
    this.config = config
  }
  
  /**
   * 初始化 Worker 池
   */
  async initialize(): Promise<void> {
    console.log('Initializing worker pool...')
    
    for (const workerConfig of this.config.workers) {
      await this.spawnWorkers(workerConfig)
    }
    
    this.isRunning = true
    this.startTaskProcessor()
    
    console.log(`Worker pool initialized with ${this.workers.size} workers`)
  }
  
  /**
   * 创建指定数量的 Worker
   */
  private async spawnWorkers(config: WorkerConfig): Promise<void> {
    const workers: BaseWorker[] = []
    
    for (let i = 0; i < config.count; i++) {
      const worker = this.createWorker(config)
      
      if (worker) {
        try {
          await worker.spawn()
          
          // 注册事件监听
          this.setupWorkerListeners(worker)
          
          // 添加到池中
          this.workers.set(worker.id, worker)
          workers.push(worker)
          
          console.log(`Spawned ${config.type} worker: ${worker.id}`)
        } catch (error) {
          console.error(`Failed to spawn ${config.type} worker:`, error)
        }
      }
    }
    
    // 按类型分组
    if (workers.length > 0) {
      this.workersByType.set(config.type, workers)
    }
  }
  
  /**
   * 创建具体的 Worker 实例
   */
  private createWorker(config: WorkerConfig): BaseWorker | null {
    switch (config.type) {
      case 'claude-code':
        return new ClaudeCodeWorker({
          apiKey: config.apiKey,
          workingDirectory: config.workingDirectory,
          maxRetries: config.maxRetries
        }) as any
        
      case 'cursor':
        return new CursorWorker({
          workingDirectory: config.workingDirectory,
          env: config.env
        }) as any
        
      case 'qucoder':
        return new QuCoderWorker({
          workingDirectory: config.workingDirectory,
          endpoint: config.env?.QUCODER_ENDPOINT
        }) as any
        
      default:
        console.error(`Unknown worker type: ${config.type}`)
        return null
    }
  }
  
  /**
   * 设置 Worker 事件监听
   */
  private setupWorkerListeners(worker: BaseWorker): void {
    worker.on('error', (error) => {
      console.error(`Worker ${worker.id} error:`, error)
      this.handleWorkerError(worker, error)
    })
    
    worker.on('exit', (info) => {
      console.log(`Worker ${worker.id} exited:`, info)
      this.handleWorkerExit(worker)
    })
    
    worker.on('output', (data) => {
      this.emit('worker-output', {
        workerId: worker.id,
        workerType: worker.type,
        data
      })
    })
    
    worker.on('response', (response) => {
      this.emit('worker-response', {
        workerId: worker.id,
        workerType: worker.type,
        response
      })
    })
  }
  
  /**
   * 处理 Worker 错误
   */
  private async handleWorkerError(worker: BaseWorker, error: Error): Promise<void> {
    worker.status = 'error'
    
    // 尝试重启
    setTimeout(async () => {
      try {
        await worker.spawn()
        worker.status = 'idle'
        console.log(`Worker ${worker.id} restarted successfully`)
      } catch (err) {
        console.error(`Failed to restart worker ${worker.id}:`, err)
        // 从池中移除
        this.removeWorker(worker)
      }
    }, 5000)
  }
  
  /**
   * 处理 Worker 退出
   */
  private handleWorkerExit(worker: BaseWorker): void {
    // 如果有正在执行的任务，重新入队
    // TODO: 实现任务恢复逻辑
    
    // 尝试重启
    this.handleWorkerError(worker, new Error('Worker exited'))
  }
  
  /**
   * 移除 Worker
   */
  private removeWorker(worker: BaseWorker): void {
    this.workers.delete(worker.id)
    
    const typeWorkers = this.workersByType.get(worker.type)
    if (typeWorkers) {
      const index = typeWorkers.indexOf(worker)
      if (index > -1) {
        typeWorkers.splice(index, 1)
      }
    }
  }
  
  /**
   * 提交任务
   */
  async submitTask(task: Task): Promise<any> {
    return new Promise((resolve, reject) => {
      // 添加到队列
      this.taskQueue.push(task)
      
      // 监听任务完成
      this.once(`task-complete-${task.id}`, (result) => {
        if (result.success) {
          resolve(result.data)
        } else {
          reject(new Error(result.error))
        }
      })
      
      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error('Task timeout'))
      }, task.timeout || this.config.taskTimeout || 300000)
      
      // 清理超时
      this.once(`task-complete-${task.id}`, () => {
        clearTimeout(timeout)
      })
    })
  }
  
  /**
   * 任务处理循环
   */
  private async startTaskProcessor(): Promise<void> {
    while (this.isRunning) {
      if (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift()
        if (task) {
          await this.processTask(task)
        }
      }
      
      // 短暂休眠避免 CPU 占用
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  /**
   * 处理单个任务
   */
  private async processTask(task: Task): Promise<void> {
    try {
      // 选择合适的 Worker
      const worker = await this.selectWorker(task)
      
      if (!worker) {
        throw new Error('No available worker')
      }
      
      console.log(`Assigning task ${task.id} to worker ${worker.id} (${worker.type})`)
      
      // 执行任务
      worker.status = 'busy'
      const result = await worker.executeTask(task)
      worker.status = 'idle'
      
      // 发送结果
      this.emit(`task-complete-${task.id}`, {
        success: true,
        data: result
      })
      
      // 通知任务完成
      this.emit('task-complete', {
        taskId: task.id,
        workerId: worker.id,
        workerType: worker.type,
        result
      })
      
    } catch (error) {
      console.error(`Task ${task.id} failed:`, error)
      
      // 发送错误
      this.emit(`task-complete-${task.id}`, {
        success: false,
        error: error.message
      })
      
      // 通知任务失败
      this.emit('task-failed', {
        taskId: task.id,
        error: error.message
      })
    }
  }
  
  /**
   * 智能选择 Worker
   */
  private async selectWorker(task: Task): Promise<BaseWorker | null> {
    // 1. 如果指定了偏好的 Worker 类型
    if (task.preferredWorker) {
      const workers = this.workersByType.get(task.preferredWorker)
      if (workers && workers.length > 0) {
        const idleWorker = workers.find(w => w.status === 'idle')
        if (idleWorker) return idleWorker
      }
    }
    
    // 2. 根据任务类型选择最合适的 Worker
    const bestType = this.getBestWorkerType(task)
    if (bestType) {
      const workers = this.workersByType.get(bestType)
      if (workers && workers.length > 0) {
        const idleWorker = workers.find(w => w.status === 'idle')
        if (idleWorker) return idleWorker
      }
    }
    
    // 3. 选择任意空闲的 Worker
    for (const worker of this.workers.values()) {
      if (worker.status === 'idle') {
        return worker
      }
    }
    
    // 4. 等待有 Worker 空闲
    return await this.waitForIdleWorker()
  }
  
  /**
   * 根据任务类型获取最佳 Worker 类型
   */
  private getBestWorkerType(task: Task): WorkerType | null {
    // 基于任务类型的简单映射
    // 实际使用中可以根据更复杂的规则选择
    const mapping: Record<string, WorkerType> = {
      'chat': 'claude-code',      // Claude 擅长对话
      'edit': 'cursor',            // Cursor 擅长编辑
      'generate': 'qucoder',       // QuCoder 擅长生成
      'review': 'claude-code',     // Claude 擅长代码审查
      'refactor': 'cursor'         // Cursor 擅长重构
    }
    
    return mapping[task.type] || null
  }
  
  /**
   * 等待空闲 Worker
   */
  private async waitForIdleWorker(): Promise<BaseWorker | null> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        for (const worker of this.workers.values()) {
          if (worker.status === 'idle') {
            clearInterval(checkInterval)
            resolve(worker)
            return
          }
        }
      }, 1000)
      
      // 超时
      setTimeout(() => {
        clearInterval(checkInterval)
        resolve(null)
      }, 30000)
    })
  }
  
  /**
   * 获取 Worker 池状态
   */
  getPoolStatus() {
    const status: any = {
      totalWorkers: this.workers.size,
      queueLength: this.taskQueue.length,
      workersByType: {},
      workerStatus: []
    }
    
    // 按类型统计
    for (const [type, workers] of this.workersByType.entries()) {
      status.workersByType[type] = {
        total: workers.length,
        idle: workers.filter(w => w.status === 'idle').length,
        busy: workers.filter(w => w.status === 'busy').length,
        error: workers.filter(w => w.status === 'error').length
      }
    }
    
    // 每个 Worker 的状态
    for (const worker of this.workers.values()) {
      status.workerStatus.push({
        id: worker.id,
        type: worker.type,
        status: worker.status
      })
    }
    
    return status
  }
  
  /**
   * 关闭 Worker 池
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down worker pool...')
    
    this.isRunning = false
    
    // 关闭所有 Worker
    const shutdownPromises = []
    for (const worker of this.workers.values()) {
      shutdownPromises.push(worker.shutdown())
    }
    
    await Promise.all(shutdownPromises)
    
    this.workers.clear()
    this.workersByType.clear()
    this.taskQueue = []
    
    console.log('Worker pool shut down')
  }
}