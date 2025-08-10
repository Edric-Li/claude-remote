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
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

interface AgentWorkerOptions {
  serverUrl: string
  name: string
  token?: string
  capabilities?: string[]
}

interface ClaudeConfig {
  baseUrl: string
  authToken: string
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
  private taskSessionMap: Map<string, string> = new Map() // taskId -> sessionId
  private claudeConfig: ClaudeConfig | null = null // 存储从服务器获取的配置
  private latency: number = 0 // 存储当前延迟
  private heartbeatInterval: NodeJS.Timeout | null = null // 心跳定时器

  constructor(private options: AgentWorkerOptions) {
    // 使用环境变量或默认的 agent ID（从数据库中获取的现有 agent）
    this.agentId = process.env.AGENT_ID || 'local-agent'
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
      
      // 启动心跳机制
      this.startHeartbeat()
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
      // 停止心跳
      this.stopHeartbeat()
    })
    
    // 处理服务器的pong响应
    this.socket.on('pong', (timestamp: number) => {
      const now = Date.now()
      this.latency = now - timestamp
      // 发送延迟信息给服务器
      this.socket.emit('agent:latency', {
        agentId: this.agentId,
        latency: this.latency
      })
    })

    this.socket.on('connect_error', (error) => {
      this.spinner.fail(chalk.red(`Connection failed: ${error.message}`))
      setTimeout(() => {
        this.spinner.start('Retrying...')
      }, 5000)
    })

    // 处理仓库准备（在会话创建时预先克隆）
    this.socket.on('repository:prepare', async (data: { sessionId: string; repository: any }) => {
      console.log(chalk.cyan(`\n📦 Preparing repository for session: ${data.sessionId}`))
      console.log(chalk.blue(`Repository: ${data.repository.name} (${data.repository.url})`))
      
      try {
        // 使用 RepositoryManager 预先克隆仓库到缓存
        const cachePath = await this.repositoryManager.ensureRepository({
          id: data.repository.id,
          name: data.repository.name,
          url: data.repository.url,
          branch: data.repository.branch,
          credentials: data.repository.credentials,
          settings: data.repository.settings
        })
        
        console.log(chalk.green(`✅ Repository cached at: ${cachePath}`))
        
        // 通知服务器仓库已准备就绪
        this.socket.emit('repository:ready', {
          sessionId: data.sessionId,
          agentId: this.agentId,
          repositoryId: data.repository.id,
          cachePath: cachePath
        })
      } catch (error) {
        console.error(chalk.red(`❌ Failed to prepare repository: ${error.message}`))
        
        // 通知服务器仓库准备失败
        this.socket.emit('repository:prepare_failed', {
          sessionId: data.sessionId,
          agentId: this.agentId,
          repositoryId: data.repository.id,
          error: error.message
        })
      }
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
      repository?: RepositoryConfig
      model?: string  // 添加模型参数
      conversationHistory?: Array<{
        role: 'human' | 'assistant'
        content: string
      }>
    }) => {
      console.log(chalk.cyan(`\n🚀 Starting Claude worker for task: ${data.taskId}`))
      console.log(chalk.yellow(`📝 sessionId: ${data.sessionId}, claudeSessionId: ${data.claudeSessionId}`))
      
      // 保存sessionId与taskId的映射关系
      if (data.sessionId) {
        this.taskSessionMap.set(data.taskId, data.sessionId)
      }
      
      try {
        // 如果有仓库信息，先确保仓库被克隆
        let workingDirectory = data.workingDirectory || process.cwd()
        
        if (data.repository) {
          console.log(chalk.blue(`📦 Ensuring repository: ${data.repository.name}`))
          try {
            // 创建工作区（会自动克隆或更新仓库）
            const workspace = await this.repositoryManager.createWorkspace(
              data.repository,
              data.taskId
            )
            workingDirectory = workspace.path
            console.log(chalk.green(`✅ Repository ready at: ${workingDirectory}`))
            
            // 保存工作区信息，以便后续清理
            this.currentWorkspace = workspace
          } catch (repoError) {
            console.error(chalk.red(`❌ Failed to setup repository: ${repoError.message}`))
            // 如果仓库克隆失败，继续使用默认目录
            console.log(chalk.yellow(`⚠️ Using default directory: ${workingDirectory}`))
          }
        }
        
        // 发送初始化进度：开始创建Worker
        this.socket.emit('worker:progress', {
          taskId: data.taskId,
          sessionId: data.sessionId,
          agentId: this.agentId,
          progress: {
            type: 'init',
            step: 'creating_worker',
            message: '正在创建 Claude Worker...',
            percentage: 20
          }
        })
        
        // 创建 Claude SDK Worker 实例
        // 优先使用 claudeSessionId（用于恢复），否则让Claude生成新的
        const worker = new ClaudeSDKWorker({
          workingDirectory: workingDirectory,  // 使用仓库的工作目录
          apiKey: data.claudeConfig?.authToken || process.env.ANTHROPIC_API_KEY,
          baseUrl: data.claudeConfig?.baseUrl,
          model: data.model || 'claude-sonnet-4-20250514',  // 使用传递的模型或默认模型
          sessionId: data.claudeSessionId || undefined,  // 使用Claude的sessionId用于恢复
          conversationHistory: data.conversationHistory
        })
        
        // 发送初始化进度：设置事件监听器
        this.socket.emit('worker:progress', {
          taskId: data.taskId,
          sessionId: data.sessionId,
          agentId: this.agentId,
          progress: {
            type: 'init',
            step: 'setting_up_listeners',
            message: '配置事件监听器...',
            percentage: 40
          }
        })
        
        // 设置事件监听器
        this.setupWorkerEventListeners(worker, data.taskId)
        
        // 在响应完成时通知任务完成
        worker.on('response-complete', () => {
          // 通知任务完成
          console.log(chalk.green(`✅ Claude worker task completed: ${data.taskId}`))
          this.socket.emit('worker:status', {
            taskId: data.taskId,
            sessionId: data.sessionId,
            agentId: this.agentId,
            status: 'completed'
          })
        })
        
        worker.on('ready', () => {
          console.log(chalk.green(`✅ Claude worker ready for task: ${data.taskId}`))
          // 发送初始化进度：Worker已就绪
          this.socket.emit('worker:progress', {
            taskId: data.taskId,
            sessionId: data.sessionId,
            agentId: this.agentId,
            progress: {
              type: 'init',
              step: 'worker_ready',
              message: '✅ Claude Worker 已就绪',
              percentage: 100
            }
          })
          this.socket.emit('worker:status', {
            taskId: data.taskId,
            sessionId: data.sessionId,
            agentId: this.agentId,
            status: 'started'
          })
        })
        
        // 监听系统初始化事件
        worker.on('system-init', (init) => {
          console.log(chalk.blue(`🎯 System initialized: sessionId=${init.sessionId}, model=${init.model}`))
          this.socket.emit('worker:message', {
            taskId: data.taskId,
            sessionId: data.sessionId,
            agentId: this.agentId,
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
            sessionId: data.sessionId,
            agentId: this.agentId,
            status: 'error',
            error: error.message
          })
        })
        
        // 发送初始化进度：启动Worker
        this.socket.emit('worker:progress', {
          taskId: data.taskId,
          sessionId: data.sessionId,
          agentId: this.agentId,
          progress: {
            type: 'init',
            step: 'spawning_worker',
            message: '正在启动 Claude Worker...',
            percentage: 60
          }
        })
        
        // 启动 Worker
        try {
          await worker.spawn()
          
          // 发送初始化进度：Worker启动成功
          this.socket.emit('worker:progress', {
            taskId: data.taskId,
            sessionId: data.sessionId,
            agentId: this.agentId,
            progress: {
              type: 'init',
              step: 'worker_spawned',
              message: '正在连接到 Claude API...',
              percentage: 80
            }
          })
          
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
    
    // 处理权限请求响应
    this.socket.on('worker:permission', async (data: {
      agentId: string
      taskId: string
      sessionId: string
      permissionId: string
      action: 'approve' | 'deny'
      modifiedInput?: any
      reason?: string
    }) => {
      console.log(chalk.blue(`📋 Permission response received: ${data.action} for ${data.permissionId}`));
      
      const worker = this.claudeWorkers.get(data.taskId);
      if (worker) {
        await worker.handlePermissionResponse(data.permissionId, data.action, data.modifiedInput, data.reason);
      }
    })

    // 处理 Worker 输入
    this.socket.on('worker:input', async (data: {
      taskId: string
      input: string
      sessionId?: string
      model?: string
      mode?: 'ask' | 'auto' | 'yolo' | 'plan'
      conversationHistory?: Array<{
        role: 'human' | 'assistant'
        content: string
      }>
    }) => {
      console.log(chalk.blue(`📝 Sending input to Claude: ${data.input.substring(0, 100)}...`))
      
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
        // 存储当前模式到 worker 实例
        if (data.mode) {
          worker.setMode(data.mode)
        }
        
        // 检查是否是用户对确认请求的回复
        const isConfirmationResponse = 
          data.input.toLowerCase() === '是' || 
          data.input.toLowerCase() === '否' || 
          data.input.toLowerCase() === 'yes' || 
          data.input.toLowerCase() === 'no' ||
          data.input.toLowerCase() === '确认' ||
          data.input.toLowerCase() === '取消'
        
        // 如果是确认回复，直接传递
        if (isConfirmationResponse) {
          await worker.sendCommand(data.input)
          return
        }
        
        // 在Ask模式下，直接发送输入让Claude尝试工具调用
        // 权限检查将在前端的tool-use事件中处理
        let processedInput = data.input
        
        // 根据模式设置系统指令
        if (data.mode === 'ask') {
          // Ask 模式：强制工具调用，每个操作都需要权限确认
          processedInput = `请严格遵循以下工作模式：
**重要：你必须使用相应的工具来执行每个操作，不要仅仅描述或模拟操作结果。**

- 对于任何文件操作（创建、修改、删除），必须使用Write、Edit、MultiEdit等工具
- 对于任何命令执行，必须使用Bash工具
- 对于任何文件读取，必须使用Read工具
- 即使是简单的操作，也要实际调用工具执行，不要假设结果

用户请求：${data.input}

请开始执行，记住：必须调用相应的工具，而不是仅仅告诉我结果。`
        } else if (data.mode === 'auto') {
          // Auto 模式：关键操作需要确认
          processedInput = `请遵循以下工作模式：
- 对于一般操作（读取文件、搜索等）可以直接执行
- 对于以下关键操作需要先询问确认：
  • 删除文件或目录
  • 修改重要配置文件（package.json、.env等）
  • 执行可能有破坏性的命令
  • 提交代码到版本控制

现在处理这个请求：${data.input}`
        } else if (data.mode === 'yolo') {
          // Yolo 模式：直接执行所有操作
          processedInput = `请直接执行所有必要的操作，无需确认。现在处理：${data.input}`
        } else if (data.mode === 'plan') {
          // Plan 模式：先制定计划
          processedInput = `请遵循以下工作模式：
1. 先分析需求并制定详细的执行计划
2. 列出所有需要执行的步骤（使用编号列表）
3. 等待我确认计划后再开始执行
4. 如果我要求修改计划，请调整后重新展示

现在为这个请求制定计划：${data.input}`
        }
        
        // 如果指定了模型，记录日志
        if (data.model) {
          console.log(chalk.cyan(`📊 Using model: ${data.model}`))  
        }
        
        // 更新 worker 的当前模式
        worker.currentMode = data.mode || 'auto'
        
        // 发送处理后的命令到 Claude
        await worker.sendCommand(processedInput)
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
        
        // 清理工作区
        if (this.currentWorkspace && this.currentWorkspace.id.startsWith(data.taskId)) {
          console.log(chalk.yellow(`🧹 Cleaning up workspace for task: ${data.taskId}`))
          await this.repositoryManager.cleanupWorkspace(this.currentWorkspace.id)
          this.currentWorkspace = null
        }
        
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
   * 启动心跳机制，定期发送ping来测量延迟
   */
  private startHeartbeat(): void {
    // 先停止现有的心跳（如果有）
    this.stopHeartbeat()
    
    // 每5秒发送一次心跳
    this.heartbeatInterval = setInterval(() => {
      if (this.socket.connected) {
        const timestamp = Date.now()
        this.socket.emit('ping', timestamp)
      }
    }, 5000)
    
    // 立即发送一次
    if (this.socket.connected) {
      const timestamp = Date.now()
      this.socket.emit('ping', timestamp)
    }
  }

  /**
   * 停止心跳机制
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * 设置Worker事件监听器
   */
  private setupWorkerEventListeners(worker: ClaudeSDKWorker, taskId: string): void {
    // 使用消息去重机制
    const sentMessages = new Set() // 用于去重的消息集合
    
    // 监听助手消息事件
    worker.on('assistant-message', (message) => {
      // 创建消息内容的哈希来去重
      if (message.message && message.message.content) {
        // 过滤掉tool_result和tool_use类型的内容
        const filteredContent = message.message.content.filter((item: any) => 
          item.type === 'text' || item.type === 'thinking'
        )
        
        const textContent = filteredContent
          .filter((item: any) => item.type === 'text' && item.text)
          .map((item: any) => item.text)
          .join('')
        
        if (textContent.trim()) {
          const messageHash = Buffer.from(textContent.trim()).toString('base64').substring(0, 32)
          
          if (!sentMessages.has(messageHash)) {
            console.log(`Sending unique assistant message (hash: ${messageHash}):`, textContent.substring(0, 100) + '...')
            
            // 创建清理后的消息对象，只包含文本内容
            const cleanedMessage = {
              ...message,
              message: {
                ...message.message,
                content: filteredContent
              }
            }
            
            this.socket.emit('worker:message', {
              agentId: this.agentId,
              taskId: taskId,
              sessionId: this.taskSessionMap.get(taskId), // 添加sessionId
              message: cleanedMessage  // 发送清理后的消息
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
      const currentMode = worker.currentMode
      
      // 检查是否需要权限确认
      const needsPermission = this.checkIfToolNeedsPermission(toolData, currentMode)
      
      this.socket.emit('worker:tool-use', {
        agentId: this.agentId,
        taskId: taskId,
        sessionId: this.taskSessionMap.get(taskId), // 添加sessionId
        toolUse: {
          ...toolData,
          requiresPermission: needsPermission,
          mode: currentMode
        }
      })
    })
    
    // 监听工具结果事件
    worker.on('tool-result', (_toolResult) => {
      // 不发送原始的工具结果到前端，避免显示JSON
      // 工具结果会通过 assistant-message 事件以格式化的方式发送
      console.log(`Tool result received, will be formatted in assistant message`)
    })
    
    // 监听普通文本输出事件
    worker.on('output', (content) => {
      console.log(`Text output:`, content)
      const sessionId = worker.getSessionId()
      
      // 创建一个类似 assistant-message 的消息格式
      const assistantMessage = {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: content }],
          role: 'assistant'
        },
        sessionId: sessionId
      }
      
      // 发送为 worker:message 事件
      this.socket.emit('worker:message', {
        agentId: this.agentId,
        taskId: taskId,
        sessionId: this.taskSessionMap.get(taskId) || sessionId,
        message: assistantMessage
      })
    })
    
    // 监听系统消息（包含 token 信息）
    worker.on('system-info', (info) => {
      console.log(`System info:`, info)
      this.socket.emit('worker:system-info', {
        agentId: this.agentId,
        taskId: taskId,
        sessionId: this.taskSessionMap.get(taskId), // 添加sessionId
        info
      })
    })
    
    // 监听处理进度
    worker.on('progress', (progress) => {
      console.log(`Processing progress:`, progress)
      this.socket.emit('worker:progress', {
        agentId: this.agentId,
        taskId: taskId,
        sessionId: this.taskSessionMap.get(taskId), // 添加sessionId
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

  /**
   * 检查工具是否需要权限确认
   */
  private checkIfToolNeedsPermission(toolData: any, mode: string): boolean {
    if (mode === 'yolo') {
      // Yolo模式不需要任何权限
      return false
    }
    
    if (mode === 'ask') {
      // Ask模式所有工具都需要权限
      return true
    }
    
    if (mode === 'auto') {
      // Auto模式只有危险操作需要权限
      return this.isDangerousOperation(toolData)
    }
    
    if (mode === 'plan') {
      // Plan模式在执行阶段需要权限
      return this.isPlanExecutionTool(toolData)
    }
    
    return false
  }
  
  /**
   * 判断是否是危险操作
   */
  private isDangerousOperation(toolData: any): boolean {
    const toolName = toolData.name
    const input = toolData.input
    
    // 删除文件
    if (toolName === 'Bash' && input?.command) {
      const cmd = input.command.toLowerCase()
      if (cmd.includes('rm ') || cmd.includes('del ') || cmd.includes('rmdir ')) {
        return true
      }
    }
    
    // 修改重要配置文件
    if ((toolName === 'Edit' || toolName === 'Write') && input?.file_path) {
      const filePath = input.file_path.toLowerCase()
      if (filePath.includes('package.json') || filePath.includes('.env') || 
          filePath.includes('config') || filePath.includes('.gitignore')) {
        return true
      }
    }
    
    // Git提交操作
    if (toolName === 'Bash' && input?.command) {
      const cmd = input.command.toLowerCase()
      if (cmd.includes('git commit') || cmd.includes('git push')) {
        return true
      }
    }
    
    return false
  }
  
  /**
   * 判断是否是计划执行工具
   */
  private isPlanExecutionTool(toolData: any): boolean {
    const toolName = toolData.name
    
    // Plan模式下，除了读取类操作，其他都需要确认
    const readOnlyTools = ['Read', 'Grep', 'Glob', 'LS', 'WebFetch']
    return !readOnlyTools.includes(toolName)
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
    
    // 停止心跳
    this.stopHeartbeat()
    
    // 清理所有 Claude workers
    for (const [taskId, worker] of this.claudeWorkers) {
      try {
        await worker.shutdown()
        console.log(chalk.yellow(`🛑 Shutdown worker for task: ${taskId}`))
      } catch (error) {
        console.error(chalk.red(`❌ Failed to shutdown worker ${taskId}: ${error.message}`))
      }
    }
    this.claudeWorkers.clear()
    
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