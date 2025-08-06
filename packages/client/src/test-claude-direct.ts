#!/usr/bin/env node
import { spawn } from 'child_process'
import chalk from 'chalk'

console.log(chalk.blue('🔍 Testing Claude CLI directly\n'))

// Test 1: Check if claude is available
console.log(chalk.yellow('Test 1: Checking claude command...'))
const checkClaude = spawn('which', ['claude'])
checkClaude.stdout.on('data', (data) => {
  console.log(chalk.green(`✅ Claude found at: ${data.toString().trim()}`))
})
checkClaude.stderr.on('data', (data) => {
  console.log(chalk.red(`❌ Error: ${data}`))
})

// Test 2: Try running claude with minimal options
setTimeout(() => {
  console.log(chalk.yellow('\nTest 2: Running claude with minimal options...'))
  
  const claudeProcess = spawn('claude', [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      CLAUDE_MODEL: 'claude-3-5-sonnet-20241022'
    }
  })
  
  console.log(chalk.green(`✅ Claude process started (PID: ${claudeProcess.pid})`))
  
  // Handle stdout
  claudeProcess.stdout.on('data', (data) => {
    console.log(chalk.cyan('[STDOUT]:'), data.toString())
  })
  
  // Handle stderr
  claudeProcess.stderr.on('data', (data) => {
    console.log(chalk.red('[STDERR]:'), data.toString())
  })
  
  // Handle exit
  claudeProcess.on('exit', (code, signal) => {
    console.log(chalk.yellow(`\nClaude exited with code ${code}, signal ${signal}`))
  })
  
  // Send initial input after a delay
  setTimeout(() => {
    console.log(chalk.blue('\nSending test input: "What is 2+2?"'))
    claudeProcess.stdin.write('What is 2+2?\n')
    
    // Close stdin after another delay to trigger response
    setTimeout(() => {
      console.log(chalk.gray('Closing stdin to trigger response...'))
      claudeProcess.stdin.end()
    }, 1000)
  }, 1000)
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log(chalk.yellow('\nTimeout reached, killing process...'))
    claudeProcess.kill()
    process.exit(0)
  }, 10000)
}, 1000)