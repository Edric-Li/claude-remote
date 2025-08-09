import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'

export interface ClaudeCodeConfig {
  apiKey?: string
  baseUrl?: string
  workingDirectory: string
  model?: string
  maxTokens?: number
  temperature?: number
  timeout?: number
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
  private status: 'idle' | 'busy' | 'waiting' | 'error' | 'stopped' = 'idle'
  private currentSession: ClaudeSession | null = null
  private outputBuffer: string = ''
  private isWaitingForInput: boolean = false
  
  constructor(config: ClaudeCodeConfig) {
    super()
    this.id = uuidv4()
    this.config = config
  }
  
  /**
   * 启动 Claude Code CLI 进程 - 使用非交互式模式
   */
  async spawn(): Promise<void> {
    // 非交互式模式不需要持久进程，改为按需执行
    this.status = 'idle'
    this.emit('ready')
    return Promise.resolve()
  }
  
  /**
   * 发送命令到 Claude Code - 使用非交互式模式
   */
  async sendCommand(command: string): Promise<void> {
    if (this.status !== 'idle') {
      throw new Error(`Worker is ${this.status}`)
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
    
    return new Promise((resolve, reject) => {
      const args = [
        '-p', // Print mode - 非交互式
        command, // 用户输入
        '--output-format', 'stream-json', // JSONL 输出格式
        '--verbose' // 详细输出
      ]
      
      // 添加配置参数
      if (this.config.model) {
        args.push('--model', this.config.model)
      }
      if (this.config.maxTokens) {
        args.push('--max-tokens', this.config.maxTokens.toString())
      }
      if (this.config.temperature !== undefined) {
        args.push('--temperature', this.config.temperature.toString())
      }
      
      console.log(`Executing Claude with args:`, args)
      
      // 使用 spawn 执行一次性命令
      const env: Record<string, string> = {
        ANTHROPIC_API_KEY: this.config.apiKey || process.env.ANTHROPIC_API_KEY || '',
      }
      
      // 复制所有环境变量
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          env[key] = value
        }
      }
      
      // 添加自定义 API 基础 URL
      if (this.config.baseUrl) {
        env.ANTHROPIC_BASE_URL = this.config.baseUrl
      }
      
      const claudeProcess = spawn('claude', args, {
        env,
        cwd: this.config.workingDirectory || process.cwd(),
        stdio: ['inherit', 'pipe', 'pipe'] // stdin 继承，stdout/stderr 管道
      })
      
      let outputBuffer = ''
      let errorBuffer = ''
      
      // 处理 stdout - JSONL 格式
      if (claudeProcess.stdout) {
        claudeProcess.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString()
          console.log('Raw Claude stdout chunk:', chunk)
          outputBuffer += chunk
          
          // 解析 JSONL
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line)
                console.log('Parsed JSON message:', message)
                this.handleStreamMessage(message)
              } catch (e) {
                // 不是有效的 JSON，可能是部分行
                console.log('Non-JSON output:', line)
                // 对于非JSON输出，也直接emit output
                this.emit('output', line)
              }
            }
          }
        })
      }
      
      // 处理 stderr
      if (claudeProcess.stderr) {
        claudeProcess.stderr.on('data', (data: Buffer) => {
          errorBuffer += data.toString()
          console.error('Claude stderr:', data.toString())
        })
      }
      
      // 处理进程退出
      claudeProcess.on('close', (code) => {
        this.status = 'idle'
        
        if (code === 0) {
          // 成功完成 - 不重复添加历史记录，因为已经在 handleStreamMessage 中处理过了
          this.emit('response-complete')
          resolve()
        } else {
          // 出错
          const error = new Error(`Claude process exited with code ${code}: ${errorBuffer}`)
          this.emit('error', error)
          reject(error)
        }
      })
      
      // 处理进程错误
      claudeProcess.on('error', (err) => {
        this.status = 'idle'
        console.error('Failed to spawn Claude:', err)
        this.emit('error', err)
        reject(err)
      })
    })
  }
  
  /**
   * 处理流式消息
   */
  private handleStreamMessage(message: any) {
    console.log('Stream message received:', JSON.stringify(message, null, 2))
    
    // 根据消息类型处理
    if (message.type === 'text') {
      // 文本内容
      console.log('Emitting text output:', message.content || message.text || '')
      this.emit('output', message.content || message.text || '')
      
      // 发送进度事件
      this.emit('progress', {
        type: 'text_chunk',
        content: message.content || message.text || '',
        timestamp: new Date()
      })
    } else if (message.type === 'tool_use') {
      // 工具使用
      console.log('Tool use:', message)
      this.emit('tool-use', {
        name: message.name,
        input: message.input,
        id: message.id,
        timestamp: new Date()
      })
      
      // 发送进度事件
      this.emit('progress', {
        type: 'tool_start',
        tool: message.name,
        input: message.input,
        timestamp: new Date()
      })
    } else if (message.type === 'tool_result') {
      // 工具结果
      console.log('Tool result:', message)
      this.emit('progress', {
        type: 'tool_result',
        tool: message.tool_use_id,
        result: message.content,
        timestamp: new Date()
      })
    } else if (message.type === 'system') {
      // 系统消息
      console.log('System message:', message)
      
      // 检查是否包含 token 使用信息
      if (message.usage) {
        this.emit('system-info', {
          type: 'token_usage',
          usage: message.usage,
          timestamp: new Date()
        })
      }
      
      // 检查是否包含模型信息
      if (message.model) {
        this.emit('system-info', {
          type: 'model_info',
          model: message.model,
          timestamp: new Date()
        })
      }
    } else if (message.type === 'assistant') {
      // Assistant消息 - 包含Claude的回复
      console.log('Assistant message received, emitting assistant-message event')
      this.emit('assistant-message', message)
      
      // 提取 token 使用信息
      if (message.message && message.message.usage) {
        this.emit('system-info', {
          type: 'token_usage',
          usage: message.message.usage,
          timestamp: new Date()
        })
      }
      
      // 发送完成进度
      this.emit('progress', {
        type: 'response_complete',
        timestamp: new Date()
      })
    } else if (message.type === 'result') {
      // 结果消息 - 包含最终结果 (只记录，不重复输出)
      console.log('Final result:', message.result)
      
      // 发送结果信息
      if (message.usage) {
        this.emit('system-info', {
          type: 'final_usage',
          usage: message.usage,
          timestamp: new Date()
        })
      }
    } else if (message.type === 'error') {
      // 错误消息
      console.log('Error message:', message)
      this.emit('progress', {
        type: 'error',
        error: message.error || message.message,
        timestamp: new Date()
      })
    } else {
      // 其他类型
      console.log('Other message type:', message.type, JSON.stringify(message))
      this.emit('progress', {
        type: 'unknown',
        data: message,
        timestamp: new Date()
      })
    }
  }
  
  /**
   * 处理错误输出
   */
  private handleError(data: string) {
    // 某些 CLI 工具会把正常信息输出到 stderr
    // 需要判断是否真的是错误
    
    // 忽略这些常见的非致命消息
    const nonFatalMessages = [
      'Worker is busy',
      'Failed to send input to Claude: Worker is busy',
      'Connecting to server',
      'Connected to server'
    ]
    
    // 检查是否是非致命消息
    if (nonFatalMessages.some(msg => data.includes(msg))) {
      // 只输出警告，不触发错误状态
      this.emit('warning', data)
      return
    }
    
    // 检查是否是真正的错误
    if (data.includes('Error:') || data.includes('error:') || data.includes('FATAL')) {
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
    // 非交互式模式不需要关闭进程
    this.status = 'idle'
    return Promise.resolve()
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
  
  /**
   * 终止Worker并清理资源
   */
  terminate() {
    this.status = 'stopped'
    // 由于使用非交互式模式，不需要维护持久进程
    // 但我们可以清理事件监听器
    this.removeAllListeners()
  }
}