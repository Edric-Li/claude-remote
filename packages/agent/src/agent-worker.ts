import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import chalk from 'chalk'
import ora from 'ora'
import * as readline from 'node:readline'
import { RepositoryManager, RepositoryConfig, WorkspaceInfo } from './services/repository-manager'
import { spawn } from 'child_process'
import * as path from 'path'

interface AgentWorkerOptions {
  serverUrl: string
  name: string
  token?: string
  capabilities?: string[]
}

interface TaskAssignment {
  taskId: string
  repository: RepositoryConfig
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

  constructor(private options: AgentWorkerOptions) {
    this.agentId = uuidv4()
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
    // 注册 worker
    this.socket.emit('worker:register', {
      workerId: this.agentId,
      agentId: this.agentId,
      name: this.options.name,
      capabilities: this.options.capabilities || ['claude-code', 'cursor', 'qucoder'],
      status: 'idle'
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