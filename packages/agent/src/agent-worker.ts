import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import chalk from 'chalk'
import ora from 'ora'
import * as readline from 'node:readline'
import { RepositoryManager, RepositoryConfig, WorkspaceInfo } from './services/repository-manager'
import { spawn } from 'child_process'
import * as path from 'path'
import { ClaudeSDKWorker } from './workers/claude-sdk.worker'
import { ClaudeHistoryReader } from './services/claude-history-reader'

interface AgentWorkerOptions {
  serverUrl: string
  name: string
  token?: string
  capabilities?: string[]
}

interface ClaudeConfig {
  baseUrl: string
  authToken: string
  model: string
  maxTokens: number
  temperature: number
  timeout: number
}

interface TaskAssignment {
  taskId: string
  repository: RepositoryConfig
  claudeConfig?: ClaudeConfig
  command: string
  args?: string[]
  env?: Record<string, string>
}

export class AgentWorker {
  private socket!: Socket
  private agentId: string
  private repositoryManager: RepositoryManager
  private currentWorkspace: WorkspaceInfo | null = null
  private rl: readline.Interface
  private spinner: ora.Ora
  private claudeWorkers: Map<string, ClaudeSDKWorker> = new Map()
  private historyReader: ClaudeHistoryReader = new ClaudeHistoryReader()

  constructor(private options: AgentWorkerOptions) {
    // 使用环境变量或默认的 agent ID（从数据库中获取的现有 agent）
    this.agentId = process.env.AGENT_ID || '7db5fab9-2f91-4d74-9072-47ac34911fc6'
    this.repositoryManager = new RepositoryManager()
    this.spinner = ora('Initializing agent worker...')
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
  }

  async start(): Promise<void> {
    this.spinner.start('Connecting to server...')
    
    this.socket = io(this.options.serverUrl, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 5000,
      auth: this.options.token ? { token: this.options.token } : undefined
    })
    
