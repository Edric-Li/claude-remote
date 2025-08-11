// 导入API实例
import { authApi } from './auth.api'
import { usersApi } from './users.api'
import { aiConfigsApi } from './ai-configs.api'
import { ApiErrorClass } from './base.api'

// 重新导出API实例
export { authApi } from './auth.api'
export { usersApi } from './users.api'
export { aiConfigsApi } from './ai-configs.api'

// 导出基础类和类型
export { BaseApi, CrudApi, ApiErrorClass } from './base.api'
export * from '../types/api.types'

// 创建API实例的组合对象
export const api = {
  auth: authApi,
  users: usersApi,
  aiConfigs: aiConfigsApi,
}

// 全局错误处理器
export const setupGlobalErrorHandler = () => {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason instanceof ApiErrorClass) {
      console.error('API Error:', {
        statusCode: event.reason.statusCode,
        message: event.reason.message,
        path: event.reason.path,
        timestamp: event.reason.timestamp
      })
      
      // 如果是401错误，可以触发重新登录
      if (event.reason.statusCode === 401) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      }
      
      event.preventDefault()
    }
  })
}