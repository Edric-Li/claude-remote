/**
 * WebSocket 通信客户端
 * 替代 HTTP + SSE，使用原生 WebSocket
 */

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

// WebSocket客户端配置
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const WS_RECONNECT_INTERVAL = 3000
const WS_MAX_RECONNECT_ATTEMPTS = 10

/**
 * WebSocket通信客户端类
 */
export class WebSocketCommunicationClient {
  private ws: WebSocket | null = null
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
   * 建立 WebSocket 连接
   */
  async connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket 连接已存在，跳过重复连接')
      return
    }

    const { accessToken } = useAuthStore.getState()
    if (!accessToken) {
      throw new Error('缺少认证token')
    }

    const wsUrl = this.getWebSocketUrl(accessToken)
    
    try {
      this.ws = new WebSocket(wsUrl)
      this.setupEventHandlers()
      this.reconnectAttempts = 0
    } catch (error) {
      console.error('WebSocket 连接创建失败:', error)
      this.scheduleReconnect()
    }
  }

  /**
   * 获取 WebSocket URL
   */
  private getWebSocketUrl(token: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = BASE_URL ? new URL(BASE_URL).host : window.location.host
    return `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.ws) return

    this.ws.onopen = () => {
      console.log('✅ WebSocket 连接已建立')
      this.connected = true
      this.reconnectAttempts = 0
      this.startHeartbeat()
      this.emit('connect')
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleServerMessage(data)
      } catch (error) {
        console.error('WebSocket 消息解析失败:', error)
      }
    }

    this.ws.onclose = (event) => {
      console.log('❌ WebSocket 连接关闭:', event.code, event.reason)
      this.connected = false
      this.stopHeartbeat()
      this.emit('disconnect')
      
      // 如果不是手动关闭，尝试重连
      if (event.code !== 1000) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket 连接错误:', error)
      this.connected = false
    }
  }

  /**
   * 处理服务器消息
   */
  private handleServerMessage(data: any): void {
    const { type, payload, timestamp } = data

    // 处理心跳响应
    if (type === 'heartbeat') {
      this.lastHeartbeat = new Date()
      return
    }

    // 处理连接确认
    if (type === 'connected') {
      console.log('WebSocket 连接确认:', payload.message)
      return
    }

    // 分发其他事件
    this.emit(type, payload)
  }

  /**
   * 发送消息到服务器
   */
  private send(type: string, payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type,
        payload,
        timestamp: new Date().toISOString()
      }
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket 未连接，无法发送消息:', type)
      throw new Error('WebSocket 连接未建立')
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

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect')
      this.ws = null
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
    const response = await fetch(`${BASE_URL}/api/agents`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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
}

// 导出单例实例
export const webSocketClient = new WebSocketCommunicationClient()