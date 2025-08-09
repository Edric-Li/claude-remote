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
  
  // 监听WebSocket事件
  if (typeof window !== 'undefined' && (window as any).__socket) {
    const socket = (window as any).__socket
    
    socket.onAny((eventName: string, ...args: any[]) => {
      console.log(`[WebSocket] Event: ${eventName}`, args)
    })
  }
}

// 在开发环境自动启用
if (import.meta.env.DEV) {
  enableDebugLogging()
  console.log('🔍 调试模式已启用')
}