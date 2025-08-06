#!/usr/bin/env node
/**
 * Claude Simulator - 模拟 Claude API 响应用于测试
 * 这个脚本模拟 Claude CLI 的行为，用于开发和测试
 */

import { EventEmitter } from 'events'
import chalk from 'chalk'

export class ClaudeSimulator extends EventEmitter {
  private isRunning = false
  
  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    
    console.log(chalk.blue('🤖 Claude Simulator started'))
    
    // 模拟初始化消息
    setTimeout(() => {
      this.emit('message', {
        type: 'system',
        subtype: 'init',
        session_id: `sim-${Date.now()}`,
        timestamp: new Date().toISOString()
      })
    }, 100)
  }
  
  sendInput(input: string): void {
    if (!this.isRunning) {
      console.log(chalk.red('Simulator not running'))
      return
    }
    
    console.log(chalk.gray(`Simulator received: ${input}`))
    
    // 模拟处理延迟
    setTimeout(() => {
      // 生成模拟响应
      const response = this.generateResponse(input)
      
      // 发送助手消息
      this.emit('message', {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'text',
              text: response
            }
          ]
        },
        timestamp: new Date().toISOString()
      })
      
      // 发送完成消息
      setTimeout(() => {
        this.emit('message', {
          type: 'result',
          status: 'success',
          total_cost_usd: 0.001,
          timestamp: new Date().toISOString()
        })
      }, 100)
    }, 1000)
  }
  
  private generateResponse(input: string): string {
    // 简单的响应生成逻辑
    const lowerInput = input.toLowerCase()
    
    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return 'Hello! I am Claude Simulator. How can I help you today?'
    }
    
    if (lowerInput.includes('2+2') || lowerInput.includes('2 + 2')) {
      return '2 + 2 = 4'
    }
    
    if (lowerInput.includes('test')) {
      return 'Test successful! The simulator is working correctly.'
    }
    
    if (lowerInput.includes('help')) {
      return 'I am a Claude simulator for testing. I can respond to basic queries. Try asking me simple questions!'
    }
    
    // 默认响应
    return `I received your message: "${input}". This is a simulated response from the Claude simulator.`
  }
  
  stop(): void {
    if (!this.isRunning) return
    this.isRunning = false
    
    this.emit('message', {
      type: 'system',
      subtype: 'shutdown',
      timestamp: new Date().toISOString()
    })
    
    console.log(chalk.yellow('🛑 Claude Simulator stopped'))
  }
}

// 如果直接运行此文件，启动交互式模式
if (require.main === module) {
  const simulator = new ClaudeSimulator()
  const readline = require('readline')
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  simulator.on('message', (message) => {
    console.log(chalk.cyan('📤 Output:'), JSON.stringify(message, null, 2))
  })
  
  simulator.start()
  
  console.log(chalk.green('\n📝 Claude Simulator Interactive Mode'))
  console.log(chalk.gray('Type messages to simulate Claude responses. Type "exit" to quit.\n'))
  
  rl.on('line', (input: string) => {
    if (input.toLowerCase() === 'exit') {
      simulator.stop()
      rl.close()
      process.exit(0)
    }
    
    simulator.sendInput(input)
  })
  
  process.on('SIGINT', () => {
    simulator.stop()
    rl.close()
    process.exit(0)
  })
}