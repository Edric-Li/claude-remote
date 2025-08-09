import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'

export interface ClaudeCodeConfig {
  apiKey?: string
  workingDirectory: string
  model?: string
  maxRetries?: number
}

export interface ClaudeSession {
  id: string
  workingDirectory: string
  history: Array<{
    role: 'human' | 'assistant'
    content: string
    timestamp: Date
  }>
  isActive: boolean
}

export class ClaudeCodeWorker extends EventEmitter {
  private id: string
  private process: ChildProcess | null = null
  private config: ClaudeCodeConfig
  private status: 'idle' | 'busy' | 'waiting' | 'error' = 'idle'
  private currentSession: ClaudeSession | null = null
  private outputBuffer: string = ''
  private isWaitingForInput: boolean = false
  
  constructor(config: ClaudeCodeConfig) {
    super()
    this.id = uuidv4()
    this.config = config
  }
  
  /**
   * 启动 Claude Code CLI 进程
   */
  async spawn(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 启动 claude 命令
        this.process = spawn('claude', [], {
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: this.config.apiKey || process.env.ANTHROPIC_API_KEY,
          },
          cwd: this.config.workingDirectory,
          shell: true,
        })
        
        if (!this.process.stdout || !this.process.stderr) {
          throw new Error('Failed to create process streams')
        }
        
        // 处理标准输出
        this.process.stdout.on('data', (data: Buffer) => {
          const output = data.toString()
          this.handleOutput(output)
        })
        
        // 处理错误输出
        this.process.stderr.on('data', (data: Buffer) => {
          const error = data.toString()
          this.handleError(error)
        })
        
        // 处理进程退出
        this.process.on('exit', (code, signal) => {
          this.handleExit(code, signal)
        })
        
        // 处理进程错误
        this.process.on('error', (err) => {
          this.status = 'error'
          this.emit('error', err)
          reject(err)
        })
        
        // 等待初始化完成
        this.once('ready', () => {
          this.status = 'idle'
          resolve()
        })
        
