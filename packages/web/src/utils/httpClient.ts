import { API_BASE_URL } from '../config'

interface RequestConfig extends RequestInit {
  skipAuth?: boolean
  skipRetry?: boolean
}

/**
 * 获取认证token
 */
function getAuthToken(): string | null {
  try {
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      const authState = JSON.parse(authStorage)
      return authState?.state?.accessToken || null
    }
  } catch (error) {
    console.error('Failed to get auth token:', error)
  }
  return null
}

/**
 * 获取refresh token
 */
function getRefreshToken(): string | null {
  try {
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      const authState = JSON.parse(authStorage)
      return authState?.state?.refreshToken || null
    }
  } catch (error) {
    console.error('Failed to get refresh token:', error)
  }
  return null
}

/**
 * 更新localStorage中的token
 */
function updateAuthToken(newAccessToken: string, newRefreshToken?: string) {
  try {
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      const authState = JSON.parse(authStorage)
      if (authState?.state) {
        authState.state.accessToken = newAccessToken
        if (newRefreshToken) {
          authState.state.refreshToken = newRefreshToken
        }
        localStorage.setItem('auth-storage', JSON.stringify(authState))
      }
    }
  } catch (error) {
    console.error('Failed to update auth token:', error)
  }
}

/**
 * 清除认证信息
 */
function clearAuth() {
  try {
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      const authState = JSON.parse(authStorage)
      if (authState?.state) {
        authState.state.accessToken = null
        authState.state.refreshToken = null
        authState.state.isAuthenticated = false
        authState.state.user = null
        localStorage.setItem('auth-storage', JSON.stringify(authState))
      }
    }
  } catch (error) {
    console.error('Failed to clear auth:', error)
  }
}

/**
 * 带有自动token刷新功能的HTTP客户端
 */
export class HttpClient {
  private static async makeRequest(url: string, config: RequestConfig = {}): Promise<Response> {
    const { skipAuth = false, skipRetry = false, ...requestInit } = config
    
    // 准备请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers as Record<string, string>
    }
    
    // 添加认证头（如果不跳过认证）
    if (!skipAuth) {
      const accessToken = getAuthToken()
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }
    }
    
    // 构建完整URL
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`
    
    try {
      const response = await fetch(fullUrl, {
        ...requestInit,
        headers
      })
      
      // 如果是401错误且不跳过重试，尝试刷新token
      if (response.status === 401 && !skipRetry && !skipAuth) {
        try {
          console.log('Token可能过期，尝试刷新...')
          const refreshToken = getRefreshToken()
          
          if (refreshToken) {
            // 调用刷新token的API
            const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
              }
            })
            
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              console.log('Token刷新成功，重试请求...')
              
              // 更新localStorage中的token
              updateAuthToken(refreshData.accessToken, refreshData.refreshToken)
              
              // 使用新token重试请求
              return fetch(fullUrl, {
                ...requestInit,
                headers: {
                  ...headers,
                  Authorization: `Bearer ${refreshData.accessToken}`
                }
              })
            } else {
              console.error('Token刷新失败:', refreshResponse.status)
              throw new Error('Token刷新失败')
            }
          }
        } catch (refreshError) {
          console.error('Token刷新失败:', refreshError)
          // 刷新失败，清除认证信息
          clearAuth()
          throw new Error('认证失败，请重新登录')
        }
      }
      
      return response
    } catch (error) {
      console.error('HTTP请求失败:', error)
      throw error
    }
  }
  
  static async get(url: string, config?: RequestConfig) {
    return this.makeRequest(url, { ...config, method: 'GET' })
  }
  
  static async post(url: string, data?: any, config?: RequestConfig) {
    return this.makeRequest(url, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    })
  }
  
  static async put(url: string, data?: any, config?: RequestConfig) {
    return this.makeRequest(url, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    })
  }
  
  static async delete(url: string, config?: RequestConfig) {
    return this.makeRequest(url, { ...config, method: 'DELETE' })
  }
  
  /**
   * 检查响应是否成功，如果不成功则抛出错误
   */
  static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      
      try {
        const errorData = await response.json()
        if (errorData.message) {
          errorMessage = errorData.message
        }
      } catch {
        // 忽略JSON解析错误，使用默认错误消息
      }
      
      throw new Error(errorMessage)
    }
    
    try {
      return await response.json()
    } catch {
      // 如果响应不是JSON，返回响应对象本身
      return response as unknown as T
    }
  }
  
  /**
   * 快捷方法：GET请求并自动处理响应
   */
  static async getJson<T>(url: string, config?: RequestConfig): Promise<T> {
    const response = await this.get(url, config)
    return this.handleResponse<T>(response)
  }
  
  /**
   * 快捷方法：POST请求并自动处理响应
   */
  static async postJson<T>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    const response = await this.post(url, data, config)
    return this.handleResponse<T>(response)
  }
  
  /**
   * 快捷方法：PUT请求并自动处理响应
   */
  static async putJson<T>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    const response = await this.put(url, data, config)
    return this.handleResponse<T>(response)
  }
}

// 导出便捷的函数接口
export const httpGet = <T>(url: string, config?: RequestConfig) => HttpClient.getJson<T>(url, config)
export const httpPost = <T>(url: string, data?: any, config?: RequestConfig) => HttpClient.postJson<T>(url, data, config)
export const httpPut = <T>(url: string, data?: any, config?: RequestConfig) => HttpClient.putJson<T>(url, data, config)
export const httpDelete = (url: string, config?: RequestConfig) => HttpClient.delete(url, config)