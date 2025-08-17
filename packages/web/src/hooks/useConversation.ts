/**
 * 对话管理Hook
 * 提供对话创建、状态管理等功能
 */

import { useEffect, useState } from 'react'
import { useWebSocketCommunicationStore } from '@/store/websocket-communication.store'
import { webSocketClient } from '@/lib/websocket-client'
import type { ConversationState } from '@/types/conversation.types'

interface UseConversationOptions {
  conversationId: string
  agentId: string
  repositoryId: string
  autoCreate?: boolean
}

export function useConversation({ 
  conversationId, 
  agentId, 
  repositoryId, 
  autoCreate = true 
}: UseConversationOptions) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    conversations,
    connected,
    createConversation,
    updateConversationState,
    setActiveConversation,
    connect
  } = useWebSocketCommunicationStore()

  const conversation = conversations.get(conversationId)

  // 确保WebSocket连接
  useEffect(() => {
    if (!connected) {
      connect()
    }
  }, [connected, connect])

  // 自动创建对话
  useEffect(() => {
    if (!conversation && autoCreate && connected && agentId && repositoryId) {
      setLoading(true)
      try {
        createConversation(agentId, repositoryId, {
          aiTool: 'claude',
          toolPermissions: ['Read', 'Edit', 'MultiEdit', 'Write', 'Bash', 'Grep', 'Glob'],
          preferences: {
            enableCodeHighlight: true,
            enableAutoSave: true,
            messageFormat: 'markdown',
            theme: 'system'
          }
        })
        setActiveConversation(conversationId)
        setError(null)
      } catch (err: any) {
        setError(err.message || '创建对话失败')
      } finally {
        setLoading(false)
      }
    }
  }, [conversation, autoCreate, connected, agentId, repositoryId, conversationId, createConversation, setActiveConversation])

  // 发送消息
  const sendMessage = async (content: string, options?: {
    type?: 'chat' | 'claude'
    toolSettings?: any
  }) => {
    if (!connected) {
      throw new Error('WebSocket未连接')
    }

    if (!agentId) {
      throw new Error('未指定Agent')
    }

    try {
      const messageType = options?.type || 'claude'
      
      if (messageType === 'claude') {
        // 使用直接的 Claude 命令（替代 Worker 架构）
        // 关键修复：从WebSocket store的conversation中获取claude session ID
        const conversation = conversations.get(conversationId)
        const claudeSessionId = conversation?.claudeSessionId
        const shouldResume = !!claudeSessionId
        
        console.log(`[useConversation] Sending Claude command:`)
        console.log(`  - conversationId: ${conversationId}`)
        console.log(`  - claudeSessionId: ${claudeSessionId}`)
        console.log(`  - shouldResume: ${shouldResume}`)
        
        await webSocketClient.sendClaudeCommand(content, {
          projectPath: `/repositories/${repositoryId}`,
          sessionId: claudeSessionId || conversationId, // 使用Claude session ID，如果没有则用conversation ID
          repositoryId: repositoryId,
          resume: shouldResume, // 只有当存在Claude session ID时才恢复
          model: 'claude-3-5-sonnet-20241022',
          toolSettings: options?.toolSettings
        })
      } else {
        // 发送普通聊天消息
        await webSocketClient.sendChatMessage(agentId, content)
      }

      // 更新对话状态
      if (conversation) {
        updateConversationState(conversationId, {
          status: 'active',
          messageCount: (conversation.messageCount || 0) + 1
        })
      }

    } catch (err: any) {
      setError(err.message || '发送消息失败')
      throw err
    }
  }

  // 停止对话
  const stopConversation = async () => {
    if (!connected || !agentId) {
      return
    }

    try {
      await webSocketClient.stopWorker(agentId, conversationId)
      
      if (conversation) {
        updateConversationState(conversationId, {
          status: 'paused'
        })
      }
    } catch (err: any) {
      setError(err.message || '停止对话失败')
      throw err
    }
  }

  return {
    conversation,
    loading,
    error,
    connected,
    sendMessage,
    stopConversation,
    clearError: () => setError(null)
  }
}