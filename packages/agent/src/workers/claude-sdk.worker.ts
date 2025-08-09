import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { spawn, ChildProcess } from 'child_process'

export interface ClaudeSDKConfig {
  apiKey?: string
  baseUrl?: string
  workingDirectory: string
  model?: string
  maxTokens?: number
  temperature?: number
  timeout?: number
  sessionId?: string
  conversationHistory?: Array<{
    role: 'human' | 'assistant'
    content: string
  }>
}

/**
 * 使用 Claude Code SDK 的 Worker
 * 注意：@anthropic-ai/claude-code 包实际上是一个 CLI 包装器，不是真正的 SDK
 * 所以我们仍然需要通过 spawn 调用，但使用更规范的方式
 */
export class ClaudeSDKWorker extends EventEmitter {
  private id: string
  private config: ClaudeSDKConfig
  private status: 'idle' | 'busy' | 'error' = 'idle'
  private process: ChildProcess | null = null

  constructor(config: ClaudeSDKConfig) {
    super()
    this.id = uuidv4()
    this.config = config
  }

  /**
   * 初始化 Worker
   */
  async spawn(): Promise<void> {
    this.status = 'idle'
    this.emit('ready')
    return Promise.resolve()
  }

  /**
   * 发送消息到 Claude
   * 使用 --resume 或新会话模式
   */
  async sendCommand(command: string): Promise<void> {
    if (this.status !== 'idle') {
      throw new Error(`Worker is ${this.status}`)
    }

    this.status = 'busy'

    return new Promise((resolve, reject) => {
      const args: string[] = []

      // 如果有 sessionId，使用 resume 模式
      if (this.config.sessionId) {
        args.push('--resume', this.config.sessionId, command)
        console.log(`[ClaudeSDKWorker] Using --resume mode with sessionId: ${this.config.sessionId}`)
      } else {
        // 新会话模式
        args.push('-p', command)
        console.log(`[ClaudeSDKWorker] Creating new session with -p mode`)
      }

      // 添加输出格式
      args.push('--output-format', 'stream-json')
      args.push('--verbose')

      // 注意：使用 --resume 时不能再指定 model, max-tokens, temperature
      // 这些参数只在创建新会话时有效
      if (!this.config.sessionId) {
        // 添加模型配置（仅新会话）
        if (this.config.model) {
          args.push('--model', this.config.model)
        }
        if (this.config.maxTokens) {
          args.push('--max-tokens', this.config.maxTokens.toString())
        }
        if (this.config.temperature !== undefined) {
          args.push('--temperature', this.config.temperature.toString())
        }
      }

      console.log(`[ClaudeSDKWorker] Executing claude with args:`, args)

      // 设置环境变量
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        ANTHROPIC_API_KEY: this.config.apiKey || process.env.ANTHROPIC_API_KEY || ''
      }

      if (this.config.baseUrl) {
        env.ANTHROPIC_BASE_URL = this.config.baseUrl
      }

      // 执行 claude 命令
      const claudeProcess = spawn('claude', args, {
        env,
        cwd: this.config.workingDirectory,
        stdio: ['inherit', 'pipe', 'pipe']
      })

      let sessionIdExtracted = false

      // 处理输出
      if (claudeProcess.stdout) {
        claudeProcess.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString()
          
          // 解析 JSONL 流
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line)
                this.handleStreamMessage(message)

                // 提取 sessionId（新会话时）
                if (!sessionIdExtracted && message.type === 'system') {
                  // Claude CLI 可能在不同的字段返回 sessionId
                  const sessionId = message.sessionId || message.session_id || message.id
                  if (sessionId) {
                    this.config.sessionId = sessionId
                    sessionIdExtracted = true
                    console.log(`[ClaudeSDKWorker] Session ID extracted: ${sessionId}`)
                  }
                }
              } catch (e) {
                // 非 JSON 输出，可能是普通文本
                if (line.trim()) {
                  this.emit('output', line)
                }
              }
            }
          }
        })
      }

      // 处理错误输出
      if (claudeProcess.stderr) {
        claudeProcess.stderr.on('data', (data: Buffer) => {
          console.error('[ClaudeSDKWorker] stderr:', data.toString())
        })
      }

      // 处理进程结束
      claudeProcess.on('close', (code) => {
        this.status = 'idle'
        this.process = null  // 清除进程引用
        
        if (code === 0) {
          this.emit('response-complete')
          resolve()
        } else {
          const error = new Error(`Claude process exited with code ${code}`)
          this.emit('error', error)
          reject(error)
        }
      })

      // 处理进程错误
      claudeProcess.on('error', (err) => {
        this.status = 'error'
        console.error('[ClaudeSDKWorker] Failed to spawn claude:', err)
        this.emit('error', err)
        reject(err)
      })

      this.process = claudeProcess
    })
  }

  /**
   * 处理流式消息
   */
  private handleStreamMessage(message: any) {
    console.log('[ClaudeSDKWorker] Stream message:', message.type)

    switch (message.type) {
      case 'system':
        // 系统消息，包含初始化信息
        if (message.subtype === 'init') {
          this.emit('system-init', {
            sessionId: message.sessionId || this.config.sessionId,
            model: message.model,
            cwd: message.cwd || this.config.workingDirectory,
            tools: message.tools || []
          })
        }
        // Token 使用信息
        if (message.usage) {
          this.emit('system-info', {
            type: 'token_usage',
            usage: message.usage,
            timestamp: new Date()
          })
        }
        break

      case 'text':
        // 文本输出
        this.emit('output', message.content || message.text || '')
        break

      case 'tool_use':
        // 工具调用
        this.emit('tool-use', {
          name: message.name,
          input: message.input,
          id: message.id,
          timestamp: new Date()
        })
        break

      case 'tool_result':
        // 工具结果
        this.emit('tool-result', {
          tool_use_id: message.tool_use_id,
          content: message.content,
          timestamp: new Date()
        })
        break

      case 'assistant':
        // Assistant 消息
        this.emit('assistant-message', message)
        break

      case 'thinking':
        // 思考过程
        this.emit('thinking', {
          content: message.content || message.text || '',
          timestamp: new Date()
        })
        break

      case 'todo':
      case 'todos':
        // Todo 列表
        this.emit('todo-list', {
          items: message.items || message.todos || [],
          timestamp: new Date()
        })
        break

      case 'usage':
      case 'token_usage':
        // Token 使用统计
        this.emit('token-usage', {
          input_tokens: message.input_tokens,
          output_tokens: message.output_tokens,
          total_tokens: message.total_tokens,
          cache_creation_input_tokens: message.cache_creation_input_tokens,
          cache_read_input_tokens: message.cache_read_input_tokens,
          timestamp: new Date()
        })
        break

      case 'error':
        // 错误消息
        this.emit('error', new Error(message.error || message.message || 'Unknown error'))
        break

      case 'result':
        // 结果消息，包含 token 使用统计
        if (message.usage) {
          this.emit('token-usage', {
            input_tokens: message.usage.input_tokens,
            output_tokens: message.usage.output_tokens,
            total_tokens: (message.usage.input_tokens || 0) + (message.usage.output_tokens || 0),
            cache_creation_input_tokens: message.usage.cache_creation_input_tokens,
            cache_read_input_tokens: message.usage.cache_read_input_tokens,
            timestamp: new Date()
          })
          console.log('[ClaudeSDKWorker] Emitted token-usage from result:', message.usage)
        }
        break

      default:
        // 其他消息类型 - 记录下来以便调试
        console.log('[ClaudeSDKWorker] Unknown message type:', message.type, message)
        this.emit('message', message)
        break
    }
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      id: this.id,
      status: this.status,
      sessionId: this.config.sessionId,
      workingDirectory: this.config.workingDirectory
    }
  }

  /**
   * 获取当前会话 ID
   */
  getSessionId(): string | undefined {
    return this.config.sessionId
  }

  /**
   * 获取配置
   */
  getConfig(): ClaudeSDKConfig {
    return { ...this.config }
  }

  /**
   * 终止 Worker
   */
  terminate() {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM')
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL')
        }
      }, 5000)
    }
    this.status = 'idle'
    this.removeAllListeners()
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    this.terminate()
    return Promise.resolve()
  }
}