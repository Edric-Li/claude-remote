import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { spawn, ChildProcess } from 'child_process'

export interface ClaudeSDKConfig {
  apiKey?: string
  baseUrl?: string
  workingDirectory: string
  model?: string
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
  private pendingPermissions: Map<string, { resolve: Function; reject: Function; toolData: any }> = new Map()
  private isWaitingForPermission: boolean = false

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
    
    // 如果正在等待权限确认，不允许发送新命令
    if (this.isWaitingForPermission) {
      console.log('[ClaudeSDKWorker] Cannot send command while waiting for permission')
      throw new Error('Waiting for permission approval')
    }

    // Ask模式下，预先检查是否需要权限
    if (this.currentMode === 'ask') {
      const requiredPermissions = this.analyzeCommandForPermissions(command)
      if (requiredPermissions.length > 0) {
        console.log('[ClaudeSDKWorker] Detected operations requiring permission in Ask mode:', requiredPermissions)
        
        // 为每个需要权限的操作请求权限
        for (const permission of requiredPermissions) {
          const permissionGranted = await this.requestPermission(permission)
          if (!permissionGranted) {
            console.log('[ClaudeSDKWorker] Permission denied for:', permission.toolName)
            this.emit('output', `❌ 权限被拒绝：${permission.description}`)
            return
          }
        }
        
        console.log('[ClaudeSDKWorker] All permissions granted, proceeding with command')
      }
    }

    this.status = 'busy'

