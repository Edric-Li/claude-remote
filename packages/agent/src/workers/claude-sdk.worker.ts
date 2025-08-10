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
  public currentMode: 'ask' | 'auto' | 'yolo' | 'plan' = 'auto'

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

      // 注意：使用 --resume 时不能再指定 model, temperature
      // 这些参数只在创建新会话时有效
      if (!this.config.sessionId) {
        // 添加模型配置（仅新会话）
        if (this.config.model) {
          args.push('--model', this.config.model)
        } else {
          // 使用默认模型
          args.push('--model', 'claude-sonnet-4-20250514')
        }
        // Claude CLI 不支持 --max-tokens 参数，跳过
        // if (this.config.maxTokens) {
        //   args.push('--max-tokens', this.config.maxTokens.toString())
        // }
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
   * Claude Code 使用 stream-json 格式时会输出以下类型的消息：
   * - system: 系统初始化信息
   * - user: 用户消息
   * - assistant: 助手消息（包含 thinking 和 tool_use）
   * - result: 结果消息
   */
  private handleStreamMessage(message: any) {
    console.log('[ClaudeSDKWorker] Stream message:', message.type, message)

    switch (message.type) {
      case 'system':
        // 系统消息，包含初始化信息
        if (message.subtype === 'init' || message.session_id) {
          const sessionId = message.session_id || message.sessionId || this.config.sessionId
          this.config.sessionId = sessionId // 保存 sessionId
          this.emit('system-init', {
            sessionId: sessionId,
            model: message.model,
            cwd: message.cwd || this.config.workingDirectory,
            tools: message.tools || []
          })
          console.log('[ClaudeSDKWorker] Session initialized:', sessionId)
        }
        break

      case 'user':
        // 用户消息
        this.emit('user-message', {
          content: message.message?.content || '',
          timestamp: message.timestamp || new Date().toISOString()
        })
        break

      case 'assistant':
        // Assistant 消息 - 需要解析 content 数组
        if (message.message && message.message.content) {
          const content = message.message.content
          
          // content 可能是字符串或数组
          if (typeof content === 'string') {
            this.emit('output', content)
          } else if (Array.isArray(content)) {
            // 过滤并处理内容块，跳过tool_result类型
            const filteredContent = content.filter((block: any) => {
              // 只处理text和thinking类型，跳过tool_result和tool_use
              return block.type === 'text' || block.type === 'thinking'
            })
            
            // 遍历过滤后的内容块
            for (const block of filteredContent) {
              this.handleContentBlock(block)
            }
          }
        }
        
        // 如果消息包含 usage 信息
        if (message.message?.usage) {
          this.emit('token-usage', {
            input_tokens: message.message.usage.input_tokens,
            output_tokens: message.message.usage.output_tokens,
            total_tokens: (message.message.usage.input_tokens || 0) + (message.message.usage.output_tokens || 0),
            cache_creation_input_tokens: message.message.usage.cache_creation_input_tokens,
            cache_read_input_tokens: message.message.usage.cache_read_input_tokens,
            timestamp: new Date()
          })
        }
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
          console.log('[ClaudeSDKWorker] Final token usage:', message.usage)
        }
        
        // 重置状态为 idle，因为会话已完成
        this.status = 'idle'
        console.log('[ClaudeSDKWorker] Result received, status reset to idle')
        
        // 标记会话结束
        this.emit('result', {
          subtype: message.subtype || 'success',
          timestamp: new Date()
        })
        break

      case 'error':
        // 错误消息 - 重置状态
        this.status = 'idle'
        console.log('[ClaudeSDKWorker] Error received, status reset to idle')
        this.emit('error', new Error(message.error || message.message || 'Unknown error'))
        break

      default:
        // 其他消息类型 - 记录下来以便调试
        console.log('[ClaudeSDKWorker] Unknown message type:', message.type, message)
        this.emit('message', message)
        break
    }
  }

  /**
   * 处理 assistant 消息中的 content 块
   */
  private handleContentBlock(block: any) {
    console.log('[ClaudeSDKWorker] Content block:', block.type)
    
    switch (block.type) {
      case 'text':
        // 普通文本输出
        this.emit('output', block.text || '')
        break
        
      case 'thinking':
        // 思考过程 - Claude 的内部思考
        this.emit('thinking', {
          content: block.text || block.content || '',
          timestamp: new Date()
        })
        console.log('[ClaudeSDKWorker] Thinking:', block.text || block.content)
        break
        
      case 'tool_use':
        // 工具调用
        this.emit('tool-use', {
          id: block.id,
          name: block.name,
          input: block.input,
          timestamp: new Date()
        })
        console.log('[ClaudeSDKWorker] Tool use:', block.name, block.input)
        break
        
      case 'tool_result':
        // 工具结果
        this.emit('tool-result', {
          tool_use_id: block.tool_use_id,
          content: block.content,
          is_error: block.is_error || false,
          timestamp: new Date()
        })
        console.log('[ClaudeSDKWorker] Tool result:', block.content)
        break
        
      default:
        // 未知类型的块
        console.log('[ClaudeSDKWorker] Unknown content block type:', block.type, block)
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