import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { API_BASE_URL } from '../config'
import { httpGet } from '../utils/httpClient'

interface Message {
  id: string
  from: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    tool?: string
    agentId?: string
    workerId?: string
    usage?: any
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
    claudeSessionId?: string
    isProcessing?: boolean  // 添加处理状态
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
    metadata?: any  // 添加metadata参数
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
  setProcessingStatus: (sessionId: string, isProcessing: boolean) => void
  
  // 持久化
  clearLocalCache: () => void
}

// 创建Store
const useSessionStoreBase = create<SessionStore>()(
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
                branch: data.branch,
                ...(data.metadata || {})  // 合并传入的metadata
              }
            })
          })
          
          // 如果401错误，尝试刷新token
          if (response.status === 401) {
            try {
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
                        branch: data.branch,
                        ...(data.metadata || {})  // 合并传入的metadata
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
      
      // 添加消息 - 更新本地状态并同步到数据库
      addMessage: async (sessionId, message) => {
        // 创建新消息
        const newMessage: Message = {
          ...message,
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date()
        }
        
        // 立即更新本地状态用于显示
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
        
        // 异步保存到数据库
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
          
          if (!response.ok) {
            console.error('Failed to save message to database:', response.status)
          } else {
            const savedMessage = await response.json()
            // 更新消息ID为服务器返回的ID
            set((state) => ({
              sessions: state.sessions.map(s =>
                s.id === sessionId
                  ? {
                      ...s,
                      messages: s.messages.map(m =>
                        m.id === newMessage.id
                          ? { ...m, id: savedMessage.id }
                          : m
                      )
                    }
                  : s
              )
            }))
          }
        } catch (error) {
          console.error('Failed to save message:', error)
        }
      },
      
      // 加载消息历史 - 先从数据库加载，如果没有再从 Agent 端获取 Claude 本地历史
      loadMessages: async (sessionId) => {
        try {
          // 先尝试从数据库加载消息
          const authStorage = localStorage.getItem('auth-storage')
          const authState = authStorage ? JSON.parse(authStorage) : null
          const token = authState?.state?.accessToken
          
          const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/messages`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          
          if (response.ok) {
            const messages = await response.json()
            
            if (messages && messages.length > 0) {
              // 如果数据库有消息，使用数据库的消息
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
              return // 数据库有消息，直接返回
            }
          }
        } catch (error) {
          console.error('Failed to load messages from database:', error)
        }
        
        // 如果数据库没有消息，尝试从 Agent 端获取 Claude 本地历史
        const session = get().sessions.find(s => s.id === sessionId)
        if (!session || !session.workerId) {
          return
        }
        
        // 通过 WebSocket 请求历史记录
        const socket = (window as any).__socket
        if (!socket) {
          console.error('WebSocket not available')
          return
        }
        
        // 生成请求ID用于跟踪响应
        const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        
        // 设置响应监听器
        const handleHistoryResponse = (data: any) => {
          if (data.requestId === requestId && data.sessionId === sessionId) {
            
            if (data.success && data.messages) {
              // 更新会话的消息列表
              set((state) => ({
                sessions: state.sessions.map(s =>
                  s.id === sessionId
                    ? {
                        ...s,
                        messages: data.messages.map((m: any) => ({
                          id: m.id || `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          from: m.role === 'user' ? 'user' : 'assistant',
                          content: m.content,
                          timestamp: new Date(m.timestamp || m.createdAt),
                          metadata: m.metadata
                        }))
                      }
                    : s
                )
              }))
            }
            
            // 移除监听器
            socket.off('history:response', handleHistoryResponse)
          }
        }
        
        socket.on('history:response', handleHistoryResponse)
        
        // 发送请求，包含 taskId (即 workerId)
        socket.emit('history:fetch', {
          sessionId: sessionId,
          taskId: session.workerId,
          requestId: requestId
        })
        
        // 设置超时清理
        setTimeout(() => {
          socket.off('history:response', handleHistoryResponse)
        }, 10000)
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
      
      setProcessingStatus: (sessionId, isProcessing) => {
        set((state) => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? {
                  ...s,
                  metadata: {
                    ...s.metadata,
                    isProcessing
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
        // 持久化会话列表和当前选中的会话ID
        sessions: state.sessions,
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

// 导出基础store以供直接访问
export { useSessionStoreBase }