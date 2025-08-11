/**
 * WebSocket 测试组件
 * 用于验证 WebSocket 连接和功能
 */

import React, { useState, useEffect } from 'react'
import { webSocketClient } from '../lib/websocket-client'
import { useWebSocketCommunicationStore } from '../store/websocket-communication.store'

export function WebSocketTest() {
  const [messages, setMessages] = useState<string[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isVisible, setIsVisible] = useState(false)

  const {
    connected,
    connecting,
    error,
    agents,
    connect,
    disconnect,
    clearError,
    refreshAgentList
  } = useWebSocketCommunicationStore()

  // 监听 WebSocket 事件
  useEffect(() => {
    const handleMessage = (data: any) => {
      const message = `[${new Date().toLocaleTimeString()}] 收到消息: ${JSON.stringify(data)}`
      setMessages(prev => [...prev.slice(-19), message]) // 保持最新20条
    }

    const handleConnect = () => {
      const message = `[${new Date().toLocaleTimeString()}] ✅ WebSocket 已连接`
      setMessages(prev => [...prev.slice(-19), message])
    }

    const handleDisconnect = () => {
      const message = `[${new Date().toLocaleTimeString()}] ❌ WebSocket 已断开`
      setMessages(prev => [...prev.slice(-19), message])
    }

    // 监听所有事件
    webSocketClient.on('connect', handleConnect)
    webSocketClient.on('disconnect', handleDisconnect)
    webSocketClient.on('agent:connected', handleMessage)
    webSocketClient.on('agent:disconnected', handleMessage)
    webSocketClient.on('chat:reply', handleMessage)
    webSocketClient.on('worker:message', handleMessage)
    webSocketClient.on('worker:status', handleMessage)

    return () => {
      webSocketClient.off('connect', handleConnect)
      webSocketClient.off('disconnect', handleDisconnect)
      webSocketClient.off('agent:connected', handleMessage)
      webSocketClient.off('agent:disconnected', handleMessage)
      webSocketClient.off('chat:reply', handleMessage)
      webSocketClient.off('worker:message', handleMessage)
      webSocketClient.off('worker:status', handleMessage)
    }
  }, [])

  const handleSendTestMessage = () => {
    if (!inputMessage.trim()) return

    try {
      // 发送测试消息
      webSocketClient.sendChatMessage('test-agent', inputMessage)
      const message = `[${new Date().toLocaleTimeString()}] 📤 发送测试消息: ${inputMessage}`
      setMessages(prev => [...prev.slice(-19), message])
      setInputMessage('')
    } catch (error: any) {
      const message = `[${new Date().toLocaleTimeString()}] ❌ 发送失败: ${error.message}`
      setMessages(prev => [...prev.slice(-19), message])
    }
  }

  const handleClearMessages = () => {
    setMessages([])
  }

  const getConnectionInfo = () => {
    const info = webSocketClient.getConnectionInfo()
    const message = `[${new Date().toLocaleTimeString()}] 📊 连接信息: ${JSON.stringify(info, null, 2)}`
    setMessages(prev => [...prev.slice(-19), message])
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg hover:bg-blue-600 z-50"
      >
        🔧 WebSocket 测试
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-96 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50">
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-t-lg">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
          WebSocket 测试工具
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* 状态显示 */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : connecting ? 'bg-yellow-500' : 'bg-red-500'}`} />
            <span className="text-gray-600 dark:text-gray-300">
              {connected ? '已连接' : connecting ? '连接中' : '未连接'}
            </span>
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            Agents: {agents.length}
          </div>
        </div>
        
        {error && (
          <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs rounded">
            {error}
            <button
              onClick={clearError}
              className="ml-2 text-red-600 dark:text-red-400 hover:underline"
            >
              清除
            </button>
          </div>
        )}
      </div>

      {/* 消息显示 */}
      <div className="flex-1 p-3 overflow-y-auto" style={{ height: '200px' }}>
        <div className="space-y-1">
          {messages.map((message, index) => (
            <div key={index} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
              {message}
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-xs text-gray-400 italic text-center py-4">
              暂无消息...
            </div>
          )}
        </div>
      </div>

      {/* 控制面板 */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
        {/* 测试消息输入 */}
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendTestMessage()}
            placeholder="输入测试消息..."
            className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={handleSendTestMessage}
            disabled={!connected || !inputMessage.trim()}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            发送
          </button>
        </div>

        {/* 操作按钮 */}
        <div className="flex space-x-1 text-xs">
          <button
            onClick={connected ? disconnect : connect}
            className={`px-2 py-1 rounded ${
              connected
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {connected ? '断开' : '连接'}
          </button>
          
          <button
            onClick={refreshAgentList}
            className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            刷新Agents
          </button>
          
          <button
            onClick={getConnectionInfo}
            className="px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            连接信息
          </button>
          
          <button
            onClick={handleClearMessages}
            className="px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            清空日志
          </button>
        </div>
      </div>
    </div>
  )
}