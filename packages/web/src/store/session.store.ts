import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { API_BASE_URL } from '../config'

interface Message {
  id: string
  from: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    tool?: string
    agentId?: string
    workerId?: string
  }
}

interface Session {
  id: string
  name: string
  repositoryId: string
  repositoryName: string
  aiTool: string
  workerId?: string
  agentId?: string
  status: 'active' | 'paused' | 'completed' | 'archived'
  createdAt: Date
  updatedAt: Date
  messages: Message[]
  metadata?: {
    branch?: string
    lastActivity?: Date
    tokenUsage?: number
    workerStatus?: 'idle' | 'busy'
  }
}

interface SessionStore {
  // 状态
  sessions: Session[]
  currentSessionId: string | null
  loading: boolean
  error: string | null
  
  // 不再作为计算属性，改为派生状态
  // currentSession: Session | null
  // activeSessions: Session[]
  
  // Actions
  createSession: (data: {
    name: string
    repositoryId: string
    repositoryName: string
    aiTool: string
    branch?: string
  }) => Promise<Session>
  
  loadSessions: () => Promise<void>
  selectSession: (sessionId: string) => void
  updateSession: (sessionId: string, updates: Partial<Session>) => void
  deleteSession: (sessionId: string) => Promise<void>
  renameSession: (sessionId: string, newName: string) => Promise<void>
  
  // 消息相关
  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => Promise<void>
  loadMessages: (sessionId: string) => Promise<void>
  
  // Worker相关
  assignWorker: (sessionId: string, workerId: string, agentId: string) => Promise<void>
  updateWorkerStatus: (sessionId: string, status: 'idle' | 'busy') => void
  
  // 持久化
  clearLocalCache: () => void
}