    this.setupEventHandlers()
    this.setupCommandHandlers()
  }

  private setupEventHandlers(): void {
    this.socket.on('connect', () => {
      this.spinner.succeed(chalk.green('Connected to server'))
      console.log(chalk.blue(`Agent ID: ${this.agentId}`))
      console.log(chalk.blue(`Socket ID: ${this.socket.id}`))
      console.log(chalk.blue(`Agent Name: ${this.options.name}`))
      
      // 如果有 token，先进行认证
      if (this.options.token) {
        console.log(chalk.yellow('Authenticating with server...'))
        this.socket.emit('agent:authenticate', {
          name: this.options.name,
          secretKey: this.options.token
        })
      } else {
        // 没有 token 时直接注册为 worker
        this.registerWorker()
      }
    })

    // 处理认证成功
    this.socket.on('agent:authenticated', (data: any) => {
      console.log(chalk.green('✅ Authentication successful'))
      console.log(chalk.blue(`Agent ID: ${data.agentId}`))
      this.agentId = data.agentId  // 使用服务器返回的 agentId
      
      // 认证成功后注册 worker
      this.registerWorker()
    })

    // 处理认证失败
    this.socket.on('agent:auth_failed', (data: { message: string }) => {
      this.spinner.fail(chalk.red(`Authentication failed: ${data.message}`))
      console.log(chalk.yellow('\nPlease check your agent name and secret key.'))
      process.exit(1)
    })

    // 处理 worker 注册成功
    this.socket.on('worker:registered', (data: any) => {
      console.log(chalk.green('✅ Worker registered successfully'))
      console.log(chalk.yellow('\n🤖 Worker ready to receive tasks'))
    })

    this.socket.on('disconnect', () => {
      console.log(chalk.red('\n❌ Disconnected from server'))
      this.spinner.start('Reconnecting...')
    })

    this.socket.on('connect_error', (error) => {
      this.spinner.fail(chalk.red(`Connection failed: ${error.message}`))
      setTimeout(() => {
        this.spinner.start('Retrying...')
      }, 5000)
    })

    // 处理任务分配
    this.socket.on('task:assign', async (task: TaskAssignment) => {
      console.log(chalk.cyan(`\n📋 Received task: ${task.taskId}`))
      await this.handleTask(task)
    })

    // 处理任务取消
    this.socket.on('task:cancel', async (taskId: string) => {
      console.log(chalk.yellow(`\n⚠️ Task cancelled: ${taskId}`))
      if (this.currentWorkspace) {
        await this.repositoryManager.cleanupWorkspace(this.currentWorkspace.id)
        this.currentWorkspace = null
      }
    })
    
    // 处理 Worker 启动请求
    this.socket.on('worker:start', async (data: {
      taskId: string
      tool?: string
      workingDirectory?: string
      initialPrompt?: string
      claudeConfig?: ClaudeConfig
      sessionId?: string
      claudeSessionId?: string  // Claude的真实会话ID
      conversationHistory?: Array<{
        role: 'human' | 'assistant'
        content: string
      }>
    }) => {
      console.log(chalk.cyan(`\n🚀 Starting Claude worker for task: ${data.taskId}`))
      console.log(chalk.yellow(`📝 sessionId: ${data.sessionId}, claudeSessionId: ${data.claudeSessionId}`))
      
      try {
        // 创建 Claude SDK Worker 实例
        // 优先使用 claudeSessionId（用于恢复），否则让Claude生成新的
        const worker = new ClaudeSDKWorker({
          workingDirectory: data.workingDirectory || process.cwd(),
          apiKey: data.claudeConfig?.authToken || process.env.ANTHROPIC_API_KEY,
          baseUrl: data.claudeConfig?.baseUrl,
          model: data.claudeConfig?.model,
          maxTokens: data.claudeConfig?.maxTokens,
          temperature: data.claudeConfig?.temperature,
          timeout: data.claudeConfig?.timeout,
          sessionId: data.claudeSessionId || undefined,  // 使用Claude的sessionId用于恢复
          conversationHistory: data.conversationHistory
        })
        
        // 设置事件监听器
        this.setupWorkerEventListeners(worker, data.taskId)
        
        // 在响应完成时通知任务完成
        worker.on('response-complete', () => {
          // 通知任务完成
          console.log(chalk.green(`✅ Claude worker task completed: ${data.taskId}`))
          this.socket.emit('worker:status', {
            taskId: data.taskId,
            status: 'completed'
          })
        })
        
        worker.on('ready', () => {
          console.log(chalk.green(`✅ Claude worker ready for task: ${data.taskId}`))
          this.socket.emit('worker:status', {
            taskId: data.taskId,
            status: 'started'
          })
        })
        
        // 监听系统初始化事件
        worker.on('system-init', (init) => {
          console.log(chalk.blue(`🎯 System initialized: sessionId=${init.sessionId}, model=${init.model}`))
          this.socket.emit('worker:message', {
            taskId: data.taskId,
            message: {
              type: 'system',
              subtype: 'init',
              sessionId: init.sessionId,
              model: init.model || 'claude-3-sonnet',
              tools: init.tools || ['read', 'write', 'execute', 'search'],
              cwd: init.cwd
            }
          })
        })
        
        worker.on('error', (error) => {
          console.error(chalk.red(`❌ Claude worker error: ${error.message}`))
          this.socket.emit('worker:status', {
            taskId: data.taskId,
            status: 'error',
            error: error.message
          })
        })
        
        // 启动 Worker
        try {
          await worker.spawn()
          // 保存 Worker 实例 - 只有在成功启动后才保存
          this.claudeWorkers.set(data.taskId, worker)
          console.log(chalk.green(`✅ Worker saved for task: ${data.taskId}`))
        } catch (spawnError) {
          console.error(chalk.red(`❌ Failed to spawn Claude process: ${spawnError.message}`))
          throw spawnError
        }
        
        // 如果有初始提示，发送给 Claude
        if (data.initialPrompt) {
          await worker.sendCommand(data.initialPrompt)
        }
        
      } catch (error) {
        console.error(chalk.red(`❌ Failed to start Claude worker: ${error.message}`))
        this.socket.emit('worker:status', {
          taskId: data.taskId,
          status: 'error',
          error: error.message
        })
      }
    })
    
    // 处理 Worker 输入
    this.socket.on('worker:input', async (data: {
      taskId: string
      input: string
      sessionId?: string
      conversationHistory?: Array<{
        role: 'human' | 'assistant'
        content: string
      }>
    }) => {
      console.log(chalk.blue(`📝 Sending input to Claude: ${data.input.substring(0, 100)}...`))
      console.log(chalk.yellow(`🔍 Debug - sessionId: ${data.sessionId}, conversationHistory length: ${data.conversationHistory?.length || 0}`))
      
      const worker = this.claudeWorkers.get(data.taskId)
      if (!worker) {
        console.error(chalk.red(`❌ No worker found for task: ${data.taskId}`))
        this.socket.emit('worker:status', {
          taskId: data.taskId,
          status: 'error',
          error: 'Worker not found'
        })
        return
      }
      
      try {
        // 直接使用当前 worker，Claude SDK 会自动处理 --resume
        await worker.sendCommand(data.input)
      } catch (error) {
        console.error(chalk.red(`❌ Failed to send input to Claude: ${error.message}`))
        this.socket.emit('worker:status', {
          taskId: data.taskId,
          status: 'error',
          error: error.message
        })
      }
    })
    
    // 处理 Worker 停止请求
    this.socket.on('worker:stop', async (data: {
      taskId: string
    }) => {
      console.log(chalk.yellow(`⏹ Stopping Claude worker for task: ${data.taskId}`))
      
      const worker = this.claudeWorkers.get(data.taskId)
      if (worker) {
        await worker.shutdown()
        this.claudeWorkers.delete(data.taskId)
        
        this.socket.emit('worker:status', {
          taskId: data.taskId,
          status: 'stopped'
        })
      }
    })
    
    // 处理历史记录获取请求
    this.socket.on('history:fetch', async (data: {
      sessionId: string
      requestId: string
      taskId?: string
    }) => {
      console.log(chalk.blue(`📚 Fetching history for session: ${data.sessionId}`))
      
      try {
        // 尝试通过 taskId 找到对应的 worker
        let claudeSessionId = data.sessionId
        
        if (data.taskId) {
          const worker = this.claudeWorkers.get(data.taskId)
          if (worker) {
            const actualSessionId = worker.getSessionId()
            if (actualSessionId) {
              claudeSessionId = actualSessionId
              console.log(chalk.yellow(`📝 Using Claude sessionId: ${claudeSessionId} for task: ${data.taskId}`))
            }
          }
        }
        
        // 如果没有找到 worker，尝试查找所有 worker
        if (claudeSessionId === data.sessionId) {
          for (const [taskId, worker] of this.claudeWorkers) {
            const sessionId = worker.getSessionId()
            if (sessionId) {
              console.log(chalk.yellow(`📝 Found Claude sessionId: ${sessionId} in worker: ${taskId}`))
              claudeSessionId = sessionId
              break
            }
          }
        }
        
        const messages = await this.historyReader.fetchConversation(claudeSessionId)
        
        this.socket.emit('history:response', {
          requestId: data.requestId,
          sessionId: data.sessionId,
          messages: messages,
          success: true
        })
        
        console.log(chalk.green(`✅ Sent ${messages.length} messages for session: ${data.sessionId}`))
      } catch (error) {
        console.error(chalk.red(`❌ Failed to fetch history: ${error.message}`))
        
        this.socket.emit('history:response', {
          requestId: data.requestId,
          sessionId: data.sessionId,
          messages: [],
          success: false,
          error: error.message
        })
      }
    })
    
    // 处理会话列表获取请求
    this.socket.on('history:list', async (data: {
      requestId: string
    }) => {
      console.log(chalk.blue(`📚 Fetching conversation list`))
      
      try {
        const conversations = await this.historyReader.listConversations()
        
        this.socket.emit('history:list:response', {
          requestId: data.requestId,
          conversations: conversations,
          success: true
        })
        
        console.log(chalk.green(`✅ Sent ${conversations.length} conversations`))
      } catch (error) {
        console.error(chalk.red(`❌ Failed to list conversations: ${error.message}`))
        
        this.socket.emit('history:list:response', {
          requestId: data.requestId,
          conversations: [],
          success: false,
          error: error.message
        })
      }
    })
  }

  private async handleTask(task: TaskAssignment): Promise<void> {
    try {
      // 更新状态为运行中
      this.socket.emit('worker:status', {
        workerId: this.agentId,
        agentId: this.agentId,
        status: 'busy',
        currentTask: task.taskId
      })

      console.log(chalk.blue(`\n📦 Setting up repository: ${task.repository.name}`))
      
      // 创建工作区
      this.currentWorkspace = await this.repositoryManager.createWorkspace(
        task.repository,
        task.taskId
      )
      
      console.log(chalk.green(`✅ Workspace ready: ${this.currentWorkspace.path}`))
      
      // 执行 CLI 工具
      console.log(chalk.blue(`\n🚀 Executing: ${task.command} ${task.args?.join(' ') || ''}`))
      
      const result = await this.executeCommand(
        task.command,
        task.args || [],
        this.currentWorkspace.path,
        task.env
      )
      
      // 发送结果
      this.socket.emit('task:complete', {
        taskId: task.taskId,
        agentId: this.agentId,
        success: result.success,
        output: result.output,
        error: result.error
      })
      
      console.log(chalk.green(`\n✅ Task completed: ${task.taskId}`))
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(chalk.red(`\n❌ Task failed: ${errorMessage}`))
      
      this.socket.emit('task:error', {
        taskId: task.taskId,
        agentId: this.agentId,
        error: errorMessage
      })
    } finally {
      // 清理工作区
      if (this.currentWorkspace) {
        await this.repositoryManager.cleanupWorkspace(this.currentWorkspace.id)
        this.currentWorkspace = null
      }
      
      // 更新状态为空闲
      this.socket.emit('worker:status', {
        workerId: this.agentId,
        agentId: this.agentId,
        status: 'idle'
      })
    }
  }

  private executeCommand(
    command: string,
    args: string[],
    cwd: string,
    env?: Record<string, string>
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        shell: true
      })
      
      let output = ''
      let error = ''
      
      child.stdout.on('data', (data) => {
        const text = data.toString()
        output += text
        process.stdout.write(chalk.gray(text))
      })
      
      child.stderr.on('data', (data) => {
        const text = data.toString()
        error += text
        process.stderr.write(chalk.red(text))
      })
      
      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output,
          error: code !== 0 ? error : undefined
        })
      })
      
      child.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        })
      })
    })
  }

  private setupCommandHandlers(): void {
    this.rl.on('line', (input) => {
      const text = input.trim()
      
      if (!text) return
      
      switch (text) {
        case 'status':
          this.showStatus()
          break
        case 'workspace':
          this.showWorkspace()
          break
        case 'clean':
          this.cleanCache()
          break
        case 'help':
          this.showHelp()
          break
        default:
          console.log(chalk.gray('Unknown command. Type "help" for available commands.'))
      }
    })
  }

  private showStatus(): void {
    console.log(chalk.blue('\n📊 Agent Status:'))
    console.log(`  Connected: ${this.socket.connected}`)
    console.log(`  Agent ID: ${this.agentId}`)
    console.log(`  Agent Name: ${this.options.name}`)
    console.log(`  Current Workspace: ${this.currentWorkspace?.path || 'None'}`)
    
    const workspaces = this.repositoryManager.getActiveWorkspaces()
    console.log(`  Active Workspaces: ${workspaces.length}`)
  }

  private showWorkspace(): void {
    if (this.currentWorkspace) {
      console.log(chalk.blue('\n📁 Current Workspace:'))
      console.log(`  ID: ${this.currentWorkspace.id}`)
      console.log(`  Path: ${this.currentWorkspace.path}`)
      console.log(`  Repository: ${this.currentWorkspace.repositoryId}`)
      console.log(`  Created: ${this.currentWorkspace.createdAt.toLocaleString()}`)
    } else {
      console.log(chalk.gray('\n No active workspace'))
    }
  }

  private async cleanCache(): Promise<void> {
    console.log(chalk.yellow('\n🧹 Cleaning old workspaces...'))
    await this.repositoryManager.cleanupOldWorkspaces(24)
    console.log(chalk.green('✅ Cleanup complete'))
  }

  private registerWorker(): void {
    // 先注册为 agent
    this.socket.emit('agent:register', {
      agentId: this.agentId,
      name: this.options.name
    })
    
    // 然后注册 worker
    this.socket.emit('worker:register', {
      workerId: this.agentId,
      agentId: this.agentId,
      name: this.options.name,
      capabilities: this.options.capabilities || ['claude-code', 'cursor', 'qucoder'],
      status: 'idle'
    })
  }

  /**
   * 设置Worker事件监听器
   */
  private setupWorkerEventListeners(worker: ClaudeSDKWorker, taskId: string): void {
    // 使用消息去重机制
    let messageBuffer = ''
    const sentMessages = new Set() // 用于去重的消息集合
    
    // 监听助手消息事件
    worker.on('assistant-message', (message) => {
      // 创建消息内容的哈希来去重
      if (message.message && message.message.content) {
        const textContent = message.message.content
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join('')
        
        if (textContent.trim()) {
          const messageHash = Buffer.from(textContent.trim()).toString('base64').substring(0, 32)
          
          if (!sentMessages.has(messageHash)) {
            console.log(`Sending unique assistant message (hash: ${messageHash}):`, textContent.substring(0, 100) + '...')
            
            this.socket.emit('worker:message', {
              agentId: this.agentId,
              taskId: taskId,
              message: message  // 直接发送原始助手消息
            })
            
            sentMessages.add(messageHash)
          } else {
            console.log(`Duplicate assistant message detected and skipped (hash: ${messageHash})`)
          }
        }
      }
    })
    
    // 监听工具调用事件
    worker.on('tool-use', (toolData) => {
      console.log(`Tool use detected:`, toolData)
      this.socket.emit('worker:tool-use', {
        agentId: this.agentId,
        taskId: taskId,
        toolUse: toolData
      })
    })
    
    // 监听系统消息（包含 token 信息）
    worker.on('system-info', (info) => {
      console.log(`System info:`, info)
      this.socket.emit('worker:system-info', {
        agentId: this.agentId,
        taskId: taskId,
        info
      })
    })
    
    // 监听处理进度
    worker.on('progress', (progress) => {
      console.log(`Processing progress:`, progress)
      this.socket.emit('worker:progress', {
        agentId: this.agentId,
        taskId: taskId,
        progress
      })
    })
    
    // 监听思考过程
    worker.on('thinking', (thinking) => {
      console.log(`Thinking process:`, thinking)
      const sessionId = worker.getSessionId()
      this.socket.emit('worker:thinking', {
        agentId: this.agentId,
        taskId: taskId,
        sessionId: sessionId,
        thinking
      })
    })
    
    // 监听 Todo 列表
    worker.on('todo-list', (todoList) => {
      console.log(`Todo list update:`, todoList)
      const sessionId = worker.getSessionId()
      this.socket.emit('worker:todo-list', {
        agentId: this.agentId,
        taskId: taskId,
        sessionId: sessionId,
        todoList
      })
    })
    
    // 监听 Token 使用统计
    worker.on('token-usage', (usage) => {
      console.log(`Token usage:`, usage)
      const sessionId = worker.getSessionId()
      this.socket.emit('worker:token-usage', {
        agentId: this.agentId,
        taskId: taskId,
        sessionId: sessionId,
        usage
      })
    })
  }

  private showHelp(): void {
    console.log(chalk.cyan('\n📚 Available Commands:'))
    console.log('  status    - Show agent status')
    console.log('  workspace - Show current workspace info')
    console.log('  clean     - Clean old workspaces')
    console.log('  help      - Show this help message')
  }

  async stop(): Promise<void> {
    console.log(chalk.yellow('\n\n🛑 Shutting down agent worker...'))
    
    // 清理当前工作区
    if (this.currentWorkspace) {
      await this.repositoryManager.cleanupWorkspace(this.currentWorkspace.id)
    }
    
    this.socket.disconnect()
    this.rl.close()
    process.exit(0)
  }
}

// CLI 入口
if (require.main === module) {
  const worker = new AgentWorker({
    serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
    name: process.env.AGENT_NAME || `Worker-${process.pid}`,
    token: process.env.AUTH_TOKEN,
    capabilities: process.env.CAPABILITIES?.split(',')
  })
  
  worker.start().catch(console.error)
  
  process.on('SIGINT', () => worker.stop())
  process.on('SIGTERM', () => worker.stop())
}