import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sessionsApi } from '../api/sessions.api'
import { agentsApi } from '../api/agents.api'
import { repositoriesApi } from '../api/repositories.api'
import type {
  Session,
  Assistant,
  CreateSessionDto,
  UpdateSessionDto,
  SessionMessage,
  CreateMessageDto,
  MessageQueryParams
} from '../types/session.types'
import type { Agent } from '../api/agents.api'
import type { Repository } from '../types/api.types'

/**
 * 助手状态管理Store
 * 管理基于Session的助手功能
 */
interface AssistantState {
  // 数据状态
  assistants: Assistant[]
  currentAssistant: Assistant | null
  currentMessages: SessionMessage[]
  agents: Agent[]
  repositories: Repository[]
  
  // UI状态
  isLoading: boolean
  isLoadingMessages: boolean
  isCreatingAssistant: boolean
  isSendingMessage: boolean
  error: string | null
  messagesError: string | null
  
  // 分页状态
  messagesOffset: number
  hasMoreMessages: boolean
  messagesLimit: number

  // Actions - 助手管理
  loadAssistants: () => Promise<void>
  createAssistant: (data: CreateSessionDto) => Promise<Assistant>
  updateAssistant: (id: string, data: UpdateSessionDto) => Promise<void>
  deleteAssistant: (id: string) => Promise<void>
  selectAssistant: (assistant: Assistant) => void
  clearCurrentAssistant: () => void

  // Actions - 消息管理
  loadMessages: (sessionId: string, refresh?: boolean) => Promise<void>
  loadMoreMessages: (sessionId: string) => Promise<void>
  sendMessage: (sessionId: string, content: string) => Promise<void>
  clearMessages: () => void

  // Actions - 选项数据
  loadAgents: () => Promise<void>
  loadRepositories: () => Promise<void>
  
  // Actions - 错误管理
  clearError: () => void
  clearMessagesError: () => void
  
  // Actions - 重置
  reset: () => void
}

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set, get) => ({
      // 初始状态
      assistants: [],
      currentAssistant: null,
      currentMessages: [],
      agents: [],
      repositories: [],
      
      isLoading: false,
      isLoadingMessages: false,
      isCreatingAssistant: false,
      isSendingMessage: false,
      error: null,
      messagesError: null,
      
      messagesOffset: 0,
      hasMoreMessages: true,
      messagesLimit: 50,

      // 助手管理
      loadAssistants: async () => {
        set({ isLoading: true, error: null })
        
        try {
          const assistants = await sessionsApi.getAssistants()
          set({ assistants, isLoading: false })
        } catch (error: any) {
          console.error('Failed to load assistants:', error)
          set({ 
            error: error.message || '加载助手失败',
            isLoading: false 
          })
        }
      },

      createAssistant: async (data: CreateSessionDto) => {
        set({ isCreatingAssistant: true, error: null })
        
        try {
          const assistant = await sessionsApi.createAssistant(data)
          const currentAssistants = get().assistants
          
          set({ 
            assistants: [assistant, ...currentAssistants],
            isCreatingAssistant: false 
          })
          
          return assistant
        } catch (error: any) {
          console.error('Failed to create assistant:', error)
          set({ 
            error: error.message || '创建助手失败',
            isCreatingAssistant: false 
          })
          throw error
        }
      },

      updateAssistant: async (id: string, data: UpdateSessionDto) => {
        set({ error: null })
        
        try {
          const updatedAssistant = await sessionsApi.updateAssistant(id, data)
          const assistants = get().assistants
          
          const updatedAssistants = assistants.map(assistant =>
            assistant.id === id ? updatedAssistant : assistant
          )
          
          set({ assistants: updatedAssistants })
          
          // 如果更新的是当前选中的助手，也更新当前助手
          if (get().currentAssistant?.id === id) {
            set({ currentAssistant: updatedAssistant })
          }
        } catch (error: any) {
          console.error('Failed to update assistant:', error)
          set({ error: error.message || '更新助手失败' })
          throw error
        }
      },

      deleteAssistant: async (id: string) => {
        set({ error: null })
        
        try {
          await sessionsApi.deleteAssistant(id)
          const assistants = get().assistants
          
          const filteredAssistants = assistants.filter(assistant => assistant.id !== id)
          set({ assistants: filteredAssistants })
          
          // 如果删除的是当前选中的助手，清除当前助手
          if (get().currentAssistant?.id === id) {
            set({ currentAssistant: null, currentMessages: [] })
          }
        } catch (error: any) {
          console.error('Failed to delete assistant:', error)
          set({ error: error.message || '删除助手失败' })
          throw error
        }
      },

      selectAssistant: (assistant: Assistant) => {
        set({ 
          currentAssistant: assistant,
          currentMessages: [],
          messagesOffset: 0,
          hasMoreMessages: true,
          messagesError: null
        })
        
        // 自动加载消息
        get().loadMessages(assistant.id)
      },

      clearCurrentAssistant: () => {
        set({ 
          currentAssistant: null,
          currentMessages: [],
          messagesOffset: 0,
          hasMoreMessages: true,
          messagesError: null
        })
      },

      // 消息管理
      loadMessages: async (sessionId: string, refresh = false) => {
        set({ isLoadingMessages: true, messagesError: null })
        
        try {
          const params: MessageQueryParams = {
            limit: get().messagesLimit,
            offset: refresh ? 0 : get().messagesOffset
          }
          
          const messages = await sessionsApi.getMessages(sessionId, params)
          
          if (refresh) {
            set({ 
              currentMessages: messages,
              messagesOffset: messages.length,
              hasMoreMessages: messages.length === get().messagesLimit,
              isLoadingMessages: false
            })
          } else {
            const currentMessages = get().currentMessages
            set({ 
              currentMessages: [...currentMessages, ...messages],
              messagesOffset: get().messagesOffset + messages.length,
              hasMoreMessages: messages.length === get().messagesLimit,
              isLoadingMessages: false
            })
          }
        } catch (error: any) {
          console.error('Failed to load messages:', error)
          set({ 
            messagesError: error.message || '加载消息失败',
            isLoadingMessages: false 
          })
        }
      },

      loadMoreMessages: async (sessionId: string) => {
        if (!get().hasMoreMessages || get().isLoadingMessages) {
          return
        }
        
        await get().loadMessages(sessionId, false)
      },

      sendMessage: async (sessionId: string, content: string) => {
        set({ isSendingMessage: true, messagesError: null })
        
        try {
          const messageData: CreateMessageDto = {
            from: 'user',
            content: content.trim()
          }
          
          const message = await sessionsApi.addMessage(sessionId, messageData)
          const currentMessages = get().currentMessages
          
          set({ 
            currentMessages: [message, ...currentMessages],
            isSendingMessage: false
          })
          
          // 更新助手的消息计数
          const assistants = get().assistants
          const updatedAssistants = assistants.map(assistant => {
            if (assistant.id === sessionId) {
              return {
                ...assistant,
                messageCount: assistant.messageCount + 1,
                lastActivity: new Date().toISOString()
              }
            }
            return assistant
          })
          
          set({ assistants: updatedAssistants })
          
          // 更新当前助手
          if (get().currentAssistant?.id === sessionId) {
            const currentAssistant = get().currentAssistant
            set({
              currentAssistant: {
                ...currentAssistant,
                messageCount: currentAssistant.messageCount + 1,
                lastActivity: new Date().toISOString()
              }
            })
          }
          
        } catch (error: any) {
          console.error('Failed to send message:', error)
          set({ 
            messagesError: error.message || '发送消息失败',
            isSendingMessage: false 
          })
          throw error
        }
      },

      clearMessages: () => {
        set({ 
          currentMessages: [],
          messagesOffset: 0,
          hasMoreMessages: true,
          messagesError: null
        })
      },

      // 选项数据
      loadAgents: async () => {
        try {
          const agents = await agentsApi.getConnected()
          set({ agents })
        } catch (error: any) {
          console.error('Failed to load agents:', error)
        }
      },

      loadRepositories: async () => {
        try {
          const repositories = await repositoriesApi.findAll()
          set({ repositories })
        } catch (error: any) {
          console.error('Failed to load repositories:', error)
        }
      },

      // 错误管理
      clearError: () => {
        set({ error: null })
      },

      clearMessagesError: () => {
        set({ messagesError: null })
      },

      // 重置
      reset: () => {
        set({
          assistants: [],
          currentAssistant: null,
          currentMessages: [],
          agents: [],
          repositories: [],
          isLoading: false,
          isLoadingMessages: false,
          isCreatingAssistant: false,
          isSendingMessage: false,
          error: null,
          messagesError: null,
          messagesOffset: 0,
          hasMoreMessages: true
        })
      }
    }),
    {
      name: 'assistant-storage',
      // 只持久化部分数据，避免存储过多信息
      partialize: (state) => ({
        currentAssistant: state.currentAssistant,
        messagesLimit: state.messagesLimit
      })
    }
  )
)

