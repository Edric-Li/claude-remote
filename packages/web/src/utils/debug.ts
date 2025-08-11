// 调试工具函数

export function enableDebugLogging() {
  // 启用详细的日志输出
  const originalConsoleLog = console.log
  const originalConsoleError = console.error

  console.log = (...args) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12)
    originalConsoleLog(`[${timestamp}]`, ...args)
  }

  console.error = (...args) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12)
    originalConsoleError(`[${timestamp}] ERROR:`, ...args)
  }

  // HTTP通信调试
  if (typeof window !== 'undefined') {
    console.log('🌐 HTTP通信调试已启用')
  }
}

// 在开发环境自动启用
if (import.meta.env.DEV) {
  enableDebugLogging()
  console.log('🔍 调试模式已启用')
}
