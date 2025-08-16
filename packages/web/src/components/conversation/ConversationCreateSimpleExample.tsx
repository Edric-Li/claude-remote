import { ConversationCreate } from './ConversationCreate'
import type { ConversationConfig } from '../../types/conversation.types'

/**
 * ConversationCreate 组件简单使用示例
 */
export function ConversationCreateSimpleExample() {
  const handleCreateConversation = (config: ConversationConfig) => {
    console.log('创建对话配置:', config)
    alert('对话创建成功！查看控制台获取配置详情。')
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">对话创建组件</h2>
      <ConversationCreate 
        onCreateConversation={handleCreateConversation}
        loading={false}
        disabled={false}
      />
    </div>
  )
}