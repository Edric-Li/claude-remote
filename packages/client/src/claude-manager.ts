import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import chalk from 'chalk'
import { JsonLinesParser } from './json-lines-parser.js'

interface ClaudeTask {
  taskId: string
  process: ChildProcess
  workingDirectory?: string
  parser: JsonLinesParser
}

interface StreamEvent {
  type: string
  content?: string
  [key: string]: any
}

export class ClaudeManager extends EventEmitter {
  private tasks = new Map<string, ClaudeTask>()
  private useSimulator = process.env.USE_CLAUDE_SIMULATOR === 'true'
  
  startClaude(taskId: string, workingDirectory?: string, initialPrompt?: string): void {
    console.log(chalk.blue(`\n🚀 Starting Claude for task ${taskId}`))
    
    // Check if task already exists
    if (this.tasks.has(taskId)) {
      console.log(chalk.yellow('Claude already running for this task'))
      return
    }
    
    try {
      let command: string
      let args: string[]
      
      if (this.useSimulator) {
        // Use simulator for testing
        console.log(chalk.yellow('⚠️  Using Claude Simulator for testing'))
        command = 'npx'
        args = ['tsx', 'src/claude-simulator.ts']
      } else {
        // Use real Claude CLI with print mode and streaming JSON
        command = 'claude'
        args = []
        
        // Use print mode with streaming JSON
        args.push(
          '--print',
          '--output-format', 'stream-json',
          '--input-format', 'stream-json',
          '--verbose'
        )
        
        // Optional: Add debug mode for more info
        if (process.env.CLAUDE_DEBUG === 'true') {
          args.push('--debug')
        }
      }
      
      console.log(chalk.gray(`Command: ${command} ${args.join(' ')}`))
      
      // Spawn process with pipe stdio for programmatic control
      const claudeProcess = spawn(command, args, {
        cwd: workingDirectory || process.cwd(),
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'], // All piped for full control
        env: {
          ...process.env,
          CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
        }
      })
      
      if (!claudeProcess.pid) {
        throw new Error('Failed to spawn Claude process - no PID assigned')
      }
      
      console.log(chalk.green(`✅ Claude process started (PID: ${claudeProcess.pid})`))
      
      // Send initial prompt if provided (as JSON for stream-json input format)
      if (initialPrompt && claudeProcess.stdin) {
        const message = {
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'text',
                text: initialPrompt
              }
            ]
          }
        }
        claudeProcess.stdin.write(JSON.stringify(message) + '\n')
        console.log(chalk.gray(`Sent initial prompt: ${initialPrompt}`))
        
