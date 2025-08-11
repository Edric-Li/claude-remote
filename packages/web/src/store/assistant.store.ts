/**
 * 助手管理存储
 * 用于管理用户创建的AI助手
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuthStore } from './auth.store'

export interface Assistant {
  id: string
  name: string
  description: string
  avatar: string
  type: 'general' | 'coding' | 'writing' | 'analysis' | 'creative' | 'support'
  model: 'claude-3' | 'gpt-4' | 'gemini-pro' | 'custom'
  systemPrompt: string
  temperature: number
  maxTokens: number
  isPublic: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  userId: string
}

interface AssistantState {
  assistants: Assistant[]
  loading: boolean
  error: string | null
  
  // Actions
  loadAssistants: () => Promise<void>
  createAssistant: (data: Omit<Assistant, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<Assistant>
  updateAssistant: (id: string, data: Partial<Assistant>) => Promise<void>
  deleteAssistant: (id: string) => Promise<void>
  toggleAssistant: (id: string) => Promise<void>
  clearError: () => void
  
  // Local helpers
  getAssistantById: (id: string) => Assistant | undefined
  getActiveAssistants: () => Assistant[]
  getAssistantsByType: (type: string) => Assistant[]
}

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set, get) => ({
      assistants: [],
      loading: false,
      error: null,

      loadAssistants: async () => {
        set({ loading: true, error: null })
        
        try {
          const { accessToken } = useAuthStore.getState()
          
          const response = await fetch('/api/assistants', {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const data = await response.json()
          
          const assistants = data.map((assistant: any) => ({
            ...assistant,
            createdAt: new Date(assistant.createdAt),
            updatedAt: new Date(assistant.updatedAt)
          }))

          set({ assistants, loading: false })
          
        } catch (error: any) {
          console.error('Failed to load assistants:', error)
          set({ 
            loading: false, 
            error: error.message || '加载助手失败'
          })
          
          // 如果是网络错误或服务器未实现，使用本地示例数据
          if (error.message.includes('fetch') || error.message.includes('404')) {
            const sampleAssistants: Assistant[] = [
              {
                id: 'assistant-1',
                name: 'Claude编程助手',
                description: '专业的编程助手，擅长多种编程语言和软件开发',
                avatar: '👨‍💻',
                type: 'coding',
                model: 'claude-3',
                systemPrompt: '你是一个专业的编程助手，擅长多种编程语言和软件开发最佳实践。你能帮助用户解决编程问题、代码审查、架构设计等。',
                temperature: 0.3,
                maxTokens: 2000,
                isPublic: false,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                userId: 'user-1'
              },
              {
                id: 'assistant-2',
                name: '文案创作师',
                description: '创意写作助手，帮助您创作各种类型的内容',
                avatar: '✍️',
                type: 'writing',
                model: 'gpt-4',
                systemPrompt: '你是一个优秀的写作助手，能够帮助用户创作各种类型的文本内容，包括文章、营销文案、创意故事等。',
                temperature: 0.8,
                maxTokens: 3000,
                isPublic: true,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                userId: 'user-1'
              },
              {
                id: 'assistant-3',
                name: '数据分析师',
                description: '专业的数据分析和洞察助手',
                avatar: '📊',
                type: 'analysis',
                model: 'gemini-pro',
                systemPrompt: '你是一个数据分析专家，擅长解读数据、发现趋势和提供商业洞察。能够帮助用户进行数据分析和决策支持。',
                temperature: 0.4,
                maxTokens: 2500,
                isPublic: false,
                isActive: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                userId: 'user-1'
              }
            ]
            
            set({ assistants: sampleAssistants, loading: false, error: null })
          }
        }
      },

      createAssistant: async (data) => {
        set({ loading: true, error: null })
        
        try {
          const { accessToken } = useAuthStore.getState()
          
          const response = await fetch('/api/assistants', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(data)
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const createdAssistant = await response.json()
          
          const assistant: Assistant = {
            ...createdAssistant,
            createdAt: new Date(createdAssistant.createdAt),
            updatedAt: new Date(createdAssistant.updatedAt)
          }

          set(state => ({ 
            assistants: [...state.assistants, assistant], 
            loading: false 
          }))
          
          return assistant
          
        } catch (error: any) {
          console.error('Failed to create assistant:', error)
          
          // 如果API不可用，创建本地助手
          const assistant: Assistant = {
            ...data,
            id: `assistant-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            userId: 'user-1'
          }
          
          set(state => ({ 
            assistants: [...state.assistants, assistant], 
            loading: false,
            error: null
          }))
          
          return assistant
        }
      },

      updateAssistant: async (id, data) => {
        set({ loading: true, error: null })
        
        try {
          const { accessToken } = useAuthStore.getState()
          
          const response = await fetch(`/api/assistants/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(data)
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const updatedAssistant = await response.json()
          
          set(state => ({
            assistants: state.assistants.map(assistant =>
              assistant.id === id 
                ? { 
                    ...assistant, 
                    ...updatedAssistant, 
                    updatedAt: new Date(updatedAssistant.updatedAt || new Date())
                  }
                : assistant
            ),
            loading: false
          }))
          
        } catch (error: any) {
          console.error('Failed to update assistant:', error)
          
          // 如果API不可用，更新本地数据
          set(state => ({
            assistants: state.assistants.map(assistant =>
              assistant.id === id 
                ? { ...assistant, ...data, updatedAt: new Date() }
                : assistant
            ),
            loading: false,
            error: null
          }))
        }
      },

      deleteAssistant: async (id) => {
        set({ loading: true, error: null })
        
        try {
          const { accessToken } = useAuthStore.getState()
          
          const response = await fetch(`/api/assistants/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          set(state => ({
            assistants: state.assistants.filter(assistant => assistant.id !== id),
            loading: false
          }))
          
        } catch (error: any) {
          console.error('Failed to delete assistant:', error)
          
          // 如果API不可用，删除本地数据
          set(state => ({
            assistants: state.assistants.filter(assistant => assistant.id !== id),
            loading: false,
            error: null
          }))
        }
      },

      toggleAssistant: async (id) => {
        const assistant = get().getAssistantById(id)
        if (!assistant) return

        await get().updateAssistant(id, { isActive: !assistant.isActive })
      },

      clearError: () => {
        set({ error: null })
      },

      // Local helpers
      getAssistantById: (id) => {
        return get().assistants.find(assistant => assistant.id === id)
      },

      getActiveAssistants: () => {
        return get().assistants.filter(assistant => assistant.isActive)
      },

      getAssistantsByType: (type) => {
        return get().assistants.filter(assistant => assistant.type === type)
      }
    }),
    {
      name: 'assistant-storage',
      partialize: (state) => ({
        assistants: state.assistants
      })
    }
  )
)

// 自动初始化
let initialized = false

export const initializeAssistantStore = () => {
  if (initialized) return
  initialized = true

  const store = useAssistantStore.getState()
  
  // 页面加载时自动获取助手列表
  store.loadAssistants()
}