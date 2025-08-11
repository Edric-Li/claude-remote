import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import chalk from 'chalk'
import ora from 'ora'
import * as readline from 'node:readline'

interface AgentOptions {
  serverUrl: string
  name: string
}

export async function startAgent(options: AgentOptions): Promise<void> {
  const agentId = uuidv4()
  const spinner = ora('Connecting to server...').start()

  const socket: Socket = io(options.serverUrl, {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 5000
  })

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  // State to track if we should show the reply prompt
  let showReplyPrompt = false

  socket.on('connect', () => {
    spinner.succeed(chalk.green('Connected to server'))
    console.log(chalk.blue(`Agent ID: ${agentId}`))
    console.log(chalk.blue(`Agent Name: ${options.name}`))

    // Register agent
    socket.emit('agent:register', {
      agentId,
      name: options.name
    })

    console.log(chalk.yellow('\nAgent is ready to receive messages from server'))
    console.log(chalk.gray('After receiving a message, type your reply and press Enter\n'))
  })

  socket.on('disconnect', () => {
    console.log(chalk.red('\n❌ Disconnected from server'))
    spinner.start('Reconnecting...')
  })

  socket.on('connect_error', error => {
    spinner.fail(chalk.red(`Connection failed: ${error.message}`))
    setTimeout(() => {
      spinner.start('Retrying...')
    }, 5000)
  })

  // Handle incoming chat messages
  socket.on('chat:message', data => {
    console.log(chalk.cyan(`\n📨 [${new Date().toLocaleTimeString()}] Web:`) + ` ${data.content}`)
    console.log(chalk.yellow('💬 Reply: '))
    showReplyPrompt = true
  })

  // Setup input handler immediately
  rl.on('line', input => {
    const text = input.trim()

    // Skip empty input
    if (!text) {
      return
    }

    // If we're expecting a reply, send it
    if (showReplyPrompt) {
      socket.emit('chat:reply', {
        agentId,
        content: text
      })

      console.log(chalk.green('✅ Reply sent'))
      showReplyPrompt = false
    } else {
      // Handle commands when not replying
      if (text === 'status') {
        console.log(chalk.blue('\n📊 Status:'))
        console.log(`Connected: ${socket.connected}`)
        console.log(`Agent ID: ${agentId}`)
        console.log(`Agent Name: ${options.name}\n`)
      } else {
        console.log(chalk.gray('💡 Waiting for a message from Web to reply to...'))
      }
    }
  })

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nShutting down agent...'))
    socket.disconnect()
    rl.close()
    process.exit(0)
  })
}
