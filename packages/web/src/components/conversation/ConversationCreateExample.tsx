import { useState } from 'react'
import { ConversationCreate } from './ConversationCreate'
import type { ConversationConfig } from '../../types/conversation.types'

/**
 * ConversationCreate 组件使用示例
 */
export function ConversationCreateExample() {
  const [loading, setLoading] = useState(false)
  const [createdConfig, setCreatedConfig] = useState<ConversationConfig | null>(null)

  const handleCreateConversation = async (config: ConversationConfig) => {
    setLoading(true)
    
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      console.log('创建对话配置:', config)
      setCreatedConfig(config)
      
      // 这里应该调用实际的API来创建对话
      // const conversation = await conversationAPI.create(config)
      
    } catch (error) {
      console.error('创建对话失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setCreatedConfig(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            对话创建组件示例
          </h1>
          <p className="text-gray-600">
            演示 ConversationCreate 组件的完整功能
          </p>
        </div>

        {createdConfig ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-green-600">
              对话创建成功！
            </h2>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <pre className="text-sm text-green-800 overflow-auto">
                {JSON.stringify(createdConfig, null, 2)}
              </pre>
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              重新创建
            </button>
          </div>
        ) : (
          <ConversationCreate
            onCreateConversation={handleCreateConversation}
            loading={loading}
          />
        )}
      </div>
    </div>
  )
}