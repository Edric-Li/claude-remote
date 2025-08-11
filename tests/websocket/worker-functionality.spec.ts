/**
 * WebSocket Worker 功能测试
 * 测试 Worker 启动、输入、输出等功能
 */

import { test, expect } from '@playwright/test'
import { WebSocketTester, MockAgent, TEST_CONFIG, delay } from '../utils/test-helpers'
import * as fs from 'fs/promises'

test.use({ storageState: 'tests/auth/.auth.json' })

test.describe('WebSocket Worker 功能测试', () => {
  let wsTester: WebSocketTester
  let mockAgent: MockAgent
  let authData: any

  test.beforeAll(async () => {
    const authFile = await fs.readFile('tests/auth/.auth.json', 'utf8')
    authData = JSON.parse(authFile)
  })

  test.beforeEach(async () => {
    wsTester = new WebSocketTester()
    mockAgent = new MockAgent(`worker-agent-${Date.now()}`, 'Worker Test Agent')
    
    await wsTester.connect(authData.accessToken)
    await mockAgent.connect()
    await delay(1000)
  })

  test.afterEach(async () => {
    wsTester?.disconnect()
    mockAgent?.disconnect()
  })

  test('应该能启动 Worker', async () => {
    const taskId = `task-${Date.now()}`
    const agentId = mockAgent['agentId']
    
    // 设置 Agent 消息处理器
    let receivedWorkerStart: any = null
    mockAgent.on('worker:start', (data: any) => {
      receivedWorkerStart = data
    })
    
    // 发送 Worker 启动请求
    wsTester.send('worker:start', {
      agentId,
      taskId,
      workingDirectory: '/test/directory',
      initialPrompt: 'Test initial prompt'
    })
    
    // 等待 Agent 接收启动请求
    await delay(1000)
    
    expect(receivedWorkerStart).toBeTruthy()
    expect(receivedWorkerStart.taskId).toBe(taskId)
    expect(receivedWorkerStart.workingDirectory).toBe('/test/directory')
    expect(receivedWorkerStart.initialPrompt).toBe('Test initial prompt')
  })

  test('应该能接收 Worker 状态更新', async () => {
    const taskId = `task-${Date.now()}`
    const agentId = mockAgent['agentId']
    
    // Agent 发送 Worker 状态更新
    mockAgent.emit('worker:status', {
      taskId,
      status: 'started',
      agentId
    })
    
    // 等待前端接收状态更新
    const statusMessage = await wsTester.waitForMessage('worker:status')
    expect(statusMessage).toBeTruthy()
    expect(statusMessage.payload.taskId).toBe(taskId)
    expect(statusMessage.payload.status).toBe('started')
    expect(statusMessage.payload.agentId).toBe(agentId)
  })

  test('应该能发送 Worker 输入', async () => {
    const taskId = `task-${Date.now()}`
    const agentId = mockAgent['agentId']
    const testInput = 'Test worker input'
    
    // 设置 Agent 消息处理器
    let receivedInput: any = null
    mockAgent.on('worker:input', (data: any) => {
      receivedInput = data
    })
    
    // 发送 Worker 输入
    wsTester.send('worker:input', {
      agentId,
      taskId,
      input: testInput
    })
    
    // 等待 Agent 接收输入
    await delay(1000)
    
    expect(receivedInput).toBeTruthy()
    expect(receivedInput.taskId).toBe(taskId)
    expect(receivedInput.input).toBe(testInput)
  })

  test('应该能接收 Worker 消息输出', async () => {
    const taskId = `task-${Date.now()}`
    const agentId = mockAgent['agentId']
    
    // Agent 发送 Worker 消息
    const testMessage = {
      type: 'assistant',
      content: 'Test worker output message'
    }
    
    mockAgent.sendWorkerMessage(taskId, testMessage)
    
    // 等待前端接收消息
    const workerMessage = await wsTester.waitForMessage('worker:message')
    expect(workerMessage).toBeTruthy()
    expect(workerMessage.payload.taskId).toBe(taskId)
    expect(workerMessage.payload.message.type).toBe('assistant')
    expect(workerMessage.payload.message.content).toBe('Test worker output message')
    expect(workerMessage.payload.agentId).toBe(agentId)
  })

  test('应该能处理 Worker 错误状态', async () => {
    const taskId = `task-${Date.now()}`
    const agentId = mockAgent['agentId']
    const errorMessage = 'Test worker error'
    
    // Agent 发送错误状态
    mockAgent.emit('worker:status', {
      taskId,
      status: 'error',
      error: errorMessage,
      agentId
    })
    
    // 等待前端接收错误状态
    const statusMessage = await wsTester.waitForMessage('worker:status')
    expect(statusMessage).toBeTruthy()
    expect(statusMessage.payload.status).toBe('error')
    expect(statusMessage.payload.error).toBe(errorMessage)
  })

  test('应该能处理 Worker 完成状态', async () => {
    const taskId = `task-${Date.now()}`
    const agentId = mockAgent['agentId']
    
    // 模拟完整的 Worker 生命周期
    // 1. 启动
    mockAgent.emit('worker:status', {
      taskId,
      status: 'started',
      agentId
    })
    
    let startMessage = await wsTester.waitForMessage('worker:status')
    expect(startMessage.payload.status).toBe('started')
    
    wsTester.clearMessages()
    
    // 2. 处理中
    mockAgent.emit('worker:status', {
      taskId,
      status: 'running',
      agentId
    })
    
    let runningMessage = await wsTester.waitForMessage('worker:status')
    expect(runningMessage.payload.status).toBe('running')
    
    wsTester.clearMessages()
    
    // 3. 完成
    mockAgent.emit('worker:status', {
      taskId,
      status: 'completed',
      agentId
    })
    
    let completedMessage = await wsTester.waitForMessage('worker:status')
    expect(completedMessage.payload.status).toBe('completed')
  })

  test('应该能处理 Worker 重创建请求', async () => {
    const taskId = `task-${Date.now()}`
    const sessionId = `session-${Date.now()}`
    const agentId = mockAgent['agentId']
    
    // 设置 Agent 消息处理器
    let receivedRecreate: any = null
    mockAgent.on('worker:recreate', (data: any) => {
      receivedRecreate = data
    })
    
    // 发送重创建请求
    wsTester.send('worker:recreate_request', {
      taskId,
      sessionId,
      agentId
    })
    
    // 等待 Agent 接收重创建请求
    await delay(1000)
    
    expect(receivedRecreate).toBeTruthy()
    expect(receivedRecreate.taskId).toBe(taskId)
    expect(receivedRecreate.sessionId).toBe(sessionId)
  })

  test('应该能处理多个并发 Worker 任务', async () => {
    const tasks = [
      { taskId: `task-1-${Date.now()}`, input: 'Task 1 input' },
      { taskId: `task-2-${Date.now()}`, input: 'Task 2 input' },
      { taskId: `task-3-${Date.now()}`, input: 'Task 3 input' }
    ]
    
    const agentId = mockAgent['agentId']
    const receivedInputs: any[] = []
    
    // 设置消息处理器
    mockAgent.on('worker:input', (data: any) => {
      receivedInputs.push(data)
    })
    
    // 并发发送多个任务
    const promises = tasks.map(task => 
      wsTester.send('worker:input', {
        agentId,
        taskId: task.taskId,
        input: task.input
      })
    )
    
    // 等待所有输入被接收
    await delay(2000)
    
    expect(receivedInputs.length).toBe(tasks.length)
    
    // 验证所有任务都被正确接收
    tasks.forEach(task => {
      const received = receivedInputs.find(r => r.taskId === task.taskId)
      expect(received).toBeTruthy()
      expect(received.input).toBe(task.input)
    })
  })
})