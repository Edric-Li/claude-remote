import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  username: string
  email: string
  nickname?: string
  avatar?: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  setAuth: (user: User, accessToken: string, refreshToken?: string) => void
  clearError: () => void
  refreshAccessToken: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || '登录失败')
          }

          const data = await response.json()
          
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null
          })
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || '登录失败，请重试'
          })
          throw error
        }
      },

      logout: () => {
        // 调用登出 API
        const token = get().accessToken
        if (token) {
          fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`
            }
          }).catch(console.error)
        }
        
        // 清除本地状态
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null
        })
      },

      setAuth: (user: User, accessToken: string, refreshToken?: string) => {
        set({
          user,
          accessToken,
          refreshToken: refreshToken || get().refreshToken,
          isAuthenticated: true,
          error: null
        })
      },

      clearError: () => {
        set({ error: null })
      },

      refreshAccessToken: async () => {
        const refreshToken = get().refreshToken
        
        if (!refreshToken) {
          get().logout()
          throw new Error('No refresh token')
        }

        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${get().accessToken}`
            }
          })

          if (!response.ok) {
            throw new Error('Failed to refresh token')
          }

          const data = await response.json()
          
          set({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken || refreshToken
          })
        } catch (error) {
          get().logout()
          throw error
        }
      },

      updateProfile: async (data: Partial<User>) => {
        const token = get().accessToken
        
        if (!token) {
          throw new Error('Not authenticated')
        }

        try {
          const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(data)
          })

          if (!response.ok) {
            throw new Error('Failed to update profile')
          }

          const updatedUser = await response.json()
          
          set({
            user: updatedUser
          })
        } catch (error: any) {
          set({ error: error.message })
          throw error
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

// Axios 拦截器配置（如果使用 axios）
export const setupAxiosInterceptors = () => {
  // TODO: 配置 axios 拦截器自动添加 token
}

// Fetch 包装器
export const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = useAuthStore.getState().accessToken
  
  if (token) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`
    }
  }
  
  const response = await fetch(url, options)
  
  // 如果 token 过期，尝试刷新
  if (response.status === 401) {
    try {
      await useAuthStore.getState().refreshAccessToken()
      
      // 重试请求
      const newToken = useAuthStore.getState().accessToken
      if (newToken) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${newToken}`
        }
        return fetch(url, options)
      }
    } catch (error) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
  }
  
  return response
}