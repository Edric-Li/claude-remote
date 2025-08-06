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

interface ClaudeOutputItem {
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

interface StoreState {
  socket: Socket | null
  connected: boolean
  agents: Agent[]
  selectedAgentId: string | null
  messages: Message[]
  claudeOutput: (string | ClaudeOutputItem)[]
  currentTaskId: string | null
  
  connect: () => void
  disconnect: () => void
  selectAgent: (agentId: string | null) => void
  sendMessage: (content: string) => void
  startClaude: (agentId: string, workingDirectory?: string, initialPrompt?: string) => void
  sendClaudeInput: (agentId: string, taskId: string, input: string) => void
  stopClaude: (agentId: string, taskId: string) => void
}

export const useStore = create<StoreState>((set, get) => ({
  socket: null,
  connected: false,
  agents: [],
  selectedAgentId: null,
  messages: [],
  claudeOutput: [],
  currentTaskId: null,
  
  connect: () => {
    // Prevent multiple connections
    const existingSocket = get().socket
    if (existingSocket && existingSocket.connected) {
      return
    }
    
    const socket = getSocket()
    
    socket.on('connect', () => {
      set({ socket, connected: true })
      // Use callback to receive the response
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
    
    socket.on('disconnect', () => {
      set({ connected: false })
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
    
    // Claude event handlers
    // Removed claude:output handler to avoid duplicate messages
    // All messages are now handled through claude:message event
    
    socket.on('claude:status', (data) => {
      // Claude status update
      if (data.status === 'started') {
        set({ currentTaskId: data.taskId })
      } else if (data.status === 'stopped' || data.status === 'error') {
        set({ currentTaskId: null })
      }
    })
    
    socket.on('claude:message', (data) => {
      // Claude message received
      const { message } = data
      
      // Handle different message types
      if (message.type === 'system' && message.subtype === 'init') {
        // Show initialization info
        set((state) => ({
          claudeOutput: [...state.claudeOutput, {
            type: 'system',
            content: `Claude initialized | Model: ${message.model} | ${message.tools?.length || 0} tools available`,
            timestamp: new Date()
          }]
        }))
      } else if (message.type === 'assistant' && message.message?.content) {
        // Handle assistant messages with multiple content types
        for (const contentItem of message.message.content) {
          if (contentItem.type === 'text' && contentItem.text?.trim()) {
            set((state) => ({
              claudeOutput: [...state.claudeOutput, {
                type: 'assistant',
                content: contentItem.text,
                timestamp: new Date(),
                usage: message.message.usage
              }]
            }))
          } else if (contentItem.type === 'tool_use') {
            set((state) => ({
              claudeOutput: [...state.claudeOutput, {
                type: 'tool',
                content: `Using ${contentItem.name}`,
                details: contentItem.input,
                timestamp: new Date()
              }]
            }))
          }
        }
      } else if (message.type === 'user' && message.message?.content) {
        // Handle tool results
        for (const contentItem of message.message.content) {
          if (contentItem.type === 'tool_result') {
            const preview = contentItem.content?.substring(0, 200) || ''
            set((state) => ({
              claudeOutput: [...state.claudeOutput, {
                type: 'tool-result',
                content: preview + (preview.length < (contentItem.content?.length || 0) ? '...' : ''),
                timestamp: new Date()
              }]
            }))
          }
        }
      } else if (message.type === 'result') {
        // Show detailed stats
        set((state) => ({
          claudeOutput: [...state.claudeOutput, {
            type: 'result',
            content: `Task completed in ${message.duration_ms}ms`,
            stats: {
              duration: message.duration_ms,
              apiTime: message.duration_api_ms,
              turns: message.num_turns,
              totalTokens: message.usage ? message.usage.input_tokens + message.usage.output_tokens : 0,
              cost: message.total_cost_usd || 0
            },
            timestamp: new Date()
          }]
        }))
      }
    })
    
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
  
  sendMessage: (content) => {
    const { socket, selectedAgentId } = get()
    if (!socket || !content.trim()) return
    
    const message: Message = {
      id: Date.now().toString(),
      from: 'web',
      content,
      timestamp: new Date(),
      agentId: selectedAgentId || undefined // Add target agent ID
    }
    
    set((state) => ({
      messages: [...state.messages, message]
    }))
    
    socket.emit('chat:message', {
      to: selectedAgentId,
      content
    })
  },
  
  startClaude: (agentId, workingDirectory, initialPrompt) => {
    const { socket } = get()
    if (!socket) return
    
    const taskId = `task-${Date.now()}`
    set({ claudeOutput: [], currentTaskId: taskId })
    
    socket.emit('claude:start', {
      agentId,
      taskId,
      workingDirectory,
      initialPrompt
    })
  },
  
  sendClaudeInput: (agentId, taskId, input) => {
    const { socket } = get()
    if (!socket) return
    
    socket.emit('claude:input', {
      agentId,
      taskId,
      input
    })
  },
  
  stopClaude: (agentId, taskId) => {
    const { socket } = get()
    if (!socket) return
    
    socket.emit('claude:stop', {
      agentId,
      taskId
    })
  }
}))