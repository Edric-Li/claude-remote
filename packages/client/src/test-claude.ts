import { spawn } from 'child_process'
import chalk from 'chalk'

console.log(chalk.blue('Testing Claude CLI availability...\n'))

// Test 1: Check if claude is in PATH
const whichProcess = spawn('which', ['claude'], { shell: true })

whichProcess.stdout.on('data', (data) => {
  console.log(chalk.green(`✅ Claude found at: ${data.toString().trim()}`))
})

whichProcess.stderr.on('data', (data) => {
  console.log(chalk.red(`❌ Error finding claude: ${data.toString()}`))
})

whichProcess.on('close', (code) => {
  if (code === 0) {
    console.log(chalk.green('\n✅ Claude is available in PATH'))
    
    // Test 2: Try to run claude --version
    console.log(chalk.blue('\nTesting claude --version...'))
    const versionProcess = spawn('claude', ['--version'], { shell: false })
    
    versionProcess.stdout.on('data', (data) => {
      console.log(chalk.gray(`Output: ${data.toString()}`))
    })
    
    versionProcess.stderr.on('data', (data) => {
      console.log(chalk.yellow(`Stderr: ${data.toString()}`))
    })
    
    versionProcess.on('error', (error) => {
      console.log(chalk.red(`❌ Error running claude: ${error.message}`))
    })
    
    versionProcess.on('close', (code) => {
      console.log(chalk.blue(`\nClaude --version exited with code: ${code}`))
      
      // Test 3: Check environment variables
      console.log(chalk.blue('\nEnvironment check:'))
      console.log(chalk.gray(`PATH: ${process.env.PATH}`))
      console.log(chalk.gray(`CLAUDE_MODEL: ${process.env.CLAUDE_MODEL || 'Not set'}`))
      console.log(chalk.gray(`HOME: ${process.env.HOME}`))
    })
  } else {
    console.log(chalk.red('\n❌ Claude not found in PATH'))
    console.log(chalk.yellow('\nPlease ensure Claude is installed. You can install it with:'))
    console.log(chalk.cyan('npm install -g @anthropic-ai/claude-cli'))
  }
})