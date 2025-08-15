module.exports = {
  apps: [
    {
      name: 'ai-orchestra-server-dev',
      script: 'pnpm',
      args: 'run dev:server',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: ['packages/server/src'],
      ignore_watch: ['node_modules', 'logs', 'dist'],
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      error_file: './logs/server-dev-error.log',
      out_file: './logs/server-dev-out.log',
      log_file: './logs/server-dev-combined.log',
      time: true
    },
    {
      name: 'ai-orchestra-web-dev',
      script: 'pnpm',
      args: 'run dev:web',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: ['packages/web/src'],
      ignore_watch: ['node_modules', 'logs', 'dist'],
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development'
      },
      error_file: './logs/web-dev-error.log',
      out_file: './logs/web-dev-out.log',
      log_file: './logs/web-dev-combined.log',
      time: true
    },
    {
      name: 'ai-orchestra-agent-dev',
      script: 'pnpm',
      args: 'run dev:agent',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: ['packages/agent/src'],
      ignore_watch: ['node_modules', 'logs', 'dist'],
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development'
      },
      error_file: './logs/agent-dev-error.log',
      out_file: './logs/agent-dev-out.log',
      log_file: './logs/agent-dev-combined.log',
      time: true
    }
  ]
}