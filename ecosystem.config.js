module.exports = {
  apps: [
    {
      name: 'ai-orchestra-server',
      script: './packages/server/dist/main.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_TYPE: 'postgres',
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_USER: 'edric',
        DB_PASSWORD: 'ai_orchestra_pass',
        DB_NAME: 'ai_orchestra',
        DB_SSL: false,
        DB_LOGGING: true
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        DB_TYPE: 'postgres',
        DB_HOST: 'localhost',
        DB_PORT: 5432,
        DB_USER: 'edric',
        DB_PASSWORD: 'ai_orchestra_pass',
        DB_NAME: 'ai_orchestra',
        DB_SSL: false,
        DB_LOGGING: true
      },
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      log_file: './logs/server-combined.log',
      time: true
    },
    {
      name: 'ai-orchestra-web',
      script: 'npx',
      args: 'serve -s packages/web/dist -l 3001',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_file: './logs/web-combined.log',
      time: true
    },
    {
      name: 'ai-orchestra-agent',
      script: './packages/agent/dist/agent-worker.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/agent-error.log',
      out_file: './logs/agent-out.log',
      log_file: './logs/agent-combined.log',
      time: true
    }
  ],

  deploy: {
    production: {
      user: 'SSH_USERNAME',
      host: 'SSH_HOSTMACHINE',
      ref: 'origin/main',
      repo: 'GIT_REPOSITORY',
      path: 'DESTINATION_PATH',
      'pre-deploy-local': '',
      'post-deploy': 'pnpm install && pnpm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
}