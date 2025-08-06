#!/usr/bin/env node
import { io } from 'socket.io-client'
import * as readline from 'node:readline'
import chalk from 'chalk'
import { ClaudeManager } from './claude-manager.js'

console.log(chalk.blue('🔍 Claude-Remote Agent with Claude Integration\n'))

const agentId = 'claude-agent-' + Date.now()
const serverUrl = 'http://localhost:3000'
const claudeManager = new ClaudeManager()

console.log(chalk.gray(`Connecting to ${serverUrl}...`))
const socket = io(serverUrl, {
  transports: ['websocket'],
  reconnection: true
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// Connection events
socket.on('connect', () => {
  console.log(chalk.green('✅ Socket connected!'))
  console.log(chalk.gray(`Socket ID: ${socket.id}`))
  
  console.log(chalk.yellow('\nRegistering agent...'))
  socket.emit('agent:register', {
    agentId,
    name: 'Claude Agent'
  })
  
  console.log(chalk.cyan('\n📋 Features:'))
  console.log('- Receives chat messages')
  console.log('- Can start Claude processes')
  console.log('- Forwards Claude output to Web')
  console.log('\nCommands: status | ping | stop\n')
})

// Chat message handling
socket.on('chat:message', (data) => {
  console.log(chalk.green('\n📨 Chat message received!'))
  console.log(chalk.cyan(`Content: ${data.content}`))
  console.log(chalk.yellow('\n💬 Type your reply:'))
})

// Claude control messages
socket.on('claude:start', (data) => {
  console.log(chalk.blue('\n🎯 Received Claude start command'))
  console.log(chalk.gray('Task ID:', data.taskId))
  console.log(chalk.gray('Working Directory:', data.workingDirectory || 'current'))
  console.log(chalk.gray('Initial Prompt:', data.initialPrompt || 'none'))
  
  claudeManager.startClaude(data.taskId, data.workingDirectory, data.initialPrompt)
})

socket.on('claude:input', (data) => {
  console.log(chalk.cyan(`\n📝 Received input for Claude: ${data.input}`))
  claudeManager.sendInput(data.taskId, data.input)
})

socket.on('claude:stop', (data) => {
  console.log(chalk.yellow(`\n🛑 Stopping Claude for task ${data.taskId}`))
  claudeManager.stopClaude(data.taskId)
})

// Claude manager events
// Output event removed - all messages now handled through claude-message event

claudeManager.on('claude-message', (data) => {
  // Forward structured Claude messages to server
  socket.emit('claude:message', {
    taskId: data.taskId,
    message: data.message
  })
  
  // Log specific message types
  const { message } = data
  if (message.type === 'system' && message.subtype === 'init') {
    console.log(chalk.blue(`\n📋 Claude initialized - Session: ${message.session_id}`))
  } else if (message.type === 'assistant' && message.message?.content) {
    const content = message.message.content[0]?.text || ''
    console.log(chalk.cyan(`\n🤖 Claude says: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`))
  } else if (message.type === 'result') {
    console.log(chalk.green(`\n✅ Task completed - Cost: $${message.total_cost_usd || 0}`))
  }
})

claudeManager.on('status', (data) => {
  console.log(chalk.magenta(`\n📊 Claude status: ${data.status}`))
  socket.emit('claude:status', data)
})

// Input handling
rl.on('line', (input) => {
  const text = input.trim()
  
  if (!text) return
  
  // Handle commands
  switch (text) {
    case 'status':
      console.log(chalk.blue('\n📊 Status:'))
      console.log(`Connected: ${socket.connected}`)
      console.log(`Agent ID: ${agentId}`)
      break
      
    case 'ping':
      if (socket.connected) {
        console.log(chalk.green('Socket is connected ✓'))
      } else {
        console.log(chalk.red('Socket is NOT connected ✗'))
      }
      break
      
    case 'stop':
      console.log(chalk.yellow('Stopping all Claude processes...'))
      claudeManager.stopAll()
      break
      
    default:
      // Send as chat reply
      console.log(chalk.yellow('\n📤 Sending reply...'))
      socket.emit('chat:reply', {
        agentId,
        content: text
      })
      console.log(chalk.green('✅ Reply sent'))
  }
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nShutting down...'))
  claudeManager.stopAll()
  socket.disconnect()
  rl.close()
  process.exit(0)
})

console.log(chalk.blue('\n🚀 Agent ready!'))