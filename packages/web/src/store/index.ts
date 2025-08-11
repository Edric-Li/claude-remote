import { create } from 'zustand'
// 注意：此store已弃用，请使用 http-communication.store.ts
// WebSocket依赖已移除，使用现代HTTP通信
// import type { Socket } from 'socket.io-client'
// import { getSocket, cleanupSocket } from '../lib/socket.js'

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
  socket: any | null // 已弃用，使用http-communication.store.ts
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
    // 注意：此方法已弃用，请使用 http-communication.store.ts 中的 connect()
    console.warn('⚠️ 使用了已弃用的WebSocket store，请迁移到 http-communication.store.ts')
    set({ connectionInitialized: true, connected: false })
  },
  
  disconnect: () => {
    // 已弃用，请使用 http-communication.store.ts 中的 disconnect()
    console.warn('⚠️ 使用了已弃用的WebSocket store disconnect方法')
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