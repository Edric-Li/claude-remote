import { spawn } from 'child_process'
import chalk from 'chalk'

console.log(chalk.blue('Testing Claude simple output...\n'))

const claudeProcess = spawn('claude', ['-p', 'What is 2+2?', '--output-format', 'stream-json', '--verbose'], {
  cwd: process.cwd(),
  shell: false,
  env: process.env
})

console.log(chalk.green(`Process started with PID: ${claudeProcess.pid}`))

let stdoutBuffer = ''
let stderrBuffer = ''

// Handle stdout
claudeProcess.stdout.on('data', (data) => {
  const output = data.toString()
  stdoutBuffer += output
  console.log(chalk.yellow('[STDOUT CHUNK]'), output.length, 'bytes')
})

// Handle stderr
claudeProcess.stderr.on('data', (data) => {
  const output = data.toString()
  stderrBuffer += output
  console.log(chalk.red('[STDERR CHUNK]'), output)
})

// Handle exit
claudeProcess.on('exit', (code) => {
  console.log(chalk.blue(`\nProcess exited with code: ${code}`))
  console.log(chalk.green('\nFull STDOUT:'))
  console.log(stdoutBuffer)
  console.log(chalk.red('\nFull STDERR:'))
  console.log(stderrBuffer || '(empty)')
})

claudeProcess.on('error', (error) => {
  console.log(chalk.red('\n[PROCESS ERROR]'))
  console.log(error.message)
})

// Timeout after 10 seconds
setTimeout(() => {
  console.log(chalk.yellow('\nTimeout reached, killing process...'))
  claudeProcess.kill()
}, 10000)