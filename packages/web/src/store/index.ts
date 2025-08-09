import { create } from 'zustand'
import type { Socket } from 'socket.io-client'
import { getSocket, cleanupSocket } from '../lib/socket.js'

interface Agent {
  id: string
  name: string
  connectedAt: Date
}

interface Message {
  id: string
  from: 'web' | 'agent'
  agentId?: string
  content: string
  timestamp: Date
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
  status: 'idle' | 'busy'
  tool?: 'claude' | 'qwcoder'
}

interface StoreState {
  socket: Socket | null
  connected: boolean
  connectionInitialized: boolean  // Add this to track if connection attempt has been made
  agents: Agent[]
  selectedAgentId: string | null
  messages: Message[]
  workerOutput: (string | WorkerOutputItem)[]
  currentTaskId: string | null
  workers: Worker[]
  selectedWorkerId: string | null
  selectedTool: 'claude' | 'qwcoder' | null
  
  connect: () => void
  disconnect: () => void
  selectAgent: (agentId: string | null) => void
  sendMessage: (content: string, tool?: 'claude' | 'qwcoder') => void
  startWorker: (agentId: string, workingDirectory?: string, initialPrompt?: string) => void
  sendWorkerInput: (agentId: string, taskId: string, input: string) => void
  stopWorker: (agentId: string, taskId: string) => void
  selectRandomWorker: (tool: 'claude' | 'qwcoder') => string | null
  setSelectedTool: (tool: 'claude' | 'qwcoder' | null) => void
}

