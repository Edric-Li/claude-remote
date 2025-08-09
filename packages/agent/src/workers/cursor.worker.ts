import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import * as path from 'path'

export interface CursorConfig {
  workingDirectory: string
  env?: Record<string, string>
  useAPI?: boolean
  apiEndpoint?: string
}

/**
 * Cursor CLI Worker
 * 封装 Cursor 命令行工具
 */
export class CursorWorker extends EventEmitter {
  public id: string
  public type: 'cursor' = 'cursor'
  public status: 'idle' | 'busy' | 'error' | 'offline' = 'offline'
  
  private process: ChildProcess | null = null
  private config: CursorConfig
  private outputBuffer: string = ''
  private isProcessing: boolean = false
  
  constructor(config: CursorConfig) {
    super()
    this.id = uuidv4()
    this.config = config
  }
  
  /**
   * 启动 Cursor CLI
   */
  async spawn(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Cursor 可能需要特殊的启动参数
        const args = [
          '--no-sandbox',
          '--disable-gpu',
          '--working-directory', this.config.workingDirectory
        ]
        
        // 启动 cursor 进程
        this.process = spawn('cursor', args, {
          env: {
            ...process.env,
            ...this.config.env,
          },
          cwd: this.config.workingDirectory,
        })
        
        if (!this.process.stdout || !this.process.stderr) {
          throw new Error('Failed to create process streams')
        }
        
        // 处理输出
        this.process.stdout.on('data', (data: Buffer) => {
          this.handleOutput(data.toString())
        })
        
        this.process.stderr.on('data', (data: Buffer) => {
          this.handleError(data.toString())
        })
        
        this.process.on('exit', (code, signal) => {
          this.handleExit(code, signal)
        })
        
        this.process.on('error', (err) => {
          this.status = 'error'
          reject(err)
        })
        
        // 等待初始化
        setTimeout(() => {
          this.status = 'idle'
          resolve()
        }, 3000)
        
      } catch (error) {
        reject(error)
      }
    })
  }
  
  /**
   * 发送命令
   */
  async sendCommand(command: string): Promise<void> {
    // Cursor 可能使用 HTTP API 而不是 stdin
    if (this.config.useAPI) {
      return this.sendViaAPI(command)
    } else {
      return this.sendViaStdin(command)
    }
  }
  
  /**
   * 通过 stdin 发送命令
   */
  private async sendViaStdin(command: string): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error('Process not running')
    }
    
    return new Promise((resolve, reject) => {
      this.isProcessing = true
      this.outputBuffer = ''
      
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'))
      }, 120000)
      
      const handleComplete = () => {
        clearTimeout(timeout)
        this.isProcessing = false
        resolve()
      }
      
      // 监听响应
      this.once('response-complete', handleComplete)
      
      // 发送命令
      this.process!.stdin!.write(command + '\n')
    })
  }
  
  /**
   * 通过 API 发送命令
   */
  private async sendViaAPI(command: string): Promise<void> {
    const endpoint = this.config.apiEndpoint || 'http://localhost:5173/api'
    
    try {
      const response = await fetch(`${endpoint}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command,
          workingDirectory: this.config.workingDirectory
        })
      })
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }
      
      const result = await response.json()
      this.emit('response', result.output)
      
    } catch (error) {
      throw new Error(`Failed to send command via API: ${error.message}`)
    }
  }
  
  /**
   * 处理输出
   */
  private handleOutput(data: string) {
    this.outputBuffer += data
    this.emit('output', data)
    
    // Cursor 的输出格式可能不同
    // 需要根据实际情况解析
    if (data.includes('[DONE]') || data.includes('Completed')) {
      this.status = 'idle'
      this.emit('response', this.outputBuffer)
      this.emit('response-complete')
      this.outputBuffer = ''
    } else if (data.includes('[PROCESSING]')) {
      this.status = 'busy'
    }
  }
  
  /**
   * 处理错误
   */
  private handleError(data: string) {
    if (data.includes('Error') || data.includes('Failed')) {
      this.status = 'error'
      this.emit('error', new Error(data))
    } else {
      // 可能只是警告
      this.emit('warning', data)
    }
  }
  
  /**
   * 处理退出
   */
  private handleExit(code: number | null, signal: NodeJS.Signals | null) {
    this.status = 'offline'
    this.emit('exit', { code, signal })
  }
  
  /**
   * 执行任务
   */
  async executeTask(task: any): Promise<any> {
    try {
      this.status = 'busy'
      
      // 根据任务类型构建 Cursor 特定的命令
      let command = ''
      
      switch (task.type) {
        case 'edit':
          // Cursor 编辑命令
          command = `edit ${task.files?.join(' ')} --prompt "${task.prompt}"`
          break
          
        case 'refactor':
          // Cursor 重构命令
          command = `refactor ${task.files?.join(' ')} --pattern "${task.prompt}"`
          break
          
        case 'generate':
          // Cursor 生成命令
          command = `generate --prompt "${task.prompt}" --output ${task.output || 'output.ts'}`
          break
          
        default:
          // 默认聊天模式
          command = task.prompt
      }
      
      await this.sendCommand(command)
      
      return {
        success: true,
        result: this.outputBuffer
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    } finally {
      this.status = 'idle'
    }
  }
  
  /**
   * 获取状态
   */
  getStatus() {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      isProcessing: this.isProcessing
    }
  }
  
  /**
   * 关闭
   */
  async shutdown(): Promise<void> {
    if (this.process) {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.process?.kill('SIGKILL')
          resolve()
        }, 5000)
        
        this.process.on('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
        
        // 发送退出信号
        this.process.kill('SIGTERM')
      })
    }
  }
}