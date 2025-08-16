/**
 * WebSocket 通信客户端
 * 使用 Socket.IO 与后端通信
 */

import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/auth.store'

export interface AgentInfo {
  id: string
  name: string
  connectedAt: Date
  status: 'online' | 'offline'
}

export interface Message {
  id: string
  from: 'web' | 'agent'
  agentId?: string
  content: string
  timestamp: Date
}

export interface WorkerStatus {
  id: string
  agentId: string
  taskId?: string
  status: 'idle' | 'busy' | 'stopped' | 'error'
  tool?: 'claude' | 'qwcoder'
}

export interface ConversationState {
  sessionId: string
  messages: any[]
  metadata?: Record<string, any>
}

export interface WebSocketEventCallbacks {
  onConversationStateUpdated?: (data: ConversationState) => void
  onConversationStateUpdateFailed?: (error: string) => void
}

// WebSocket客户端配置
const BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://localhost:${import.meta.env.VITE_API_PORT || 3000}`
const WS_RECONNECT_INTERVAL = 3000
const WS_MAX_RECONNECT_ATTEMPTS = 10

// 对话事件类型
const CONVERSATION_EVENTS = {
  STATE_UPDATE: 'conversation:state_update',
  STATE_UPDATE_ACK: 'conversation:state_update_ack',
  STATE_UPDATE_FAILED: 'conversation:state_update_failed',
  STATE_UPDATED: 'conversation:state_updated'
} as const

/**
 * WebSocket通信客户端类
 */
export class WebSocketCommunicationClient {
  private socket: Socket | null = null
  private listeners: Map<string, Set<Function>> = new Map()
  private connected = false
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = WS_MAX_RECONNECT_ATTEMPTS
  private reconnectTimeout: number | null = null
  private heartbeatInterval: number | null = null
  private lastHeartbeat: Date | null = null

