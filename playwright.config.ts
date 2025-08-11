import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright 配置 - AI Orchestra WebSocket 测试
 */
export default defineConfig({
  // 测试目录
  testDir: './tests',
  
  // 超时设置
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  
  // 失败重试
  retries: process.env.CI ? 2 : 0,
  
  // 并发worker数
  workers: process.env.CI ? 1 : undefined,
  
  // 报告设置
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // 全局设置
  use: {
    // 基础URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // API端点
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
    
    // 追踪设置
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // 等待设置
    actionTimeout: 10000,
    navigationTimeout: 30000
  },

  // 项目配置
  projects: [
    // 设置项目 - 运行在所有测试之前
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup'
    },
    
    // 清理项目 - 运行在所有测试之后
    {
      name: 'cleanup',
      testMatch: /.*\.cleanup\.ts/
    },

    // Chrome 桌面测试
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup']
    },

    // Firefox 桌面测试
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup']
    },

    // WebKit 桌面测试
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup']
    },

    // 移动端测试
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup']
    },

    // Edge 测试
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
      dependencies: ['setup']
    }
  ],

  // WebServer 配置 - 自动启动服务
  webServer: [
    // 启动后端服务器
    {
      command: 'pnpm run dev:server',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
      env: {
        NODE_ENV: 'test',
        PORT: '3001',
        JWT_SECRET: 'test-jwt-secret-key',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASSWORD: 'postgres',
        DB_NAME: 'ai_orchestra_test'
      }
    },
    // 启动前端开发服务器
    {
      command: 'pnpm run dev:web',
      url: 'http://localhost:3000', 
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000
    }
  ],

  // 输出目录
  outputDir: 'test-results/'
})