import React from 'react'
import { ConversationInterface } from '../../components/conversation'

const ConversationTest: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Agent对话系统测试页面
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            测试ConversationInterface组件的完整功能
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <ConversationInterface 
            onConversationClose={(conversationId) => {
              console.log('对话关闭:', conversationId)
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default ConversationTest