// 选择器函数，用于组件中获取特定数据
export const useAssistants = () => {
  const assistants = useAssistantStore(state => state.assistants)
  const isLoading = useAssistantStore(state => state.isLoading)
  const error = useAssistantStore(state => state.error)
  const loadAssistants = useAssistantStore(state => state.loadAssistants)
  const createAssistant = useAssistantStore(state => state.createAssistant)
  const updateAssistant = useAssistantStore(state => state.updateAssistant)
  const deleteAssistant = useAssistantStore(state => state.deleteAssistant)
  
  return {
    assistants,
    isLoading,
    error,
    loadAssistants,
    createAssistant,
    updateAssistant,
    deleteAssistant
  }
}

export const useCurrentAssistant = () => {
  const currentAssistant = useAssistantStore(state => state.currentAssistant)
  const currentMessages = useAssistantStore(state => state.currentMessages)
  const isLoadingMessages = useAssistantStore(state => state.isLoadingMessages)
  const isSendingMessage = useAssistantStore(state => state.isSendingMessage)
  const messagesError = useAssistantStore(state => state.messagesError)
  const hasMoreMessages = useAssistantStore(state => state.hasMoreMessages)
  const selectAssistant = useAssistantStore(state => state.selectAssistant)
  const clearCurrentAssistant = useAssistantStore(state => state.clearCurrentAssistant)
  const loadMessages = useAssistantStore(state => state.loadMessages)
  const loadMoreMessages = useAssistantStore(state => state.loadMoreMessages)
  const sendMessage = useAssistantStore(state => state.sendMessage)
  const clearMessages = useAssistantStore(state => state.clearMessages)
  
  return {
    currentAssistant,
    currentMessages,
    isLoadingMessages,
    isSendingMessage,
    messagesError,
    hasMoreMessages,
    selectAssistant,
    clearCurrentAssistant,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    clearMessages
  }
}

export const useAssistantOptions = () => {
  const agents = useAssistantStore(state => state.agents)
  const repositories = useAssistantStore(state => state.repositories)
  const loadAgents = useAssistantStore(state => state.loadAgents)
  const loadRepositories = useAssistantStore(state => state.loadRepositories)
  
  return {
    agents,
    repositories,
    loadAgents,
    loadRepositories
  }
}