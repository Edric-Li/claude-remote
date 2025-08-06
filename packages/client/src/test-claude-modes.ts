import { ClaudeManager } from './claude-manager.js'
import chalk from 'chalk'

console.log(chalk.blue('Testing Claude in different modes...\n'))

const manager = new ClaudeManager()

// Set up event handlers
manager.on('claude-message', ({ taskId, message }) => {
  console.log(chalk.magenta('\n📨 Claude Message:'))
  console.log(JSON.stringify(message, null, 2))
})

manager.on('output', ({ taskId, output, outputType }) => {
  if (outputType === 'stdout') {
    console.log(chalk.green(`[Output] ${output}`))
  } else {
    console.log(chalk.red(`[Error] ${output}`))
  }
})

manager.on('status', ({ taskId, status, error, exitCode }) => {
  console.log(chalk.yellow(`\n📊 Status: ${status}`))
  if (error) console.log(chalk.red(`Error: ${error}`))
  if (exitCode !== undefined) console.log(chalk.gray(`Exit code: ${exitCode}`))
})

// Test 1: With initial prompt (print mode)
console.log(chalk.blue('Test 1: Starting Claude with initial prompt'))
const task1 = 'test-with-prompt-' + Date.now()
manager.startClaude(task1, process.cwd(), 'What is the capital of France?')

// Wait a bit then test without prompt
setTimeout(() => {
  console.log(chalk.blue('\n\nTest 2: Starting Claude without initial prompt (interactive mode)'))
  const task2 = 'test-without-prompt-' + Date.now()
  manager.startClaude(task2, process.cwd())
  
  console.log(chalk.gray('\nNote: Interactive mode Claude is waiting for input from terminal'))
  console.log(chalk.gray('Type your question and press Enter in the Claude prompt'))
}, 8000)

// Handle process exit
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nShutting down...'))
  manager.stopAll()
  process.exit(0)
})