#!/usr/bin/env node

// 简单的启动脚本，可以通过 npx 运行
const { spawn } = require('child_process')
const path = require('path')

// 解析命令行参数
const args = process.argv.slice(2)
let key = ''
let server = 'http://localhost:3000'
let name = `Agent-${process.pid}`

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--key' || args[i] === '-k') {
    key = args[i + 1]
    i++
  } else if (args[i] === '--server' || args[i] === '-s') {
    server = args[i + 1]
    i++
  } else if (args[i] === '--name' || args[i] === '-n') {
    name = args[i + 1]
    i++
  }
}

if (!key) {
  console.error('❌ Error: Authentication key is required')
  console.log('\nUsage:')
  console.log('  npx . --key YOUR-KEY [options]')
  console.log('\nOptions:')
  console.log('  -k, --key <key>      Authentication key (required)')
  console.log('  -s, --server <url>   Server URL (default: http://localhost:3000)')
  console.log('  -n, --name <name>    Agent name (default: Agent-<pid>)')
  console.log('\nExample:')
  console.log('  npx . --key AIO-A703-5E3A-FD99-00E2')
  process.exit(1)
}

console.log('🚀 Starting AI Orchestra Agent Worker...')
console.log(`📡 Server: ${server}`)
console.log(`🤖 Agent: ${name}`)
console.log(`🔑 Key: ***${key.slice(-4)}`)
console.log('')

// 设置环境变量
const env = {
  ...process.env,
  SERVER_URL: server,
  AGENT_NAME: name,
  AUTH_TOKEN: key,
  CAPABILITIES: 'claude-code,cursor,qucoder'
}

// 启动 agent
const agentPath = path.join(__dirname, 'src', 'agent-worker.ts')
const child = spawn('npx', ['tsx', agentPath], {
  env,
  stdio: 'inherit',
  cwd: __dirname
})

child.on('error', err => {
  console.error('❌ Failed to start agent:', err.message)
  process.exit(1)
})

child.on('exit', code => {
  process.exit(code || 0)
})
