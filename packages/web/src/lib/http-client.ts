/**
 * 现代化HTTP通信客户端
 * 替代WebSocket，使用SSE + REST API + 长轮询
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

// HTTP客户端配置
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const SSE_RECONNECT_INTERVAL = 3000
const POLLING_INTERVAL = 2000

/**
 * 认证HTTP请求封装
 */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken } = useAuthStore.getState()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {})
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers
  })

  // 处理认证过期
  if (response.status === 401) {
    const { refreshAccessToken, logout } = useAuthStore.getState()
    try {
      await refreshAccessToken()
      // 重试请求
      const retryHeaders: Record<string, string> = { ...headers }
      const newToken = useAuthStore.getState().accessToken
      if (newToken) {
        retryHeaders['Authorization'] = `Bearer ${newToken}`
      }
      return fetch(`${BASE_URL}${url}`, {
        ...options,
        headers: retryHeaders
      })
    } catch (error) {
      logout()
      throw new Error('认证失败，请重新登录')
    }
  }

  return response
}

/**
 * HTTP通信客户端类
 */
export class HttpCommunicationClient {
  private eventSource: EventSource | null = null
  private pollingInterval: number | null = null
  private listeners: Map<string, Set<Function>> = new Map()
  private connected = false
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 10

  constructor() {
    // 监听页面可见性变化，优化性能
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseRealTimeUpdates()
      } else {
        this.resumeRealTimeUpdates()
      }
    })
  }

  /**
   * 建立连接 - 优先使用SSE，降级到长轮询
   */
  async connect(): Promise<void> {
    try {
      await this.connectSSE()
    } catch (error) {
      console.warn('SSE连接失败，降级到长轮询:', error)
      this.startPolling()
    }
  }

  /**
   * 建立SSE连接
   */
  private async connectSSE(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close()
    }

    const { accessToken } = useAuthStore.getState()
    const sseUrl = `${BASE_URL}/api/events/stream?token=${encodeURIComponent(accessToken || '')}`

    this.eventSource = new EventSource(sseUrl)

    this.eventSource.onopen = () => {
      console.log('✅ SSE连接已建立')
      this.connected = true
      this.reconnectAttempts = 0
      this.emit('connect')
    }

    this.eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data)
        this.handleServerMessage(data)
      } catch (error) {
        console.error('SSE消息解析失败:', error)
      }
    }

    this.eventSource.onerror = error => {
      console.error('SSE连接错误:', error)
      this.connected = false
      this.emit('disconnect')

      // 自动重连
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(
          () => {
            this.reconnectAttempts++
            console.log(`🔄 SSE重连尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
            this.connectSSE()
          },
          SSE_RECONNECT_INTERVAL * Math.pow(2, this.reconnectAttempts)
        )
      } else {
        console.warn('SSE重连失败，切换到长轮询')
        this.startPolling()
      }
    }

    // 监听特定事件类型
    this.eventSource.addEventListener('agent:connected', (event: any) => {
      const data = JSON.parse(event.data)
      this.emit('agent:connected', data)
    })

    this.eventSource.addEventListener('agent:disconnected', (event: any) => {
      const data = JSON.parse(event.data)
      this.emit('agent:disconnected', data)
    })

    this.eventSource.addEventListener('chat:reply', (event: any) => {
      const data = JSON.parse(event.data)
      this.emit('chat:reply', data)
    })

    this.eventSource.addEventListener('worker:message', (event: any) => {
      const data = JSON.parse(event.data)
      this.emit('worker:message', data)
    })

    this.eventSource.addEventListener('worker:status', (event: any) => {
      const data = JSON.parse(event.data)
      this.emit('worker:status', data)
    })
  }

  /**
   * 启动长轮询作为降级方案
   */
  private startPolling(): void {
    this.stopPolling()

    const poll = async () => {
      try {
        const response = await authFetch('/api/events/poll')
        if (response.ok) {
          const events = await response.json()
          events.forEach((event: any) => {
            this.handleServerMessage(event)
          })

          if (!this.connected) {
            this.connected = true
            this.emit('connect')
          }
        }
      } catch (error) {
        console.error('长轮询错误:', error)
        if (this.connected) {
          this.connected = false
          this.emit('disconnect')
        }
      } finally {
        // 继续下次轮询
        this.pollingInterval = window.setTimeout(poll, POLLING_INTERVAL)
      }
    }

    poll()
  }

  /**
   * 停止长轮询
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  /**
   * 处理服务器消息
   */
  private handleServerMessage(data: any): void {
    const { type, payload } = data
    this.emit(type, payload)
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.stopPolling()
    this.connected = false
    this.listeners.clear()
    this.emit('disconnect')
  }

  /**
   * 暂停实时更新（页面隐藏时）
   */
  private pauseRealTimeUpdates(): void {
    if (this.eventSource) {
      this.eventSource.close()
    }
    this.stopPolling()
  }

  /**
   * 恢复实时更新（页面显示时）
   */
  private resumeRealTimeUpdates(): void {
    if (!this.connected) {
      this.connect()
    }
  }

  /**
   * 事件监听
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  /**
   * 移除事件监听
   */
  off(event: string, callback?: Function): void {
    if (!this.listeners.has(event)) return

    if (callback) {
      this.listeners.get(event)!.delete(callback)
    } else {
      this.listeners.delete(event)
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`事件处理错误 [${event}]:`, error)
        }
      })
    }
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.connected
  }

  // ========== API 方法 ==========

  /**
   * 获取Agent列表
   */
  async getAgentList(): Promise<AgentInfo[]> {
    const response = await authFetch('/api/agents')
    if (!response.ok) {
      throw new Error('获取Agent列表失败')
    }
    const data = await response.json()
    return data.map((agent: any) => ({
      ...agent,
      connectedAt: new Date(agent.connectedAt)
    }))
  }

  /**
   * 发送聊天消息
   */
  async sendChatMessage(agentId: string, content: string): Promise<void> {
    const response = await authFetch('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({
        to: agentId,
        content
      })
    })

    if (!response.ok) {
      throw new Error('发送消息失败')
    }
  }

  /**
   * 启动Worker
   */
  async startWorker(
    agentId: string,
    taskId: string,
    options?: {
      workingDirectory?: string
      initialPrompt?: string
      tool?: 'claude' | 'qwcoder'
    }
  ): Promise<void> {
    const response = await authFetch('/api/workers/start', {
      method: 'POST',
      body: JSON.stringify({
        agentId,
        taskId,
        ...options
      })
    })

    if (!response.ok) {
      throw new Error('启动Worker失败')
    }
  }

  /**
   * 发送Worker消息
   */
  async sendWorkerMessage(
    agentId: string,
    tool: 'claude' | 'qwcoder',
    content: string
  ): Promise<void> {
    const response = await authFetch('/api/workers/message', {
      method: 'POST',
      body: JSON.stringify({
        agentId,
        tool,
        content
      })
    })

    if (!response.ok) {
      throw new Error('发送Worker消息失败')
    }
  }

  /**
   * 发送Worker输入
   */
  async sendWorkerInput(agentId: string, taskId: string, input: string): Promise<void> {
    const response = await authFetch('/api/workers/input', {
      method: 'POST',
      body: JSON.stringify({
        agentId,
        taskId,
        input
      })
    })

    if (!response.ok) {
      throw new Error('发送Worker输入失败')
    }
  }

  /**
   * 停止Worker
   */
  async stopWorker(agentId: string, taskId: string): Promise<void> {
    const response = await authFetch('/api/workers/stop', {
      method: 'POST',
      body: JSON.stringify({
        agentId,
        taskId
      })
    })

    if (!response.ok) {
      throw new Error('停止Worker失败')
    }
  }

  /**
   * 获取Worker状态
   */
  async getWorkerStatus(agentId: string): Promise<WorkerStatus[]> {
    const response = await authFetch(`/api/workers/status/${agentId}`)
    if (!response.ok) {
      throw new Error('获取Worker状态失败')
    }
    return response.json()
  }
}

// 单例实例
export const httpClient = new HttpCommunicationClient()

// 兼容性检查
export function checkHttpClientSupport(): {
  sse: boolean
  fetch: boolean
  eventSource: boolean
} {
  return {
    sse: typeof EventSource !== 'undefined',
    fetch: typeof fetch !== 'undefined',
    eventSource: typeof EventSource !== 'undefined'
  }
}