    return new Promise((resolve, reject) => {
      const args: string[] = ['-p'] // Print mode - required for programmatic use

      // 如果有 sessionId，使用 resume 模式
      if (this.config.sessionId) {
        args.splice(0, 1) // 移除 -p
        args.push('--resume', this.config.sessionId, command)
        console.log(`[ClaudeSDKWorker] Using --resume mode with sessionId: ${this.config.sessionId}`)
      } else {
        // 新会话模式
        args.push(command)
        console.log(`[ClaudeSDKWorker] Creating new session with -p mode`)
      }

      // 添加输出格式
      args.push('--output-format', 'stream-json')
      args.push('--verbose')

      // 添加模式参数（如果支持）
      if (this.currentMode && this.currentMode !== 'auto') {
        // Claude CLI可能支持的模式参数
        if (this.currentMode === 'ask') {
          // Ask模式暂时不传递参数，让tool-use事件在前端处理权限
          console.log(`[ClaudeSDKWorker] 🤔 Using ask mode - permissions will be handled by frontend`)
        } else if (this.currentMode === 'yolo') {
          // Yolo模式：由于Claude CLI不支持--yes参数，我们通过权限处理逻辑来实现自动确认
          console.log(`[ClaudeSDKWorker] 🚀 Using yolo mode - auto-approving all operations`)
        } else if (this.currentMode === 'plan') {
          console.log(`[ClaudeSDKWorker] 📋 Using plan mode - execution will require approval`)
        }
      }

      // 注意：使用 --resume 时不能再指定 model
      // 这些参数只在创建新会话时有效
      if (!this.config.sessionId) {
        // 添加模型配置（仅新会话）
        if (this.config.model) {
          args.push('--model', this.config.model)
          console.log(`[ClaudeSDKWorker] 📊 Using model: ${this.config.model}`)
        }
      } else {
        // Resume模式下不能切换模型
        if (this.config.model) {
          console.log(`[ClaudeSDKWorker] ⚠️ Warning: Cannot change model in resume mode. Model parameter '${this.config.model}' will be ignored.`)
          console.log(`[ClaudeSDKWorker] ℹ️ The conversation will continue with its original model.`)
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
        stdio: ['pipe', 'pipe', 'pipe']
      })

      // 关闭 stdin，因为 claude 命令使用 -p 参数，不需要从 stdin 读取
      if (claudeProcess.stdin) {
        claudeProcess.stdin.end()
      }

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
        
        // 发送完整的assistant消息（包含所有内容块）
        this.emit('assistant-message', message)
        
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
        this.isWaitingForPermission = false
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
        // 工具调用 - 在Ask模式下可能需要等待权限确认
        const toolData = {
          id: block.id,
          name: block.name,
          input: block.input,
          timestamp: new Date()
        }
        
        this.emit('tool-use', toolData)
        console.log('[ClaudeSDKWorker] Tool use:', block.name, block.input)
        
        // 如果是Ask模式或其他需要权限的情况，暂停处理
        if (this.shouldWaitForPermission(toolData)) {
          this.isWaitingForPermission = true
          console.log('[ClaudeSDKWorker] Waiting for permission approval...')
        }
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
   * 设置当前模式
   */
  setMode(mode: 'ask' | 'auto' | 'yolo' | 'plan'): void {
    this.currentMode = mode
    console.log(`[ClaudeSDKWorker] Mode set to: ${mode}`)
  }

  /**
   * 分析命令，检测需要权限的操作
   */
  private analyzeCommandForPermissions(command: string): Array<{
    toolName: string
    description: string
    toolInput: any
  }> {
    const permissions = []
    const lowerCommand = command.toLowerCase()
    
    // 检测文件创建操作
    if (lowerCommand.includes('创建') && (lowerCommand.includes('文件') || lowerCommand.includes('file'))) {
      // 尝试提取文件名
      const fileMatch = command.match(/([\w\-\.]+\.\w+)/)
      const fileName = fileMatch ? fileMatch[1] : '未知文件'
      
      permissions.push({
        toolName: 'Write',
        description: `创建文件: ${fileName}`,
        toolInput: {
          file_path: `./${fileName}`,
          content: '从用户输入中推断的内容'
        }
      })
    }
    
    // 检测文件修改操作
    if ((lowerCommand.includes('修改') || lowerCommand.includes('编辑') || lowerCommand.includes('更新')) && 
        (lowerCommand.includes('文件') || lowerCommand.includes('file'))) {
      permissions.push({
        toolName: 'Edit',
        description: '修改文件内容',
        toolInput: {
          file_path: '检测到的文件路径',
          old_string: '待替换内容',
          new_string: '新内容'
        }
      })
    }
    
    // 检测命令执行操作
    if (lowerCommand.includes('执行') || lowerCommand.includes('运行') || lowerCommand.includes('命令')) {
      permissions.push({
        toolName: 'Bash',
        description: '执行系统命令',
        toolInput: {
          command: '从用户输入推断的命令',
          description: '执行系统命令'
        }
      })
    }
    
    return permissions
  }
  
  /**
   * 请求权限并等待用户响应
   */
  private async requestPermission(permission: {
    toolName: string
    description: string
    toolInput: any
  }): Promise<boolean> {
    return new Promise((resolve) => {
      const permissionId = uuidv4()
      
      // 存储待处理的权限请求
      this.pendingPermissions.set(permissionId, {
        resolve,
        reject: () => resolve(false),
        toolData: permission
      })
      
      // 设置等待权限标志
      this.isWaitingForPermission = true
      
      // 发送工具使用事件，触发权限对话框
      this.emit('tool-use', {
        id: permissionId,
        name: permission.toolName,
        input: permission.toolInput,
        requiresPermission: true,
        description: permission.description
      })
      
      console.log(`[ClaudeSDKWorker] Permission requested for ${permission.toolName}: ${permission.description}`)
    })
  }
  
  /**
   * 检查是否需要等待权限确认
   */
  private shouldWaitForPermission(toolData: any): boolean {
    // 这个逻辑会在agent-worker.ts中处理，这里先标记需要权限的情况
    return this.currentMode === 'ask' || 
           (this.currentMode === 'auto' && this.isDangerous(toolData)) ||
           (this.currentMode === 'plan' && !this.isReadOnly(toolData))
  }
  
  /**
   * 检查是否是危险操作（Auto模式用）
   */
  private isDangerous(toolData: any): boolean {
    const dangerous = ['Write', 'Edit', 'Bash', 'MultiEdit']
    return dangerous.includes(toolData.name)
  }
  
  /**
   * 检查是否是只读操作（Plan模式用）
   */
  private isReadOnly(toolData: any): boolean {
    const readOnly = ['Read', 'Grep', 'Glob', 'LS', 'WebFetch']
    return readOnly.includes(toolData.name)
  }
  
  /**
   * 处理权限响应
   */
  async handlePermissionResponse(permissionId: string, action: 'approve' | 'deny', modifiedInput?: any, reason?: string): Promise<void> {
    console.log(`[ClaudeSDKWorker] Permission ${action} for ${permissionId}`)
    
    const pending = this.pendingPermissions.get(permissionId)
    if (pending) {
      this.pendingPermissions.delete(permissionId)
      
      // 重置等待权限标志
      this.isWaitingForPermission = false
      
      if (action === 'approve') {
        console.log('[ClaudeSDKWorker] Permission approved, resolving with true')
        pending.resolve(true)
      } else {
        console.log('[ClaudeSDKWorker] Permission denied:', reason || 'No reason provided')
        pending.resolve(false)
        
        pending.reject(new Error(reason || 'Permission denied'))
      }
    }
    
    this.isWaitingForPermission = false
  }

  /**
   * 终止 Worker
   */
  terminate() {
    // 清理待处理的权限请求
    for (const [id, pending] of this.pendingPermissions) {
      pending.reject(new Error('Worker terminated'))
    }
    this.pendingPermissions.clear()
    
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM')
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL')
        }
      }, 5000)
    }
    this.status = 'idle'
    this.isWaitingForPermission = false
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