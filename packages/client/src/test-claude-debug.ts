import { spawn } from 'child_process'
import { JsonLinesParser } from './json-lines-parser.js'
import chalk from 'chalk'

console.log(chalk.blue('Testing Claude with detailed debugging...\n'))

const args = ['-p', 'What is 2+2?', '--output-format', 'stream-json', '--verbose']
console.log(chalk.gray(`Command: claude ${args.join(' ')}`))

const claudeProcess = spawn('claude', args, {
  cwd: process.cwd(),
  shell: false,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
})

console.log(chalk.green(`Process started with PID: ${claudeProcess.pid}`))

// Create parser
const parser = new JsonLinesParser()

// Set encoding
claudeProcess.stdout.setEncoding('utf8')
claudeProcess.stderr.setEncoding('utf8')

// Handle raw stdout data
claudeProcess.stdout.on('data', (data) => {
  console.log(chalk.yellow('\n[RAW STDOUT]'))
  console.log(data)
})

// Pipe to parser
claudeProcess.stdout.pipe(parser)

// Handle parsed data
parser.on('data', (message) => {
  console.log(chalk.cyan('\n[PARSED MESSAGE]'))
  console.log(JSON.stringify(message, null, 2))
})

parser.on('error', (error) => {
  console.log(chalk.red('\n[PARSER ERROR]'))
  console.log(error.message)
})

// Handle stderr
claudeProcess.stderr.on('data', (data) => {
  console.log(chalk.red('\n[STDERR]'))
  console.log(data.toString())
})

// Handle exit
claudeProcess.on('exit', (code) => {
  console.log(chalk.blue(`\nProcess exited with code: ${code}`))
})

claudeProcess.on('error', (error) => {
  console.log(chalk.red('\n[PROCESS ERROR]'))
  console.log(error.message)
})