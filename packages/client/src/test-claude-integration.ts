#!/usr/bin/env node
/**
 * 测试 Claude Code 集成
 * 使用 --print 模式进行简单测试
 */

import { spawn } from 'child_process'
import chalk from 'chalk'

console.log(chalk.blue('🔍 Testing Claude Code Integration\n'))

// Test 1: Simple print mode test
console.log(chalk.yellow('Test 1: Using --print mode for simple query...'))

const claudeProcess = spawn('claude', [
  '--print',
  '--output-format', 'stream-json',
  'What is 2+2? Just answer with the number.'
], {
  stdio: ['pipe', 'pipe', 'pipe']
})

console.log(chalk.green(`✅ Process started (PID: ${claudeProcess.pid})`))

let outputBuffer = ''

// Handle stdout
claudeProcess.stdout.on('data', (data) => {
  const output = data.toString()
  outputBuffer += output
  
  // Try to parse each line as JSON
  const lines = output.split('\n').filter(line => line.trim())
  for (const line of lines) {
    try {
      const json = JSON.parse(line)
      console.log(chalk.cyan('[PARSED JSON]:'), json)
      
      // Extract and display assistant messages
      if (json.type === 'assistant' && json.message?.content) {
        const content = json.message.content[0]?.text || ''
        console.log(chalk.green('🤖 Claude says:'), content)
      }
    } catch (e) {
      // Not JSON, display as raw
      if (line.trim()) {
        console.log(chalk.gray('[RAW]:'), line)
      }
    }
  }
})

// Handle stderr
claudeProcess.stderr.on('data', (data) => {
  console.log(chalk.red('[STDERR]:'), data.toString())
})

// Handle exit
claudeProcess.on('exit', (code, signal) => {
  console.log(chalk.yellow(`\nProcess exited with code ${code}, signal ${signal}`))
  
  // Test 2: Interactive mode test
  console.log(chalk.yellow('\nTest 2: Interactive mode test...'))
  testInteractiveMode()
})

function testInteractiveMode() {
  console.log(chalk.blue('Starting interactive Claude...'))
  
  const interactiveProcess = spawn('claude', [
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--verbose'
  ], {
    stdio: ['pipe', 'pipe', 'pipe']
  })
  
  console.log(chalk.green(`✅ Interactive process started (PID: ${interactiveProcess.pid})`))
  
  // Handle stdout
  interactiveProcess.stdout.on('data', (data) => {
    const output = data.toString()
    const lines = output.split('\n').filter(line => line.trim())
    
    for (const line of lines) {
      try {
        const json = JSON.parse(line)
        console.log(chalk.cyan('[INTERACTIVE JSON]:'), {
          type: json.type,
          hasContent: !!json.content || !!json.message?.content
        })
        
        if (json.type === 'assistant' && json.message?.content) {
          const content = json.message.content[0]?.text || ''
          console.log(chalk.green('🤖 Response:'), content.substring(0, 100) + '...')
        }
      } catch (e) {
        if (line.trim()) {
          console.log(chalk.gray('[INTERACTIVE RAW]:'), line.substring(0, 100))
        }
      }
    }
  })
  
  // Handle stderr
  interactiveProcess.stderr.on('data', (data) => {
    console.log(chalk.red('[INTERACTIVE STDERR]:'), data.toString())
  })
  
  // Send initial message
  setTimeout(() => {
    console.log(chalk.blue('\nSending test message...'))
    const message = {
      type: 'user',
      content: 'Hello Claude, what is 2+2?'
    }
    interactiveProcess.stdin.write(JSON.stringify(message) + '\n')
    
    // Send another message after delay
    setTimeout(() => {
      console.log(chalk.blue('\nSending second message...'))
      const message2 = {
        type: 'user', 
        content: 'Thank you!'
      }
      interactiveProcess.stdin.write(JSON.stringify(message2) + '\n')
      
      // Close after another delay
      setTimeout(() => {
        console.log(chalk.yellow('\nClosing interactive session...'))
        interactiveProcess.stdin.end()
        
        setTimeout(() => {
          interactiveProcess.kill()
          process.exit(0)
        }, 2000)
      }, 3000)
    }, 3000)
  }, 1000)
}