  constructor() {
    // 监听页面可见性变化，优化性能
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseHeartbeat()
      } else {
        this.resumeHeartbeat()
      }
    })

    // 监听网络状态变化
    window.addEventListener('online', this.handleNetworkOnline.bind(this))
    window.addEventListener('offline', this.handleNetworkOffline.bind(this))
  }

  /**
   * 建立 Socket.IO 连接
   */
  async connect(): Promise<void> {
    if (this.socket && this.socket.connected) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Socket.IO 连接已存在，跳过重复连接')
      }
      return
    }

    const { accessToken } = useAuthStore.getState()
    const serverUrl = this.getServerUrl()
    
    try {
      this.socket = io(serverUrl, {
        transports: ['polling', 'websocket'],
        autoConnect: false,
        forceNew: true,
        upgrade: true,
        auth: {
          token: accessToken || process.env.NODE_ENV === 'development' ? 'dev-token' : undefined
        }
      })
      this.setupEventHandlers()
      this.socket.connect()
      this.reconnectAttempts = 0
    } catch (error) {
      console.error('Socket.IO 连接创建失败:', error)
      this.scheduleReconnect()
    }
  }

  /**
   * 获取服务器 URL
   */
  private getServerUrl(): string {
    return BASE_URL || `http://localhost:${import.meta.env.VITE_API_PORT || 3000}`
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('✅ Socket.IO 连接已建立')
      this.connected = true
      this.reconnectAttempts = 0
      this.startHeartbeat()
      this.emit('connect')
    })

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO 连接断开:', reason)
      this.connected = false
      this.stopHeartbeat()
      this.emit('disconnect')
      
      // 如果不是手动断开，尝试重连
      if (reason !== 'io client disconnect') {
        this.scheduleReconnect()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO 连接错误:', error)
      this.connected = false
    })

    // 监听所有服务器消息
    this.socket.onAny((eventName, ...args) => {
      if (eventName === 'connect' || eventName === 'disconnect' || eventName === 'connect_error') {
        return // 这些事件已经单独处理
      }
      
      // 处理其他消息
      this.handleServerMessage({ type: eventName, payload: args[0] })
    })
  }

  /**
   * 处理服务器消息
   */
  private handleServerMessage(data: any): void {
    const { type, payload } = data

    // 处理心跳响应
    if (type === 'heartbeat') {
      this.lastHeartbeat = new Date()
      return
    }

    // 处理连接确认
    if (type === 'connected') {
      if (process.env.NODE_ENV === 'development') {
        console.log('WebSocket 连接确认:', payload.message)
      }
      return
    }

    // 处理对话事件
    this.handleConversationEvents(type, payload)

    // 分发其他事件
    this.emit(type, payload)
  }

  /**
   * 处理对话相关事件
   */
  private handleConversationEvents(type: string, payload: any): void {
    switch (type) {
      case CONVERSATION_EVENTS.STATE_UPDATE_ACK:
        if (process.env.NODE_ENV === 'development') {
          console.log('对话状态更新确认:', payload)
        }
        break
      case CONVERSATION_EVENTS.STATE_UPDATE_FAILED:
        console.error('对话状态更新失败:', payload)
        this.emit('conversation_update_failed', payload.error || '更新失败')
        break
      case CONVERSATION_EVENTS.STATE_UPDATED:
        if (process.env.NODE_ENV === 'development') {
          console.log('对话状态已更新:', payload)
        }
        this.emit('conversation_state_updated', payload)
        break
    }
  }

  /**
   * 发送消息到服务器
   */
  private send(type: string, payload: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(type, payload)
    } else {
      console.warn('Socket.IO 未连接，无法发送消息:', type)
      throw new Error('Socket.IO 连接未建立')
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    this.stopHeartbeat()

    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    this.connected = false
    this.listeners.clear()
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('WebSocket 重连次数已达上限，停止重连')
      this.emit('reconnect_failed')
      return
    }

    const delay = WS_RECONNECT_INTERVAL * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++

    console.log(`🔄 WebSocket 将在 ${delay}ms 后进行第 ${this.reconnectAttempts} 次重连`)

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect().catch((error) => {
        console.error('WebSocket 重连失败:', error)
      })
    }, delay)
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatInterval = window.setInterval(() => {
      if (this.connected) {
        this.send('heartbeat', { timestamp: new Date().toISOString() })
      }
    }, 30000) // 每30秒发送心跳
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * 暂停心跳（页面隐藏时）
   */
  private pauseHeartbeat(): void {
    this.stopHeartbeat()
  }

  /**
   * 恢复心跳（页面显示时）
   */
  private resumeHeartbeat(): void {
    if (this.connected) {
      this.startHeartbeat()
    }
  }

  /**
   * 处理网络连接恢复
   */
  private handleNetworkOnline(): void {
    console.log('🌐 网络连接恢复，尝试重连 WebSocket')
    if (!this.connected) {
      this.connect().catch(console.error)
    }
  }

  /**
   * 处理网络连接断开
   */
  private handleNetworkOffline(): void {
    console.log('🌐 网络连接断开')
    this.emit('network_offline')
  }

  /**
   * 事件监听
   */
  on(eventType: string, listener: Function): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(listener)
  }

  /**
   * 移除事件监听
   */
  off(eventType: string, listener: Function): void {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.listeners.delete(eventType)
      }
    }
  }

  /**
   * 发送事件
   */
  private emit(eventType: string, data?: any): void {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data)
        } catch (error) {
          console.error(`事件监听器执行失败: ${eventType}`, error)
        }
      })
    }
  }

  // ===== 业务方法 =====

  /**
   * 获取 Agent 列表
   */
  async getAgentList(): Promise<AgentInfo[]> {
    // 通过 HTTP API 获取，因为这是一次性数据请求
    const { accessToken } = useAuthStore.getState()
    if (!accessToken && process.env.NODE_ENV !== 'development') {
      throw new Error('未授权：缺少访问令牌')
    }
    
    const response = await fetch(`${BASE_URL}/api/agents`, {
      headers: {
        'Authorization': `Bearer ${accessToken || 'dev-token'}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('获取 Agent 列表失败')
    }

    return response.json()
  }

  /**
   * 发送聊天消息
   */
  async sendChatMessage(agentId: string, content: string): Promise<void> {
    this.send('chat:message', {
      to: agentId,
      content
    })
  }

  /**
   * 发送 Claude 命令
   */
  async sendClaudeCommand(command: string, options: any = {}): Promise<void> {
    this.send('claude:command', {
      command,
      options,
      sessionId: options.sessionId
    })
  }

  /**
   * 终止 Claude 会话
   */
  async abortClaudeSession(sessionId: string): Promise<void> {
    this.send('claude:abort', {
      sessionId
    })
  }

  /**
   * 启动 Worker
   */
  async startWorker(agentId: string, taskId: string, options?: {
    workingDirectory?: string
    initialPrompt?: string
    sessionId?: string
    claudeSessionId?: string
    repositoryId?: string
    repositoryName?: string
    model?: string
  }): Promise<void> {
    this.send('worker:start', {
      agentId,
      taskId,
      ...options
    })
  }

  /**
   * 发送 Worker 输入
   */
  async sendWorkerInput(agentId: string, taskId: string, input: string): Promise<void> {
    this.send('worker:input', {
      agentId,
      taskId,
      input
    })
  }

  /**
   * 停止 Worker
   */
  async stopWorker(agentId: string, taskId: string): Promise<void> {
    this.send('worker:stop', {
      agentId,
      taskId
    })
  }

  /**
   * 发送 Worker 消息
   */
  async sendWorkerMessage(agentId: string, tool: string, content: string): Promise<void> {
    this.send('worker:input', {
      agentId,
      tool,
      input: content
    })
  }

  /**
   * 发送对话状态更新
   */
  updateConversationState(sessionId: string, conversationState: ConversationState): void {
    this.send(CONVERSATION_EVENTS.STATE_UPDATE, {
      sessionId,
      conversationState
    })
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * 获取连接详情
   */
  getConnectionInfo(): {
    connected: boolean
    reconnectAttempts: number
    lastHeartbeat: Date | null
  } {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeat
    }
  }

  /**
   * 设置对话事件回调函数
   */
  setConversationCallbacks(callbacks: WebSocketEventCallbacks): void {
    if (callbacks.onConversationStateUpdated) {
      this.on('conversation_state_updated', callbacks.onConversationStateUpdated)
    }
    if (callbacks.onConversationStateUpdateFailed) {
      this.on('conversation_update_failed', callbacks.onConversationStateUpdateFailed)
    }
  }

  /**
   * 移除对话事件回调函数
   */
  removeConversationCallbacks(callbacks: WebSocketEventCallbacks): void {
    if (callbacks.onConversationStateUpdated) {
      this.off('conversation_state_updated', callbacks.onConversationStateUpdated)
    }
    if (callbacks.onConversationStateUpdateFailed) {
      this.off('conversation_update_failed', callbacks.onConversationStateUpdateFailed)
    }
  }
}

// 导出单例实例
export const webSocketClient = new WebSocketCommunicationClient()