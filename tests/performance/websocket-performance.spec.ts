/**
 * WebSocket 性能测试
 * 测试 WebSocket 在高负载下的性能表现
 */

import { test, expect } from '@playwright/test'
import { WebSocketTester, MockAgent, TEST_CONFIG, delay } from '../utils/test-helpers'
import * as fs from 'fs/promises'

test.use({ storageState: 'tests/auth/.auth.json' })

test.describe('WebSocket 性能测试', () => {
  let authData: any

  test.beforeAll(async () => {
    const authFile = await fs.readFile('tests/auth/.auth.json', 'utf8')
    authData = JSON.parse(authFile)
  })

  test('连接建立性能测试', async () => {
    const connectionTimes: number[] = []
    const testCount = 10

    for (let i = 0; i < testCount; i++) {
      const wsTester = new WebSocketTester()
      
      const startTime = Date.now()
      await wsTester.connect(authData.accessToken)
      const endTime = Date.now()
      
      const connectionTime = endTime - startTime
      connectionTimes.push(connectionTime)
      
      wsTester.disconnect()
      
      // 避免连接过于频繁
      await delay(100)
    }

    // 计算性能指标
    const avgTime = connectionTimes.reduce((a, b) => a + b, 0) / testCount
    const maxTime = Math.max(...connectionTimes)
    const minTime = Math.min(...connectionTimes)

    console.log(`连接建立性能指标:`)
    console.log(`- 平均时间: ${avgTime.toFixed(2)}ms`)
    console.log(`- 最大时间: ${maxTime}ms`)
    console.log(`- 最小时间: ${minTime}ms`)

    // 性能断言
    expect(avgTime).toBeLessThan(1000) // 平均连接时间应小于1秒
    expect(maxTime).toBeLessThan(3000) // 最大连接时间应小于3秒
  })

  test('消息吞吐量测试', async () => {
    const wsTester = new WebSocketTester()
    const mockAgent = new MockAgent('perf-agent', 'Performance Test Agent')

    await wsTester.connect(authData.accessToken)
    await mockAgent.connect()
    await delay(1000)

    const messageCount = 100
    const testMessages = Array.from({ length: messageCount }, (_, i) => 
      `Performance test message ${i + 1}`
    )

    // 测试发送性能
    const sendStartTime = Date.now()
    
    for (const message of testMessages) {
      wsTester.send('chat:message', {
        to: mockAgent['agentId'],
        content: message
      })
    }
    
    const sendEndTime = Date.now()
    const sendDuration = sendEndTime - sendStartTime
    const sendThroughput = (messageCount / sendDuration) * 1000 // 消息/秒

    console.log(`消息发送性能:`)
    console.log(`- 总消息数: ${messageCount}`)
    console.log(`- 发送时间: ${sendDuration}ms`)
    console.log(`- 发送吞吐量: ${sendThroughput.toFixed(2)} 消息/秒`)

    // 等待消息传输完成
    await delay(2000)

    // 测试接收性能
    const receivedMessages: any[] = []
    mockAgent.on('chat:message', (data: any) => {
      receivedMessages.push(data)
    })

    await delay(1000)

    // 性能断言
    expect(sendThroughput).toBeGreaterThan(10) // 发送吞吐量应大于10消息/秒
    expect(receivedMessages.length).toBeGreaterThanOrEqual(messageCount * 0.95) // 至少95%的消息应该被接收

    wsTester.disconnect()
    mockAgent.disconnect()
  })

  test('并发连接测试', async () => {
    const concurrentConnections = 10
    const connections: WebSocketTester[] = []
    const agents: MockAgent[] = []

    try {
      // 创建并发连接
      const connectionPromises = Array.from({ length: concurrentConnections }, async (_, i) => {
        const wsTester = new WebSocketTester()
        const mockAgent = new MockAgent(`concurrent-agent-${i}`, `Agent ${i}`)

        connections.push(wsTester)
        agents.push(mockAgent)

        const startTime = Date.now()
        await wsTester.connect(authData.accessToken)
        await mockAgent.connect()
        const endTime = Date.now()

        return endTime - startTime
      })

      const connectionTimes = await Promise.all(connectionPromises)
      
      // 等待所有连接稳定
      await delay(2000)

      // 验证所有连接都成功
      const connectedCount = connections.filter(conn => conn.isConnected()).length
      const agentConnectedCount = agents.filter(agent => agent.isConnected()).length

      console.log(`并发连接测试结果:`)
      console.log(`- 目标连接数: ${concurrentConnections}`)
      console.log(`- 成功 WebSocket 连接: ${connectedCount}`)
      console.log(`- 成功 Agent 连接: ${agentConnectedCount}`)
      console.log(`- 平均连接时间: ${connectionTimes.reduce((a, b) => a + b, 0) / concurrentConnections}ms`)

      // 性能断言
      expect(connectedCount).toBe(concurrentConnections)
      expect(agentConnectedCount).toBe(concurrentConnections)

      // 测试并发消息传输
      const broadcastMessage = 'Concurrent broadcast test'
      const messagesReceived = new Map<string, any[]>()

      // 设置所有 Agents 的消息处理器
      agents.forEach(agent => {
        messagesReceived.set(agent['agentId'], [])
        agent.on('chat:message', (data: any) => {
          messagesReceived.get(agent['agentId'])!.push(data)
        })
      })

      // 从所有 WebSocket 连接发送消息
      connections.forEach(conn => {
        conn.send('chat:message', { content: broadcastMessage })
      })

      await delay(3000)

      // 验证消息传输
      let totalMessagesReceived = 0
      messagesReceived.forEach(messages => {
        totalMessagesReceived += messages.length
      })

      console.log(`- 发送消息总数: ${concurrentConnections}`)
      console.log(`- 接收消息总数: ${totalMessagesReceived}`)

      // 每个连接的广播消息应该被所有Agents接收
      expect(totalMessagesReceived).toBeGreaterThanOrEqual(concurrentConnections * concurrentConnections * 0.9)

    } finally {
      // 清理所有连接
      connections.forEach(conn => conn.disconnect())
      agents.forEach(agent => agent.disconnect())
    }
  })

  test('长时间连接稳定性测试', async () => {
    const wsTester = new WebSocketTester()
    const mockAgent = new MockAgent('stability-agent', 'Stability Test Agent')

    await wsTester.connect(authData.accessToken)
    await mockAgent.connect()

    const testDuration = 30000 // 30秒
    const heartbeatInterval = 5000 // 每5秒发送一次心跳
    let heartbeatCount = 0
    let messagesReceived = 0

    // 监听心跳响应
    let heartbeatResponses = 0
    const originalMessages = wsTester.getMessages()

    // 定期发送心跳
    const heartbeatTimer = setInterval(() => {
      if (wsTester.isConnected()) {
        wsTester.send('heartbeat', { timestamp: new Date().toISOString() })
        heartbeatCount++
      }
    }, heartbeatInterval)

    // 定期检查连接状态
    const statusCheckTimer = setInterval(() => {
      const messages = wsTester.getMessages()
      messagesReceived = messages.length - originalMessages.length
      heartbeatResponses = messages.filter(msg => msg.type === 'heartbeat').length
    }, 1000)

    // 等待测试完成
    await delay(testDuration)

    clearInterval(heartbeatTimer)
    clearInterval(statusCheckTimer)

    // 最终统计
    const finalMessages = wsTester.getMessages()
    const finalMessageCount = finalMessages.length - originalMessages.length
    const finalHeartbeatResponses = finalMessages.filter(msg => msg.type === 'heartbeat').length

    console.log(`长时间连接稳定性测试结果:`)
    console.log(`- 测试时长: ${testDuration}ms`)
    console.log(`- 发送心跳次数: ${heartbeatCount}`)
    console.log(`- 接收心跳响应: ${finalHeartbeatResponses}`)
    console.log(`- 总接收消息数: ${finalMessageCount}`)
    console.log(`- WebSocket 连接状态: ${wsTester.isConnected() ? '已连接' : '已断开'}`)
    console.log(`- Agent 连接状态: ${mockAgent.isConnected() ? '已连接' : '已断开'}`)

    // 稳定性断言
    expect(wsTester.isConnected()).toBe(true)
    expect(mockAgent.isConnected()).toBe(true)
    expect(finalHeartbeatResponses).toBeGreaterThanOrEqual(heartbeatCount * 0.8) // 至少80%的心跳应该有响应

    wsTester.disconnect()
    mockAgent.disconnect()
  })

  test('内存泄漏检测测试', async () => {
    const initialMemory = process.memoryUsage()
    const connections: WebSocketTester[] = []
    const agents: MockAgent[] = []

    // 创建大量短期连接来检测内存泄漏
    for (let cycle = 0; cycle < 5; cycle++) {
      const cycleConnections: WebSocketTester[] = []
      const cycleAgents: MockAgent[] = []

      // 创建连接
      for (let i = 0; i < 10; i++) {
        const wsTester = new WebSocketTester()
        const mockAgent = new MockAgent(`memory-test-${cycle}-${i}`, `Memory Test Agent ${cycle}-${i}`)

        await wsTester.connect(authData.accessToken)
        await mockAgent.connect()

        cycleConnections.push(wsTester)
        cycleAgents.push(mockAgent)
      }

      // 使用连接
      await delay(1000)

      // 发送一些消息
      cycleConnections.forEach(conn => {
        conn.send('heartbeat', { timestamp: new Date().toISOString() })
      })

      await delay(1000)

      // 清理连接
      cycleConnections.forEach(conn => conn.disconnect())
      cycleAgents.forEach(agent => agent.disconnect())

      await delay(1000)

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc()
      }

      console.log(`内存检测 - 周期 ${cycle + 1}:`, process.memoryUsage())
    }

    const finalMemory = process.memoryUsage()
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
    const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100

    console.log(`内存泄漏检测结果:`)
    console.log(`- 初始内存: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`- 最终内存: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`- 内存增长: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(2)}%)`)

    // 内存增长不应超过50%（相对宽松的限制）
    expect(memoryIncreasePercent).toBeLessThan(50)
  })
})