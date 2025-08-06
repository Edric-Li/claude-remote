import { ClaudeManager } from './claude-manager.js'
import chalk from 'chalk'

console.log(chalk.blue('Testing Claude with JSONL output...\n'))

const manager = new ClaudeManager()
const taskId = 'test-' + Date.now()

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

// Start Claude with a simple prompt
console.log(chalk.blue('Starting Claude with prompt: "Hello, what is 2+2?"'))
manager.startClaude(taskId, process.cwd(), 'Hello, what is 2+2?')

// Handle process exit
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\nShutting down...'))
  manager.stopAll()
  process.exit(0)
})