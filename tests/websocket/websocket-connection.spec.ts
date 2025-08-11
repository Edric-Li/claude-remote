/**
 * WebSocket 连接测试
 * 测试基本的 WebSocket 连接功能
 */

import { test, expect } from '@playwright/test'
import { WebSocketTester, MockAgent, TEST_CONFIG, delay } from '../utils/test-helpers'
import * as fs from 'fs/promises'

// 使用保存的认证状态
test.use({ storageState: 'tests/auth/.auth.json' })

test.describe('WebSocket 连接测试', () => {
  let wsTester: WebSocketTester
  let mockAgent: MockAgent
  let authData: any

  test.beforeAll(async () => {
    // 读取认证数据
    const authFile = await fs.readFile('tests/auth/.auth.json', 'utf8')
    authData = JSON.parse(authFile)
  })

  test.beforeEach(async () => {
    wsTester = new WebSocketTester()
    mockAgent = new MockAgent()
  })

  test.afterEach(async () => {
    wsTester?.disconnect()
    mockAgent?.disconnect()
  })

  test('应该能成功建立 WebSocket 连接', async () => {
    // 建立 WebSocket 连接
    await wsTester.connect(authData.accessToken)
    
    expect(wsTester.isConnected()).toBe(true)
    
    // 等待连接确认消息
    const connectedMessage = await wsTester.waitForMessage('connected')
    expect(connectedMessage).toBeTruthy()
    expect(connectedMessage.payload.message).toContain('WebSocket连接已建立')
  })

  test('应该正确处理心跳机制', async () => {
    await wsTester.connect(authData.accessToken)
    
    // 发送心跳
    wsTester.send('heartbeat', { timestamp: new Date().toISOString() })
    
    // 等待心跳响应
    const heartbeatResponse = await wsTester.waitForMessage('heartbeat')
    expect(heartbeatResponse).toBeTruthy()
  })

  test('应该拒绝无效token的连接', async () => {
    let connectionFailed = false
    
    try {
      await wsTester.connect('invalid-token')
    } catch (error) {
      connectionFailed = true
    }
    
    expect(connectionFailed).toBe(true)
    expect(wsTester.isConnected()).toBe(false)
  })

  test('应该能正确处理连接断开', async () => {
    await wsTester.connect(authData.accessToken)
    expect(wsTester.isConnected()).toBe(true)
    
    wsTester.disconnect()
    expect(wsTester.isConnected()).toBe(false)
  })
})