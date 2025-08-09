import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'

export interface QuCoderConfig {
  workingDirectory: string
  endpoint?: string
  apiKey?: string
  model?: string  // qwen-max, qwen-plus, qwen-turbo
}

/**
 * QuCoder Worker
 * 封装通义千问编程助手 CLI
 */
export class QuCoderWorker extends EventEmitter {
  public id: string
  public type: 'qucoder' = 'qucoder'
  public status: 'idle' | 'busy' | 'error' | 'offline' = 'offline'
  
  private process: ChildProcess | null = null
  private config: QuCoderConfig
  private outputBuffer: string = ''
  private currentContext: string[] = []  // 当前上下文文件
  
  constructor(config: QuCoderConfig) {
    super()
    this.id = uuidv4()
    this.config = config
  }
  
  /**
   * 启动 QuCoder CLI
   */
  async spawn(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // QuCoder 启动参数
        const args: string[] = []
        
        if (this.config.model) {
          args.push('--model', this.config.model)
        }
        
        if (this.config.endpoint) {
          args.push('--endpoint', this.config.endpoint)
        }
        
        // 启动 qucoder 进程
        this.process = spawn('qucoder', args, {
          env: {
            ...process.env,
            DASHSCOPE_API_KEY: this.config.apiKey || process.env.DASHSCOPE_API_KEY,
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
        
        // 等待初始化完成
        this.waitForReady().then(() => {
          this.status = 'idle'
          resolve()
        }).catch(reject)
        
      } catch (error) {
        reject(error)
      }
    })
  }
  
  /**
   * 等待就绪
   */
  private async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('QuCoder initialization timeout'))
      }, 10000)
      
      const checkReady = (data: string) => {
        // QuCoder 可能有特定的就绪标识
        if (data.includes('Ready') || data.includes('就绪') || data.includes('>>>')) {
          clearTimeout(timeout)
          this.removeListener('output', checkReady)
          resolve()
        }
      }
      
      this.on('output', checkReady)
    })
  }
  
  /**
   * 发送命令
   */
  async sendCommand(command: string): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error('Process not running')
    }
    
    if (this.status === 'busy') {
      throw new Error('Worker is busy')
    }
    
    return new Promise((resolve, reject) => {
      this.status = 'busy'
      this.outputBuffer = ''
      
      const timeout = setTimeout(() => {
        this.status = 'idle'
        reject(new Error('Command timeout'))
      }, 180000)  // 3分钟超时
      
      const handleComplete = () => {
        clearTimeout(timeout)
        this.status = 'idle'
        this.removeListener('response-complete', handleComplete)
        resolve()
      }
      
      this.once('response-complete', handleComplete)
      
      // 发送命令
      this.process!.stdin!.write(command + '\n')
    })
  }
  
  /**
   * 处理输出
   */
  private handleOutput(data: string) {
    this.outputBuffer += data
    this.emit('output', data)
    
    // QuCoder 输出格式解析
    // 通义千问可能使用中文提示
    if (data.includes('>>>') || data.includes('请输入') || data.includes('完成')) {
      // 响应完成
      if (this.outputBuffer.trim()) {
        const response = this.cleanOutput(this.outputBuffer)
        this.emit('response', response)
      }
      this.emit('response-complete')
      this.outputBuffer = ''
      this.status = 'idle'
      
    } else if (data.includes('正在处理') || data.includes('思考中')) {
      this.status = 'busy'
      this.emit('processing')
      
    } else if (data.includes('```')) {
      // 代码块
      this.extractAndEmitCode(data)
    }
  }
  
  /**
   * 清理输出
   */
  private cleanOutput(output: string): string {
    // 移除 ANSI 转义序列
    let cleaned = output.replace(/\x1b\[[0-9;]*m/g, '')
    
    // 移除提示符
    cleaned = cleaned.replace(/>>>\s*/g, '')
    cleaned = cleaned.replace(/请输入.*?:\s*/g, '')
    
    // 移除多余空行
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
    
    return cleaned.trim()
  }
  
  /**
   * 提取并发送代码
   */
  private extractAndEmitCode(text: string) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    let match
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
      this.emit('code', {
        language: match[1] || 'plaintext',
        content: match[2].trim()
      })
    }
  }
  
  /**
   * 处理错误
   */
  private handleError(data: string) {
    // 中文错误信息
    if (data.includes('错误') || data.includes('失败') || 
        data.includes('Error') || data.includes('Failed')) {
      this.status = 'error'
      this.emit('error', new Error(data))
    } else {
      this.emit('warning', data)
    }
  }
  
  /**
   * 处理退出
   */
  private handleExit(code: number | null, signal: NodeJS.Signals | null) {
    this.status = 'offline'
    this.emit('exit', { code, signal })
    
    // 自动重启
    if (code !== 0) {
      setTimeout(() => {
        this.spawn().catch(err => {
          this.emit('error', err)
        })
      }, 5000)
    }
  }
  
  /**
   * 执行任务
   */
  async executeTask(task: any): Promise<any> {
    try {
      this.status = 'busy'
      
      // 构建 QuCoder 特定的提示词
      let prompt = task.prompt
      
      // 添加文件上下文
      if (task.files && task.files.length > 0) {
        // QuCoder 可能支持特定的文件引用格式
        prompt = `/add ${task.files.join(' ')}\n${prompt}`
        this.currentContext = task.files
      }
      
      // 根据任务类型调整提示词
      switch (task.type) {
        case 'generate':
          prompt = `生成代码：${prompt}`
          break
          
        case 'review':
          prompt = `代码审查：${prompt}`
          break
          
        case 'refactor':
          prompt = `重构代码：${prompt}`
          break
          
        case 'edit':
          prompt = `修改文件：${prompt}`
          break
      }
      
      // 发送命令
      await this.sendCommand(prompt)
      
      // 返回结果
      return {
        success: true,
        result: this.outputBuffer,
        context: this.currentContext
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
   * 添加文件到上下文
   */
  async addContext(files: string[]): Promise<void> {
    const command = `/add ${files.join(' ')}`
    await this.sendCommand(command)
    this.currentContext.push(...files)
  }
  
  /**
   * 清除上下文
   */
  async clearContext(): Promise<void> {
    const command = '/clear'
    await this.sendCommand(command)
    this.currentContext = []
  }
  
  /**
   * 获取状态
   */
  getStatus() {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      model: this.config.model || 'qwen-max',
      context: this.currentContext
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
        
        // 发送退出命令
        if (this.process.stdin) {
          this.process.stdin.write('/exit\n')
        }
        
        // 等待一下再强制退出
        setTimeout(() => {
          this.process?.kill('SIGTERM')
        }, 1000)
      })
    }
  }
}