// 创建Store
export const useSessionStoreBase = create<SessionStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      sessions: [],
      currentSessionId: null,
      loading: false,
      error: null,
      
      // 创建会话 - 调用后端API
      createSession: async (data) => {
        try {
          console.log('Creating session with data:', data)
          
          // 获取当前token
          const authStorage = localStorage.getItem('auth-storage')
          const authState = authStorage ? JSON.parse(authStorage) : null
          const token = authState?.state?.accessToken
          
          let response = await fetch(`${API_BASE_URL}/api/sessions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              name: data.name,
              repositoryId: data.repositoryId,
              aiTool: data.aiTool,
              metadata: {
                branch: data.branch
              }
            })
          })
          
          // 如果401错误，尝试刷新token
          if (response.status === 401) {
            try {
              console.log('Token过期，尝试刷新...')
              // 手动调用refresh API
              const refreshStorage = localStorage.getItem('auth-storage')
              const refreshState = refreshStorage ? JSON.parse(refreshStorage) : null
              const refreshToken = refreshState?.state?.refreshToken
              
              if (refreshToken) {
                const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  }
                })
                
                if (refreshResponse.ok) {
                  const refreshData = await refreshResponse.json()
                  // 更新localStorage
                  const updatedState = {...refreshState}
                  updatedState.state.accessToken = refreshData.accessToken
                  if (refreshData.refreshToken) {
                    updatedState.state.refreshToken = refreshData.refreshToken
                  }
                  localStorage.setItem('auth-storage', JSON.stringify(updatedState))
                  
                  // 使用新token重试
                  response = await fetch(`${API_BASE_URL}/api/sessions`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${refreshData.accessToken}`
                    },
                    body: JSON.stringify({
                      name: data.name,
                      repositoryId: data.repositoryId,
                      aiTool: data.aiTool,
                      metadata: {
                        branch: data.branch
                      }
                    })
                  })
                }
              }
            } catch (refreshError) {
              console.error('Token刷新失败:', refreshError)
              throw new Error('认证失败，请重新登录')
            }
          }
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          
          const serverSession = await response.json()
          console.log('Session created:', serverSession)
          
          // 转换格式
          const newSession: Session = {
            id: serverSession.id,
            name: serverSession.name,
            repositoryId: serverSession.repositoryId,
            repositoryName: serverSession.repository?.name || data.repositoryName,
            aiTool: serverSession.aiTool,
            status: serverSession.status || 'active',
            createdAt: new Date(serverSession.createdAt),
            updatedAt: new Date(serverSession.updatedAt),
            messages: [],
            workerId: serverSession.workerId,
            agentId: serverSession.agentId,
            metadata: serverSession.metadata
          }
          
          // 更新本地状态
          set((state) => {
            const newState = {
              sessions: [newSession, ...state.sessions],
              currentSessionId: newSession.id
            }
            console.log('SessionStore: 更新状态后:', {
              sessions: newState.sessions,
              currentSessionId: newState.currentSessionId,
              currentSession: newState.sessions.find(s => s.id === newState.currentSessionId)
            })
            return newState
          })
          
          return newSession
        } catch (error) {
          console.error('Failed to create session:', error)
          throw error
        }
      },
      
      // 加载会话列表 - 从后端获取
      loadSessions: async () => {
        set({ loading: true, error: null })
        
        try {
          const sessions = await httpGet<any[]>('/api/sessions')
          
          set({
            sessions: sessions.map((s: any) => ({
              id: s.id,
              name: s.name,
              repositoryId: s.repositoryId,
              repositoryName: s.repository?.name || 'Unknown',
              aiTool: s.aiTool,
              status: s.status,
              workerId: s.workerId,
              agentId: s.agentId,
              createdAt: new Date(s.createdAt),
              updatedAt: new Date(s.updatedAt),
              messages: s.messages?.map((m: any) => ({
                id: m.id,
                from: m.from,
                content: m.content,
                timestamp: new Date(m.createdAt),
                metadata: m.metadata
              })) || [],
              metadata: s.metadata
            })),
            loading: false
          })
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            loading: false 
          })
        }
      },
      
      // 选择会话
      selectSession: (sessionId) => {
        set({ currentSessionId: sessionId })
        
        // 加载该会话的消息历史
        get().loadMessages(sessionId)
      },
      
      // 更新会话
      updateSession: (sessionId, updates) => {
        set((state) => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? { ...s, ...updates, updatedAt: new Date() }
              : s
          )
        }))
        
        // 异步同步到服务器
        const authStorage = localStorage.getItem('auth-storage')
        const authState = authStorage ? JSON.parse(authStorage) : null
        const token = authState?.state?.accessToken
        fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updates)
        }).catch(error => {
          console.error('Failed to update session:', error)
        })
      },
      
      // 删除会话
      deleteSession: async (sessionId) => {
        try {
          const authStorage = localStorage.getItem('auth-storage')
          const authState = authStorage ? JSON.parse(authStorage) : null
          const token = authState?.state?.accessToken
          const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          
          if (response.ok) {
            set((state) => ({
              sessions: state.sessions.filter(s => s.id !== sessionId),
              currentSessionId: state.currentSessionId === sessionId 
                ? null 
                : state.currentSessionId
            }))
          }
        } catch (error) {
          console.error('Failed to delete session:', error)
          throw error
        }
      },
      
      // 重命名会话
      renameSession: async (sessionId, newName) => {
        get().updateSession(sessionId, { name: newName })
      },
      
      // 添加消息 - 同步到后端
      addMessage: async (sessionId, message) => {
        // 先更新本地状态（乐观更新）
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const newMessage: Message = {
          ...message,
          id: tempId,
          timestamp: new Date()
        }
        
        set((state) => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: [...s.messages, newMessage],
                  metadata: {
                    ...s.metadata,
                    lastActivity: new Date()
                  }
                }
              : s
          )
        }))
        
        // 同步到服务器
        try {
          const authStorage = localStorage.getItem('auth-storage')
          const authState = authStorage ? JSON.parse(authStorage) : null
          const token = authState?.state?.accessToken
          const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              from: message.from,
              content: message.content,
              metadata: message.metadata
            })
          })
          
          if (response.ok) {
            const serverMessage = await response.json()
            // 更新消息ID为服务器返回的ID
            set((state) => ({
              sessions: state.sessions.map(s =>
                s.id === sessionId
                  ? {
                      ...s,
                      messages: s.messages.map(m => 
                        m.id === tempId 
                          ? { ...m, id: serverMessage.id }
                          : m
                      )
                    }
                  : s
              )
            }))
          }
        } catch (error) {
          console.error('Failed to sync message:', error)
        }
      },
      
      // 加载消息历史
      loadMessages: async (sessionId) => {
        try {
          const authStorage = localStorage.getItem('auth-storage')
          const authState = authStorage ? JSON.parse(authStorage) : null
          const token = authState?.state?.accessToken
          const response = await fetch(
            `${API_BASE_URL}/api/sessions/${sessionId}/messages`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          )
          
          if (response.ok) {
            const messages = await response.json()
            set((state) => ({
              sessions: state.sessions.map(s =>
                s.id === sessionId
                  ? {
                      ...s,
                      messages: messages.map((m: any) => ({
                        id: m.id,
                        from: m.from,
                        content: m.content,
                        timestamp: new Date(m.createdAt),
                        metadata: m.metadata
                      }))
                    }
                  : s
              )
            }))
          }
        } catch (error) {
          console.error('Failed to load messages:', error)
        }
      },
      
      // 分配Worker - 调用后端API
      assignWorker: async (sessionId, workerId, agentId) => {
        try {
          const authStorage = localStorage.getItem('auth-storage')
          const authState = authStorage ? JSON.parse(authStorage) : null
          const token = authState?.state?.accessToken
          const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/assign-worker`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ workerId, agentId })
          })
          
          if (response.ok) {
            const updated = await response.json()
            set((state) => ({
              sessions: state.sessions.map(s =>
                s.id === sessionId
                  ? { ...s, workerId, agentId, metadata: updated.metadata }
                  : s
              )
            }))
          }
        } catch (error) {
          console.error('Failed to assign worker:', error)
        }
      },
      
      // 更新Worker状态
      updateWorkerStatus: (sessionId, status) => {
        set((state) => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? {
                  ...s,
                  metadata: {
                    ...s.metadata,
                    workerStatus: status
                  }
                }
              : s
          )
        }))
      },
      
      // 清除本地缓存
      clearLocalCache: () => {
        set({
          sessions: [],
          currentSessionId: null,
          loading: false,
          error: null
        })
      }
    }),
    {
      name: 'ai-orchestra-sessions',
      partialize: (state) => ({
        // 只持久化最小必要数据
        currentSessionId: state.currentSessionId
      })
    }
  )
)

// 导出包装的hook，包含派生状态
export const useSessionStore = () => {
  const state = useSessionStoreBase()
  
  // 计算派生状态
  const currentSession = state.sessions.find(s => s.id === state.currentSessionId) || null
  const activeSessions = state.sessions.filter(s => s.status === 'active')
  
  return {
    ...state,
    currentSession,
    activeSessions
  }
}