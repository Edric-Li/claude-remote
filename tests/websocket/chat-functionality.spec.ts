/**
 * WebSocket 聊天功能测试
 * 测试前端-服务端-Agent 的聊天通信
 */

import { test, expect } from '@playwright/test'
import { WebSocketTester, MockAgent, TEST_CONFIG, delay } from '../utils/test-helpers'
import * as fs from 'fs/promises'

test.use({ storageState: 'tests/auth/.auth.json' })

test.describe('WebSocket 聊天功能测试', () => {
  let wsTester: WebSocketTester
  let mockAgent: MockAgent
  let authData: any

  test.beforeAll(async () => {
    const authFile = await fs.readFile('tests/auth/.auth.json', 'utf8')
    authData = JSON.parse(authFile)
  })

  test.beforeEach(async () => {
    wsTester = new WebSocketTester()
    mockAgent = new MockAgent(`test-agent-${Date.now()}`, 'Test Chat Agent')
    
    // 建立连接
    await wsTester.connect(authData.accessToken)
    await mockAgent.connect()
    
    // 等待 Agent 注册完成
    await delay(1000)
  })

  test.afterEach(async () => {
    wsTester?.disconnect()
    mockAgent?.disconnect()
  })

  test('前端应能接收到 Agent 连接事件', async () => {
    // 清空之前的消息
    wsTester.clearMessages()
    
    // 创建新的 Mock Agent
    const newAgent = new MockAgent(`new-agent-${Date.now()}`, 'New Agent')
    await newAgent.connect()
    
    // 等待前端接收到 Agent 连接事件
    const agentConnectedMessage = await wsTester.waitForMessage('agent:connected')
    expect(agentConnectedMessage).toBeTruthy()
    expect(agentConnectedMessage.payload.name).toBe('New Agent')
    
    newAgent.disconnect()
  })

  test('前端应能接收到 Agent 断开事件', async () => {
    wsTester.clearMessages()
    
    // 获取当前 Agent ID
    const agentId = mockAgent['agentId']
    
    // 断开 Mock Agent
    mockAgent.disconnect()
    
    // 等待前端接收到 Agent 断开事件
    const agentDisconnectedMessage = await wsTester.waitForMessage('agent:disconnected')
    expect(agentDisconnectedMessage).toBeTruthy()
    expect(agentDisconnectedMessage.payload.agentId).toBe(agentId)
  })

  test('应该能发送聊天消息到 Agent', async () => {
    const testMessage = 'Hello from WebSocket test!'
    const agentId = mockAgent['agentId']
    
    // 设置 Agent 消息处理器
    let receivedMessage: any = null
    mockAgent.on('chat:message', (data: any) => {
      receivedMessage = data
    })
    
    // 发送聊天消息
    wsTester.send('chat:message', {
      to: agentId,
      content: testMessage
    })
    
    // 等待 Agent 接收消息
    await delay(1000)
    
    expect(receivedMessage).toBeTruthy()
    expect(receivedMessage.content).toBe(testMessage)
    expect(receivedMessage.agentId).toBe(agentId)
  })

  test('应该能接收来自 Agent 的聊天回复', async () => {
    const replyMessage = 'Hello from Agent!'
    
    // Agent 发送回复
    mockAgent.sendChatReply(replyMessage)
    
    // 等待前端接收到回复
    const chatReplyMessage = await wsTester.waitForMessage('chat:reply')
    expect(chatReplyMessage).toBeTruthy()
    expect(chatReplyMessage.payload.content).toBe(replyMessage)
    expect(chatReplyMessage.payload.agentId).toBe(mockAgent['agentId'])
  })

  test('应该能处理广播消息到所有 Agents', async () => {
    const broadcastMessage = 'Broadcast message to all agents'
    
    // 创建多个 Mock Agents
    const agents = [
      new MockAgent('agent-1', 'Agent 1'),
      new MockAgent('agent-2', 'Agent 2')
    ]
    
    // 连接所有 Agents
    for (const agent of agents) {
      await agent.connect()
    }
    
    await delay(1000)
    
    // 设置消息处理器
    const receivedMessages: any[] = []
    agents.forEach(agent => {
      agent.on('chat:message', (data: any) => {
        receivedMessages.push({ agentId: agent['agentId'], data })
      })
    })
    
    // 发送广播消息（不指定目标 Agent）
    wsTester.send('chat:message', {
      content: broadcastMessage
    })
    
    // 等待所有 Agents 接收消息
    await delay(2000)
    
    expect(receivedMessages.length).toBeGreaterThanOrEqual(2)
    receivedMessages.forEach(msg => {
      expect(msg.data.content).toBe(broadcastMessage)
    })
    
    // 清理
    agents.forEach(agent => agent.disconnect())
  })

  test('应该正确处理聊天消息的时间戳', async () => {
    const testMessage = 'Timestamped message'
    const beforeSend = new Date()
    
    // Agent 发送消息
    mockAgent.sendChatReply(testMessage)
    
    // 接收消息
    const chatReplyMessage = await wsTester.waitForMessage('chat:reply')
    const afterReceive = new Date()
    const messageTime = new Date(chatReplyMessage.payload.timestamp)
    
    // 验证时间戳合理性
    expect(messageTime.getTime()).toBeGreaterThanOrEqual(beforeSend.getTime())
    expect(messageTime.getTime()).toBeLessThanOrEqual(afterReceive.getTime())
  })
})