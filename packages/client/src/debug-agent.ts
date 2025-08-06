#!/usr/bin/env node
import { io } from 'socket.io-client'
import * as readline from 'node:readline'
import chalk from 'chalk'

console.log(chalk.blue('🔍 Debug Agent - Detailed Logging\n'))

const agentId = 'debug-agent-' + Date.now()
const serverUrl = 'http://localhost:3000'

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
    name: 'Debug Agent'
  }, (response: any) => {
    console.log(chalk.gray('Registration response:', response))
  })
  
  console.log(chalk.cyan('\n📋 Instructions:'))
  console.log('1. Send message from Web')
  console.log('2. Type reply and press Enter')
  console.log('3. Or type "ping" to test connection\n')
})

socket.on('disconnect', (reason) => {
  console.log(chalk.red(`❌ Disconnected: ${reason}`))
})

socket.on('connect_error', (error) => {
  console.log(chalk.red(`Connection error: ${error.message}`))
})

// Message handling
socket.on('chat:message', (data) => {
  console.log(chalk.green('\n📨 Message received!'))
  console.log(chalk.gray('Raw data:'), JSON.stringify(data, null, 2))
  console.log(chalk.cyan(`Content: ${data.content}`))
  console.log(chalk.yellow('\n💬 Type your reply:'))
})

// Input handling
console.log(chalk.gray('Readline ready, listening for input...'))

rl.on('line', (input) => {
  const text = input.trim()
  
  if (!text) {
    console.log(chalk.gray('(empty input, ignoring)'))
    return
  }
  
  console.log(chalk.gray(`\nYou typed: "${text}"`))
  
  if (text === 'ping') {
    console.log(chalk.yellow('Testing socket connection...'))
    if (socket.connected) {
      console.log(chalk.green('Socket is connected ✓'))
      socket.emit('ping', Date.now())
    } else {
      console.log(chalk.red('Socket is NOT connected ✗'))
    }
    return
  }
  
  if (text === 'status') {
    console.log(chalk.blue('\n📊 Status:'))
    console.log(`Connected: ${socket.connected}`)
    console.log(`Socket ID: ${socket.id}`)
    console.log(`Agent ID: ${agentId}`)
    return
  }
  
  // Send reply
  console.log(chalk.yellow('\n📤 Sending reply...'))
  console.log(chalk.gray('Payload:'), {
    agentId,
    content: text
  })
  
  try {
    socket.emit('chat:reply', {
      agentId,
      content: text
    }, (ack: any) => {
      console.log(chalk.gray('Server acknowledgment:'), ack)
    })
    
    console.log(chalk.green('✅ Reply sent successfully!'))
    console.log(chalk.gray(`Sent at: ${new Date().toISOString()}`))
  } catch (error) {
    console.log(chalk.red('❌ Error sending reply:'), error)
  }
})

// Socket event monitoring
socket.onAny((eventName, ...args) => {
  if (eventName !== 'ping' && eventName !== 'pong') {
    console.log(chalk.magenta(`\n🔔 Socket event: ${eventName}`))
    console.log(chalk.gray('Args:'), args)
  }
})

// Error handling
rl.on('error', (error) => {
  console.log(chalk.red('Readline error:'), error)
})

process.on('uncaughtException', (error) => {
  console.log(chalk.red('Uncaught exception:'), error)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nShutting down...'))
  socket.disconnect()
  rl.close()
  process.exit(0)
})

console.log(chalk.blue('\n🚀 Debug Agent ready!'))