/**
 * 对话状态管理功能演示组件
 * 展示如何使用扩展后的WebSocket Store进行对话管理
 */

import React from 'react'
import { useWebSocketCommunicationStore } from '../store/websocket-communication.store'
import type { ConversationState } from '../store/websocket-communication.store'

export function ConversationStoreDemo() {
  const {
    conversations,
    activeConversationId,
    conversationLoading,
    createConversation,
    updateConversationState,
    setActiveConversation,
    removeConversation
  } = useWebSocketCommunicationStore()

  // 示例：创建新对话
  const handleCreateConversation = () => {
    createConversation('agent-1', 'repo-1', { aiTool: 'claude' })
  }

  // 示例：更新对话状态
  const handleUpdateConversation = (conversationId: string) => {
    updateConversationState(conversationId, {
      status: 'active',
      messageCount: 5
    })
  }

  // 示例：设置活跃对话
  const handleSetActive = (conversationId: string) => {
    setActiveConversation(conversationId)
  }

  // 示例：移除对话
  const handleRemoveConversation = (conversationId: string) => {
    removeConversation(conversationId)
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">对话状态管理演示</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold mb-2">状态信息</h3>
          <div className="text-sm space-y-1">
            <div>对话总数: {conversations.size}</div>
            <div>活跃对话ID: {activeConversationId || '无'}</div>
            <div>加载状态: {conversationLoading ? '加载中' : '就绪'}</div>
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">操作</h3>
          <div className="space-y-2">
            <button 
              onClick={handleCreateConversation}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
            >
              创建对话
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">对话列表</h3>
        <div className="space-y-2">
          {Array.from(conversations.entries()).map(([id, conversation]) => (
            <div key={id} className="border p-2 rounded text-sm">
              <div className="flex justify-between items-center">
                <div>
                  <div><strong>ID:</strong> {conversation.id.slice(-8)}</div>
                  <div><strong>Agent:</strong> {conversation.agentId}</div>
                  <div><strong>状态:</strong> {conversation.status}</div>
                  <div><strong>工具:</strong> {conversation.aiTool}</div>
                  <div><strong>消息数:</strong> {conversation.messageCount}</div>
                </div>
                <div className="space-x-2">
                  <button 
                    onClick={() => handleSetActive(id)}
                    className={`px-2 py-1 text-xs rounded ${
                      activeConversationId === id 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200'
                    }`}
                  >
                    {activeConversationId === id ? '活跃' : '激活'}
                  </button>
                  <button 
                    onClick={() => handleUpdateConversation(id)}
                    className="px-2 py-1 bg-yellow-500 text-white text-xs rounded"
                  >
                    更新
                  </button>
                  <button 
                    onClick={() => handleRemoveConversation(id)}
                    className="px-2 py-1 bg-red-500 text-white text-xs rounded"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
          {conversations.size === 0 && (
            <div className="text-gray-500 text-sm">暂无对话</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConversationStoreDemo