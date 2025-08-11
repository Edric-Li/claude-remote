/**
 * HTTP通信状态管理
 * 替代WebSocket store，使用HTTP + SSE
 */

import { create } from 'zustand'
import { httpClient, type AgentInfo, type Message, type WorkerStatus } from '../lib/http-client'

interface Agent {
  id: string
  name: string
  connectedAt: Date
  status: 'online' | 'offline'
}

interface WorkerOutputItem {
  type: 'user' | 'assistant' | 'tool' | 'tool-result' | 'result' | 'system'
  content: string
  timestamp: Date
  details?: Record<string, unknown>
  usage?: {
    input_tokens: number
    output_tokens: number
  }
  stats?: {
    duration: number
    apiTime: number
    turns: number
    totalTokens: number
    cost: number
  }
}

interface Worker {
  id: string
  agentId: string
  status: 'idle' | 'busy' | 'stopped' | 'error'
  tool?: 'claude' | 'qwcoder'
  taskId?: string
}

interface HttpCommunicationState {
  // 连接状态
  connected: boolean
  connecting: boolean
  connectionInitialized: boolean
  error: string | null

  // Agent管理
  agents: Agent[]
  selectedAgentId: string | null

  // 消息管理
  messages: Message[]

  // Worker管理
  workerOutput: (string | WorkerOutputItem)[]
  currentTaskId: string | null
  workers: Worker[]
  selectedWorkerId: string | null
  selectedTool: 'claude' | 'qwcoder' | null

  // 网络状态
  isOnline: boolean
  lastSyncTime: Date | null

  // Actions
  connect: () => Promise<void>
  disconnect: () => void
  selectAgent: (agentId: string | null) => void
  sendMessage: (content: string, tool?: 'claude' | 'qwcoder') => Promise<void>
  startWorker: (agentId: string, workingDirectory?: string, initialPrompt?: string) => Promise<void>
  sendWorkerInput: (agentId: string, taskId: string, input: string) => Promise<void>
  stopWorker: (agentId: string, taskId: string) => Promise<void>
  selectRandomWorker: (tool: 'claude' | 'qwcoder') => string | null
  setSelectedTool: (tool: 'claude' | 'qwcoder' | null) => void
  refreshAgentList: () => Promise<void>
  clearError: () => void
}

