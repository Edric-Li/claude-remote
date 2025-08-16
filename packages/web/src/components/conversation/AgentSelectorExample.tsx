import { useState } from 'react'
import { AgentSelector } from './AgentSelector'

// AgentSelector组件使用示例
export default function AgentSelectorExample() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>()

  const handleAgentSelect = (agentId: string, agent: any) => {
    setSelectedAgentId(agentId)
    console.log('选择了Agent:', agent)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">AgentSelector 组件示例</h1>
      
      <div className="space-y-6">
        {/* 基础用法 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">基础用法</h2>
          <AgentSelector
            selectedAgentId={selectedAgentId}
            onSelect={handleAgentSelect}
          />
        </div>

        {/* 不显示状态统计 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">不显示状态统计</h2>
          <AgentSelector
            selectedAgentId={selectedAgentId}
            onSelect={handleAgentSelect}
            showStatus={false}
          />
        </div>

        {/* 禁用状态 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">禁用状态</h2>
          <AgentSelector
            selectedAgentId={selectedAgentId}
            onSelect={handleAgentSelect}
            disabled={true}
          />
        </div>

        {/* 自定义样式 */}
        <div>
          <h2 className="text-lg font-semibold mb-3">自定义样式</h2>
          <AgentSelector
            selectedAgentId={selectedAgentId}
            onSelect={handleAgentSelect}
            className="border-2 border-blue-200"
          />
        </div>
      </div>

      {/* 当前选择显示 */}
      {selectedAgentId && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-1">当前选择</h3>
          <p className="text-blue-600">Agent ID: {selectedAgentId}</p>
        </div>
      )}
    </div>
  )
}