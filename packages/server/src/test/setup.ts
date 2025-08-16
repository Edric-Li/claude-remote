// Jest 测试设置文件
// 设置全局测试环境和配置

// 设置测试超时
jest.setTimeout(10000)

// 模拟环境变量
process.env.NODE_ENV = 'test'
process.env.ENCRYPTION_KEY = 'test-encryption-key-for-jest-tests'

// 全局测试工具
global.console = {
  ...console,
  // 在测试中静默某些日志
  warn: jest.fn(),
  error: jest.fn()
}