export const useHttpCommunicationStore = create<HttpCommunicationState>((set, get) => ({
  // 初始状态
  connected: false,
  connecting: false,
  connectionInitialized: false,
  error: null,
  agents: [],
  selectedAgentId: null,
  messages: [],
  workerOutput: [],
  currentTaskId: null,
  workers: [],
  selectedWorkerId: null,
  selectedTool: null,
  isOnline: navigator.onLine,
  lastSyncTime: null,

  // 建立连接
  connect: async () => {
    const state = get()
    if (state.connected || state.connecting) {
      return
    }

    set({ connecting: true, connectionInitialized: true, error: null })

    try {
      // 设置事件监听器
      httpClient.on('connect', () => {
        console.log('✅ HTTP客户端已连接')
        set({
          connected: true,
          connecting: false,
          error: null,
          lastSyncTime: new Date()
        })

        // 连接成功后获取Agent列表
        get().refreshAgentList()
      })

      httpClient.on('disconnect', () => {
        console.log('❌ HTTP客户端连接断开')
        set({ connected: false, connecting: false })
      })

      httpClient.on('agent:connected', (data: any) => {
        console.log('📱 Agent已连接:', data)
        set(state => ({
          agents: [
            ...state.agents.filter(a => a.id !== data.agentId),
            {
              id: data.agentId,
              name: data.name,
              connectedAt: new Date(data.connectedAt),
              status: 'online' as const
            }
          ]
        }))
      })

      httpClient.on('agent:disconnected', (data: any) => {
        console.log('📱 Agent已断开:', data)
        set(state => ({
          agents: state.agents.filter(a => a.id !== data.agentId),
          selectedAgentId: state.selectedAgentId === data.agentId ? null : state.selectedAgentId
        }))
      })

      httpClient.on('chat:reply', (data: any) => {
        console.log('💬 收到聊天回复:', data)
        set(state => ({
          messages: [
            ...state.messages,
            {
              id: Date.now().toString(),
              from: 'agent',
              agentId: data.agentId,
              content: data.content,
              timestamp: new Date(data.timestamp)
            }
          ]
        }))
      })

      httpClient.on('worker:message', (data: any) => {
        console.log('🔧 收到Worker消息:', data)
        // 这个事件处理可以在具体组件中进行
      })

      httpClient.on('worker:status', (data: any) => {
        console.log('🔧 Worker状态更新:', data)
        if (data.status === 'started') {
          set({ currentTaskId: data.taskId })
        } else if (
          data.status === 'stopped' ||
          data.status === 'completed' ||
          data.status === 'error'
        ) {
          set({ currentTaskId: null })
        }
      })

      // 监听网络状态变化
      const handleOnline = () => {
        set({ isOnline: true })
        // 网络恢复时重新连接
        if (!get().connected) {
          get().connect()
        }
      }

      const handleOffline = () => {
        set({ isOnline: false })
      }

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      // 建立连接
      await httpClient.connect()
    } catch (error: any) {
      console.error('HTTP客户端连接失败:', error)
      set({
        connecting: false,
        connected: false,
        error: error.message || '连接失败'
      })
    }
  },

  // 断开连接
  disconnect: () => {
    httpClient.disconnect()
    set({
      connected: false,
      connecting: false,
      connectionInitialized: false,
      agents: [],
      messages: [],
      error: null
    })
  },

  // 选择Agent
  selectAgent: agentId => {
    set({ selectedAgentId: agentId })
  },

  // 发送消息
  sendMessage: async (content, tool) => {
    const { selectedAgentId, selectedWorkerId, selectedTool, workers } = get()

    if (!content.trim()) {
      return
    }

    const currentTool = tool || selectedTool
    const targetAgentId = selectedWorkerId
      ? workers.find(w => w.id === selectedWorkerId)?.agentId
      : selectedAgentId

    if (!targetAgentId) {
      throw new Error('请先选择Agent')
    }

    const message: Message = {
      id: Date.now().toString(),
      from: 'web',
      content,
      timestamp: new Date(),
      agentId: targetAgentId
    }

    // 先添加到本地消息列表
    set(state => ({
      messages: [...state.messages, message]
    }))

    try {
      // 发送到服务器
      if (currentTool) {
        await httpClient.sendWorkerMessage(targetAgentId, currentTool, content)
      } else {
        await httpClient.sendChatMessage(targetAgentId, content)
      }
    } catch (error: any) {
      console.error('发送消息失败:', error)
      // 发送失败时，可以选择从消息列表中移除或标记为失败
      set({ error: error.message })
    }
  },

  // 启动Worker
  startWorker: async (agentId, workingDirectory, initialPrompt) => {
    const taskId = `task-${Date.now()}`
    set({ workerOutput: [], currentTaskId: taskId })

    try {
      await httpClient.startWorker(agentId, taskId, {
        workingDirectory,
        initialPrompt
      })
    } catch (error: any) {
      console.error('启动Worker失败:', error)
      set({ error: error.message, currentTaskId: null })
    }
  },

  // 发送Worker输入
  sendWorkerInput: async (agentId, taskId, input) => {
    try {
      await httpClient.sendWorkerInput(agentId, taskId, input)
    } catch (error: any) {
      console.error('发送Worker输入失败:', error)
      set({ error: error.message })
    }
  },

  // 停止Worker
  stopWorker: async (agentId, taskId) => {
    try {
      await httpClient.stopWorker(agentId, taskId)
    } catch (error: any) {
      console.error('停止Worker失败:', error)
      set({ error: error.message })
    }
  },

  // 选择随机Worker
  selectRandomWorker: tool => {
    const { agents } = get()

    if (agents.filter(a => a.status === 'online').length === 0) {
      return null
    }

    // 随机选择一个在线的 agent
    const onlineAgents = agents.filter(a => a.status === 'online')
    const randomIndex = Math.floor(Math.random() * onlineAgents.length)
    const selectedAgent = onlineAgents[randomIndex]

    // 创建一个新的 worker
    const workerId = `worker-${Date.now()}`
    const newWorker: Worker = {
      id: workerId,
      agentId: selectedAgent.id,
      status: 'idle',
      tool
    }

    set(state => ({
      workers: [...state.workers, newWorker],
      selectedWorkerId: workerId,
      selectedAgentId: selectedAgent.id,
      selectedTool: tool
    }))

    return workerId
  },

  // 设置选中的工具
  setSelectedTool: tool => {
    set({ selectedTool: tool })
  },

  // 刷新Agent列表
  refreshAgentList: async () => {
    try {
      const agentList = await httpClient.getAgentList()
      set({
        agents: agentList,
        lastSyncTime: new Date(),
        error: null
      })
    } catch (error: any) {
      console.error('获取Agent列表失败:', error)
      set({ error: error.message })
    }
  },

  // 清除错误
  clearError: () => {
    set({ error: null })
  }
}))

// 自动连接和清理
let autoConnectCalled = false

export function initializeHttpCommunication() {
  if (autoConnectCalled) return
  autoConnectCalled = true

  const store = useHttpCommunicationStore.getState()

  // 页面加载时自动连接
  store.connect()

  // 页面卸载时断开连接
  window.addEventListener('beforeunload', () => {
    store.disconnect()
  })

  // 定期检查连接状态
  setInterval(() => {
    const currentState = useHttpCommunicationStore.getState()
    if (!currentState.connected && currentState.isOnline && !currentState.connecting) {
      console.log('🔄 检测到连接断开，尝试重新连接...')
      currentState.connect()
    }
  }, 30000) // 每30秒检查一次
}