        // 设置超时
        setTimeout(() => {
          if (this.status !== 'idle') {
            reject(new Error('Claude Code initialization timeout'))
          }
        }, 10000)
        
      } catch (error) {
        reject(error)
      }
    })
  }
  
  /**
   * 发送命令到 Claude Code
   */
  async sendCommand(command: string): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error('Process not running')
    }
    
    if (this.status === 'busy') {
      throw new Error('Worker is busy')
    }
    
    this.status = 'busy'
    this.outputBuffer = ''
    
    // 记录到历史
    if (this.currentSession) {
      this.currentSession.history.push({
        role: 'human',
        content: command,
        timestamp: new Date()
      })
    }
    
    // 发送命令
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'))
      }, 300000) // 5分钟超时
      
      // 监听响应完成
      const handleComplete = () => {
        clearTimeout(timeout)
        this.removeListener('response-complete', handleComplete)
        this.removeListener('error', handleError)
        resolve()
      }
      
      const handleError = (err: Error) => {
        clearTimeout(timeout)
        this.removeListener('response-complete', handleComplete)
        this.removeListener('error', handleError)
        reject(err)
      }
      
      this.once('response-complete', handleComplete)
      this.once('error', handleError)
      
      // 写入命令
      this.process!.stdin!.write(command + '\n')
    })
  }
  
  /**
   * 处理输出
   */
  private handleOutput(data: string) {
    this.outputBuffer += data
    
    // 检测不同的状态
    if (data.includes('Human:') || data.includes('You:')) {
      // Claude 等待输入
      this.isWaitingForInput = true
      this.status = 'waiting'
      
      // 如果有积累的输出，作为助手响应
      if (this.outputBuffer.trim()) {
        const response = this.cleanOutput(this.outputBuffer)
        if (this.currentSession && response) {
          this.currentSession.history.push({
            role: 'assistant',
            content: response,
            timestamp: new Date()
          })
        }
        this.emit('response', response)
        this.emit('response-complete')
      }
      
      this.outputBuffer = ''
      this.status = 'idle'
      this.emit('ready')
      
    } else if (data.includes('Assistant:') || data.includes('Claude:')) {
      // Claude 开始响应
      this.isWaitingForInput = false
      this.status = 'busy'
      this.emit('response-start')
      
    } else {
      // 正在输出内容
      this.emit('output', data)
      
      // 检查是否包含代码块或其他特殊内容
      if (data.includes('```')) {
        this.emit('code-block', this.extractCodeBlock(data))
      }
    }
  }
  
  /**
   * 处理错误输出
   */
  private handleError(data: string) {
    // 某些 CLI 工具会把正常信息输出到 stderr
    // 需要判断是否真的是错误
    if (data.includes('Error') || data.includes('error')) {
      this.status = 'error'
      this.emit('error', new Error(data))
    } else {
      // 可能只是警告或信息
      this.emit('warning', data)
    }
  }
  
  /**
   * 处理进程退出
   */
  private handleExit(code: number | null, signal: NodeJS.Signals | null) {
    this.status = 'error'
    this.emit('exit', { code, signal })
    
    // 自动重启逻辑
    if (this.config.maxRetries && this.config.maxRetries > 0) {
      setTimeout(() => {
        this.spawn().catch(err => {
          this.emit('error', err)
        })
      }, 5000)
    }
  }
  
  /**
   * 清理输出内容
   */
  private cleanOutput(output: string): string {
    // 移除 ANSI 转义序列
    const ansiRegex = /\x1b\[[0-9;]*m/g
    let cleaned = output.replace(ansiRegex, '')
    
    // 移除提示符
    cleaned = cleaned.replace(/^(Human:|You:|Assistant:|Claude:)\s*/gm, '')
    
    // 移除多余的空行
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
    
    return cleaned.trim()
  }
  
  /**
   * 提取代码块
   */
  private extractCodeBlock(text: string): Array<{ language: string; code: string }> {
    const codeBlocks: Array<{ language: string; code: string }> = []
    const regex = /```(\w+)?\n([\s\S]*?)```/g
    let match
    
    while ((match = regex.exec(text)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      })
    }
    
    return codeBlocks
  }
  
  /**
   * 创建新会话
   */
  async createSession(workingDirectory?: string): Promise<ClaudeSession> {
    const session: ClaudeSession = {
      id: uuidv4(),
      workingDirectory: workingDirectory || this.config.workingDirectory,
      history: [],
      isActive: true
    }
    
    // 如果需要切换目录
    if (workingDirectory && workingDirectory !== this.config.workingDirectory) {
      await this.sendCommand(`cd ${workingDirectory}`)
    }
    
    this.currentSession = session
    return session
  }
  
  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      id: this.id,
      status: this.status,
      session: this.currentSession,
      isWaitingForInput: this.isWaitingForInput
    }
  }
  
  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    if (this.process) {
      // 发送退出命令
      if (this.process.stdin) {
        this.process.stdin.write('exit\n')
      }
      
      // 等待进程退出
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          // 强制杀死进程
          this.process?.kill('SIGKILL')
          resolve()
        }, 5000)
        
        this.process!.on('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
      })
    }
  }
  
  /**
   * 执行任务
   */
  async executeTask(task: {
    type: string
    prompt: string
    files?: string[]
    context?: string
  }): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
      let fullPrompt = task.prompt
      
      // 添加文件上下文
      if (task.files && task.files.length > 0) {
        fullPrompt = `请查看以下文件：${task.files.join(', ')}\n\n${fullPrompt}`
      }
      
      // 添加额外上下文
      if (task.context) {
        fullPrompt = `${task.context}\n\n${fullPrompt}`
      }
      
      // 收集响应
      let response = ''
      this.on('output', (data) => {
        response += data
      })
      
      // 发送命令
      await this.sendCommand(fullPrompt)
      
      return {
        success: true,
        result: this.cleanOutput(response)
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}