export const useStore = create<StoreState>((set, get) => ({
  socket: null,
  connected: false,
  connectionInitialized: false,
  agents: [],
  selectedAgentId: null,
  messages: [],
  workerOutput: [],
  currentTaskId: null,
  workers: [],
  selectedWorkerId: null,
  selectedTool: null,
  
  connect: () => {
    // Mark as initialized immediately to prevent UI flashing
    set({ connectionInitialized: true })
    
    // Prevent multiple connections
    const existingSocket = get().socket
    if (existingSocket && existingSocket.connected) {
      return
    }
    
    const socket = getSocket()
    
    // 在开发环境暴露socket到全局，方便调试
    if (import.meta.env.DEV) {
      (window as any).__socket = socket
      console.log('🔍 WebSocket已暴露到 window.__socket，可在控制台调试')
    }
    
    socket.on('connect', () => {
      console.log('✅ WebSocket已连接')
      set({ socket, connected: true, connectionInitialized: true })
      // Use callback to receive the response
      socket.emit('agent:list', (response: { agents: any[] }) => {
        console.log('📋 Agent列表:', response)
        if (response && response.agents) {
          try {
            set({
              agents: response.agents.map((a) => ({
                ...a,
                connectedAt: new Date(a.connectedAt)
              }))
            })
          } catch (error) {
            console.error('Failed to process agent list:', error)
          }
        }
      })
    })
    
    socket.on('disconnect', () => {
      set({ connected: false, connectionInitialized: true })
    })
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message)
      set({ connected: false, connectionInitialized: true })
    })
    
    socket.on('reconnect', (attemptNumber) => {
      console.info(`Socket reconnected after ${attemptNumber} attempts`)
      set({ connected: true })
      // Request agent list after reconnection
      socket.emit('agent:list', (response: { agents: any[] }) => {
        if (response && response.agents) {
          try {
            set({
              agents: response.agents.map((a) => ({
                ...a,
                connectedAt: new Date(a.connectedAt)
              }))
            })
          } catch (error) {
            console.error('Failed to process agent list:', error)
          }
        }
      })
    })
    
    socket.on('agent:connected', (data) => {
      set((state) => ({
        agents: [...state.agents, {
          id: data.agentId,
          name: data.name,
          connectedAt: new Date(data.connectedAt)
        }]
      }))
    })
    
    socket.on('agent:disconnected', (data) => {
      set((state) => ({
        agents: state.agents.filter(a => a.id !== data.agentId),
        selectedAgentId: state.selectedAgentId === data.agentId ? null : state.selectedAgentId
      }))
    })
    
    socket.on('agent:list', (data) => {
      set({
        agents: data.agents.map((a: any) => ({
          ...a,
          connectedAt: new Date(a.connectedAt)
        }))
      })
    })
    
    socket.on('chat:reply', (data) => {
      // Chat reply received from agent
      set((state) => ({
        messages: [...state.messages, {
          id: Date.now().toString(),
          from: 'agent',
          agentId: data.agentId,
          content: data.content,
          timestamp: new Date(data.timestamp)
        }]
      }))
    })
    
    // Worker event handlers
    // All messages are handled through worker:message event
    
    socket.on('worker:status', (data) => {
      // Worker status update
      if (data.status === 'started') {
        set({ currentTaskId: data.taskId })
      } else if (data.status === 'stopped' || data.status === 'completed' || data.status === 'error') {
        set({ currentTaskId: null })
      }
    })
    
    // NOTE: worker:message 监听器已移至 NewSimplifiedChatPanel 组件中处理
    // 避免重复监听导致的消息重复问题
    
    // Connect the socket
    socket.connect()
  },
  
  disconnect: () => {
    cleanupSocket()
    set({ socket: null, connected: false, agents: [], messages: [] })
  },
  
  selectAgent: (agentId) => {
    set({ selectedAgentId: agentId })
  },
  
  sendMessage: (content, tool) => {
    const { socket, selectedAgentId, selectedWorkerId, selectedTool } = get()
    
    if (!socket || !content.trim()) {
      return
    }
    
    const currentTool = tool || selectedTool
    const targetAgentId = selectedWorkerId ? 
      get().workers.find(w => w.id === selectedWorkerId)?.agentId : 
      selectedAgentId
    
    const message: Message = {
      id: Date.now().toString(),
      from: 'web',
      content,
      timestamp: new Date(),
      agentId: targetAgentId || undefined
    }
    
    set((state) => ({
      messages: [...state.messages, message]
    }))
    
    // 如果选择了工具，发送到对应的 worker
    if (currentTool) {
      socket.emit('worker:message', {
        agentId: targetAgentId,
        tool: currentTool,
        content
      })
    } else {
      socket.emit('chat:message', {
        to: targetAgentId,
        content
      })
    }
  },
  
  startWorker: (agentId, workingDirectory, initialPrompt) => {
    const { socket } = get()
    if (!socket) return
    
    const taskId = `task-${Date.now()}`
    set({ workerOutput: [], currentTaskId: taskId })
    
    socket.emit('worker:start', {
      agentId,
      taskId,
      workingDirectory,
      initialPrompt
    })
  },
  
  sendWorkerInput: (agentId, taskId, input) => {
    const { socket } = get()
    if (!socket) return
    
    socket.emit('worker:input', {
      agentId,
      taskId,
      input
    })
  },
  
  stopWorker: (agentId, taskId) => {
    const { socket } = get()
    if (!socket) return
    
    socket.emit('worker:stop', {
      agentId,
      taskId
    })
  },
  
  selectRandomWorker: (tool) => {
    const { agents } = get()
    
    // 如果没有可用的 agent，返回 null
    if (agents.length === 0) {
      return null
    }
    
    // 随机选择一个 agent
    const randomIndex = Math.floor(Math.random() * agents.length)
    const selectedAgent = agents[randomIndex]
    
    // 创建一个新的 worker
    const workerId = `worker-${Date.now()}`
    const newWorker: Worker = {
      id: workerId,
      agentId: selectedAgent.id,
      status: 'idle',
      tool
    }
    
    set((state) => ({
      workers: [...state.workers, newWorker],
      selectedWorkerId: workerId,
      selectedAgentId: selectedAgent.id,
      selectedTool: tool
    }))
    
    return workerId
  },
  
  setSelectedTool: (tool) => {
    set({ selectedTool: tool })
  }
}))