        // DO NOT close stdin - keep it open for interactive conversation
        // Claude in --print mode will stay alive waiting for more input
      }
      // Keep stdin open even without initial prompt for interactive mode
      
      // Create JSONL parser
      const parser = new JsonLinesParser()
      
      // Store task
      this.tasks.set(taskId, {
        taskId,
        process: claudeProcess,
        workingDirectory,
        parser
      })
      
      this.setupProcessHandlers(taskId, claudeProcess, parser)
      
    } catch (error) {
      console.log(chalk.red(`Failed to start Claude: ${(error as Error).message}`))
      this.emit('status', {
        taskId,
        status: 'error',
        error: (error as Error).message
      })
    }
  }
  
  private setupProcessHandlers(taskId: string, claudeProcess: ChildProcess, parser: JsonLinesParser): void {
    // Handle stdout - add raw data logging for debugging
    if (claudeProcess.stdout) {
      claudeProcess.stdout.setEncoding('utf8')
      
      // Log raw output for debugging (only if debug mode is enabled)
      if (process.env.CLAUDE_DEBUG === 'true') {
        claudeProcess.stdout.on('data', (chunk) => {
          console.log(chalk.gray('[RAW STDOUT]'), chunk.toString().trim())
        })
      }
      
      // Also pipe to parser for JSONL handling
      claudeProcess.stdout.pipe(parser)
      
      // Handle parsed JSONL messages from Claude
      parser.on('data', (message: StreamEvent) => {
        // Always emit the message for web UI processing
        this.emit('claude-message', {
          taskId,
          message
        })
        
        // Handle different message types for console display
        if (message.type === 'system' && message.subtype === 'init') {
          // Log initialization
          console.log(chalk.blue('🚀 Claude initialized'))
          console.log(chalk.gray(`  Model: ${message.model}`))
          console.log(chalk.gray(`  Tools: ${message.tools?.length || 0} available`))
        } else if (message.type === 'assistant' && message.message?.content) {
          // Handle assistant messages
          for (const contentItem of message.message.content) {
            if (contentItem.type === 'text' && contentItem.text?.trim()) {
              console.log(chalk.cyan('💬 Claude:'), contentItem.text)
            } else if (contentItem.type === 'tool_use') {
              console.log(chalk.yellow(`🔧 Using tool: ${contentItem.name}`))
              if (contentItem.input) {
                console.log(chalk.gray(`   Input: ${JSON.stringify(contentItem.input).substring(0, 100)}...`))
              }
            }
          }
          
          // Show token usage if available
          if (message.message.usage) {
            const usage = message.message.usage
            console.log(chalk.gray(`   [Tokens: in=${usage.input_tokens}, out=${usage.output_tokens}]`))
          }
        } else if (message.type === 'user' && message.message?.content) {
          // Handle tool results
          for (const contentItem of message.message.content) {
            if (contentItem.type === 'tool_result') {
              console.log(chalk.green(`✅ Tool result received`))
              const preview = contentItem.content?.substring(0, 100) || ''
              if (preview.length < (contentItem.content?.length || 0)) {
                console.log(chalk.gray(`   ${preview}...`))
              }
            }
          }
        } else if (message.type === 'result') {
          // Handle result messages with detailed stats
          console.log(chalk.blue('\n📊 Task Summary:'))
          console.log(chalk.green(`   Status: ${message.subtype === 'success' ? '✅ Success' : '❌ Error'}`))
          console.log(chalk.gray(`   Duration: ${message.duration_ms}ms`))
          console.log(chalk.gray(`   API Time: ${message.duration_api_ms}ms`))
          console.log(chalk.gray(`   Turns: ${message.num_turns}`))
          if (message.usage) {
            console.log(chalk.yellow(`   Total tokens: ${message.usage.input_tokens + message.usage.output_tokens}`))
            console.log(chalk.cyan(`   Cost: $${message.total_cost_usd?.toFixed(6) || '0'}`))
          }
        }
      })
      
      parser.on('error', (error) => {
        console.log(chalk.red('Parser error:'), error.message)
        this.emit('output', {
          taskId,
          output: `Parser error: ${error.message}`,
          outputType: 'stderr'
        })
      })
    }
    
    // Handle stderr
    if (claudeProcess.stderr) {
      claudeProcess.stderr.setEncoding('utf8')
      claudeProcess.stderr.on('data', (data) => {
        const output = data.toString()
        console.log(chalk.red('[Claude Error]'), output)
        this.emit('output', {
          taskId,
          output,
          outputType: 'stderr'
        })
      })
    }
    
    // Handle process exit
    claudeProcess.on('exit', (code, signal) => {
      console.log(chalk.yellow(`\nClaude process exited with code ${code}`))
      this.tasks.delete(taskId)
      this.emit('status', {
        taskId,
        status: 'stopped',
        exitCode: code
      })
    })
    
    // Handle process error
    claudeProcess.on('error', (error) => {
      console.log(chalk.red(`\nClaude process error: ${error.message}`))
      this.tasks.delete(taskId)
      this.emit('status', {
        taskId,
        status: 'error',
        error: error.message
      })
    })
    
    // Emit started status
    this.emit('status', {
      taskId,
      status: 'started'
    })
    
    console.log(chalk.green('✅ Claude process handlers set up'))
  }
  
  sendInput(taskId: string, input: string): void {
    const task = this.tasks.get(taskId)
    if (!task) {
      console.log(chalk.red(`No Claude process found for task ${taskId}`))
      return
    }
    
    // Send input to the existing Claude process
    if (task.process.stdin && !task.process.stdin.destroyed) {
      const message = {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'text',
              text: input
            }
          ]
        }
      }
      task.process.stdin.write(JSON.stringify(message) + '\n')
      console.log(chalk.gray(`Sent input to Claude: ${input}`))
    } else {
      console.log(chalk.red('Claude process stdin is not available'))
    }
  }
  
  stopClaude(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) {
      console.log(chalk.red(`No Claude process found for task ${taskId}`))
      return
    }
    
    console.log(chalk.yellow(`Stopping Claude for task ${taskId}`))
    task.process.kill()
    this.tasks.delete(taskId)
  }
  
  stopAll(): void {
    console.log(chalk.yellow('Stopping all Claude processes'))
    for (const [taskId, task] of this.tasks) {
      task.process.kill()
    }
    this.tasks.clear()
  }
}