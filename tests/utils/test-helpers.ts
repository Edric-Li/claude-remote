/**
 * 测试帮助工具
 * 提供通用的测试功能和模拟器
 */

import { APIRequestContext, expect } from '@playwright/test'
import { WebSocket } from 'ws'

// 测试配置
export const TEST_CONFIG = {
  SERVER_URL: 'http://localhost:3001',
  WS_URL: 'ws://localhost:3001',
  WEB_URL: 'http://localhost:3000',
  TEST_USER: {
    username: 'test-user',
    password: 'test-password-123'
  }
}

/**
 * 等待服务启动
 */
export async function waitForServices(maxAttempts = 30) {
  console.log('⏳ 等待服务启动...')
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // 检查后端服务
      const response = await fetch(`${TEST_CONFIG.SERVER_URL}/api/auth/status`)
      if (response.ok) {
        console.log('✅ 后端服务已启动')
        
        // 额外等待一下确保 WebSocket 服务器也已启动
        await new Promise(resolve => setTimeout(resolve, 2000))
        return true
      }
    } catch (error) {
      // 服务还未启动，继续等待
    }
    
    console.log(`⏳ 等待服务启动... (${i + 1}/${maxAttempts})`)
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  throw new Error('服务启动超时')
}

/**
 * 创建测试用户并获取认证token
 */
export async function createTestUser(request: APIRequestContext) {
  const { username, password } = TEST_CONFIG.TEST_USER

  try {
    // 尝试登录现有用户
    const loginResponse = await request.post(`${TEST_CONFIG.SERVER_URL}/api/auth/login`, {
      data: { username, password }
    })

    if (loginResponse.ok()) {
      const loginData = await loginResponse.json()
      console.log('✅ 使用现有测试用户')
      return {
        username,
        accessToken: loginData.access_token,
        refreshToken: loginData.refresh_token
      }
    }
  } catch (error) {
    console.log('现有用户登录失败，尝试创建新用户')
  }

  // 创建新用户
  const registerResponse = await request.post(`${TEST_CONFIG.SERVER_URL}/api/auth/register`, {
    data: { username, password }
  })

  if (!registerResponse.ok()) {
    const error = await registerResponse.text()
    throw new Error(`用户创建失败: ${error}`)
  }

  const registerData = await registerResponse.json()
  console.log('✅ 测试用户创建成功')

  return {
    username,
    accessToken: registerData.access_token,
    refreshToken: registerData.refresh_token
  }
}

/**
 * Mock Agent 模拟器
 */
export class MockAgent {
  private ws: WebSocket | null = null
  private agentId: string
  private name: string
  private connected = false
  private messageHandlers = new Map<string, Function>()

  constructor(agentId: string = `test-agent-${Date.now()}`, name: string = 'Test Agent') {
    this.agentId = agentId
    this.name = name
  }

  /**
   * 连接到服务器
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${TEST_CONFIG.WS_URL.replace('ws:', 'http:')}`)
        
        this.ws.on('open', () => {
          console.log(`🤖 Mock Agent ${this.agentId} 已连接`)
          this.connected = true
          
          // 注册为 Agent
          this.emit('agent:register', {
            agentId: this.agentId,
            name: this.name
          })
          
          resolve()
        })

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString())
            this.handleMessage(message.type || message.event, message.data || message)
          } catch (error) {
            console.error('消息解析失败:', error)
          }
        })

        this.ws.on('error', (error) => {
          console.error(`Mock Agent 连接错误:`, error)
          reject(error)
        })

        this.ws.on('close', () => {
          console.log(`🤖 Mock Agent ${this.agentId} 已断开`)
          this.connected = false
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  /**
   * 发送消息到服务器
   */
  emit(event: string, data: any): void {
    if (!this.ws || !this.connected) {
      throw new Error('Agent 未连接')
    }

    const message = {
      type: event,
      payload: data,
      timestamp: new Date().toISOString()
    }

    this.ws.send(JSON.stringify(message))
  }

  /**
   * 监听消息
   */
  on(event: string, handler: Function): void {
    this.messageHandlers.set(event, handler)
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(event: string, data: any): void {
    const handler = this.messageHandlers.get(event)
    if (handler) {
      handler(data)
    }

    // 自动处理一些基本事件
    switch (event) {
      case 'chat:message':
        // 自动回复聊天消息
        setTimeout(() => {
          this.emit('chat:reply', {
            agentId: this.agentId,
            content: `这是来自 ${this.name} 的自动回复: ${data.content}`
          })
        }, 100)
        break

      case 'worker:start':
        // 模拟 Worker 启动
        this.emit('worker:status', {
          taskId: data.taskId,
          status: 'started',
          agentId: this.agentId
        })
        break

      case 'worker:input':
        // 模拟 Worker 处理输入
        this.emit('worker:message', {
          taskId: data.taskId,
          message: {
            type: 'assistant',
            content: `处理输入: ${data.input}`
          },
          agentId: this.agentId
        })
        break
    }
  }

  /**
   * 模拟发送聊天回复
   */
  sendChatReply(content: string): void {
    this.emit('chat:reply', {
      agentId: this.agentId,
      content
    })
  }

  /**
   * 模拟 Worker 消息
   */
  sendWorkerMessage(taskId: string, message: any): void {
    this.emit('worker:message', {
      taskId,
      message,
      agentId: this.agentId
    })
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected
  }
}

/**
 * WebSocket 连接测试工具
 */
export class WebSocketTester {
  private ws: WebSocket | null = null
  private messages: any[] = []
  private connected = false

  /**
   * 连接到 WebSocket 服务器
   */
  async connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${TEST_CONFIG.WS_URL}/ws?token=${encodeURIComponent(token)}`)
        
        this.ws.on('open', () => {
          console.log('🔌 WebSocket 测试连接已建立')
          this.connected = true
          resolve()
        })

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString())
            this.messages.push({
              ...message,
              receivedAt: new Date()
            })
          } catch (error) {
            console.error('消息解析失败:', error)
          }
        })

        this.ws.on('error', reject)
        this.ws.on('close', () => {
          this.connected = false
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 发送消息
   */
  send(type: string, payload: any): void {
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket 未连接')
    }

    const message = {
      type,
      payload,
      timestamp: new Date().toISOString()
    }

    this.ws.send(JSON.stringify(message))
  }

  /**
   * 等待特定类型的消息
   */
  async waitForMessage(type: string, timeout = 5000): Promise<any> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      const message = this.messages.find(msg => msg.type === type)
      if (message) {
        return message
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    throw new Error(`等待消息超时: ${type}`)
  }

  /**
   * 获取所有消息
   */
  getMessages(): any[] {
    return [...this.messages]
  }

  /**
   * 清空消息历史
   */
  clearMessages(): void {
    this.messages = []
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected
  }
}

/**
 * 延迟工具
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))