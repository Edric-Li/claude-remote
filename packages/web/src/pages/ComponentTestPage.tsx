import { useState } from 'react'
import { RepositorySelector, AgentSelector, ConversationCreate, ConversationInterface } from '../components/conversation'
import { ConversationCreateExample } from '../components/conversation/ConversationCreateExample'
import type { Repository } from '../types/api.types'

/**
 * 组件测试页面
 * 用于测试新创建的组件功能
 */
export function ComponentTestPage() {
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string } | null>(null)

  const handleRepositorySelect = (repositoryId: string, repository: Repository) => {
    console.log('选择的仓库:', { repositoryId, repository })
    setSelectedRepository(repository)
  }

  const handleAgentSelect = (agentId: string, agent: any) => {
    console.log('选择的Agent:', { agentId, agent })
    setSelectedAgent({ id: agentId, name: agent.name })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">组件测试页面</h1>
          <p className="text-gray-600">
            这个页面用于测试新创建的组件，包括 RepositorySelector、AgentSelector 和 ConversationCreate
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Repository Selector 测试 */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Repository Selector</h2>
            <RepositorySelector
              selectedRepositoryId={selectedRepository?.id}
              onSelect={handleRepositorySelect}
              showBranches={true}
              disabled={false}
              className="bg-white"
            />
            
            {/* 选择结果显示 */}
            {selectedRepository && (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium text-gray-900 mb-3">选择结果</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">名称: </span>
                    <span className="font-medium">{selectedRepository.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">类型: </span>
                    <span>{selectedRepository.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">URL: </span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {selectedRepository.url}
                    </code>
                  </div>
                  {selectedRepository.branch && (
                    <div>
                      <span className="text-gray-600">分支: </span>
                      <span>{selectedRepository.branch}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">状态: </span>
                    <span className={`px-2 py-1 text-xs rounded ${
                      selectedRepository.enabled 
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedRepository.enabled ? '已启用' : '已禁用'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Agent Selector 测试 */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Agent Selector</h2>
            <AgentSelector
              selectedAgentId={selectedAgent?.id}
              onSelect={handleAgentSelect}
              showStatus={true}
              disabled={false}
              className="bg-white"
            />
            
            {/* 选择结果显示 */}
            {selectedAgent && (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium text-gray-900 mb-3">选择结果</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">ID: </span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {selectedAgent.id}
                    </code>
                  </div>
                  <div>
                    <span className="text-gray-600">名称: </span>
                    <span className="font-medium">{selectedAgent.name}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-8 bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">使用说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Repository Selector</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 显示所有可用的代码仓库</li>
                <li>• 支持按名称、类型、状态过滤</li>
                <li>• 可展开查看详细信息</li>
                <li>• 支持连接测试功能</li>
                <li>• 只有已启用的仓库可选择</li>
                <li>• 响应式设计，适配移动端</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Agent Selector</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 显示所有可用的AI Agent</li>
                <li>• 实时显示连接状态</li>
                <li>• 支持搜索和过滤</li>
                <li>• 显示连接时间信息</li>
                <li>• 只有在线Agent可选择</li>
                <li>• 自动刷新Agent列表</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 技术信息 */}
        <div className="mt-8 bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">技术信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-blue-900 mb-2">Repository Selector</h4>
              <ul className="text-blue-700 space-y-1">
                <li>• 使用 useRepositories Hook</li>
                <li>• 集成 /api/repositories API</li>
                <li>• 支持连接测试功能</li>
                <li>• 使用 Tailwind CSS 样式</li>
                <li>• 支持 TypeScript 类型安全</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-900 mb-2">Agent Selector</h4>
              <ul className="text-blue-700 space-y-1">
                <li>• 使用 WebSocket 通信</li>
                <li>• 实时状态更新</li>
                <li>• 集成现有 Agent 系统</li>
                <li>• 响应式 UI 设计</li>
                <li>• 完整的错误处理</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ConversationCreate 组件测试 */}
        <div className="mt-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">ConversationCreate 组件</h2>
          <ConversationCreateExample />
        </div>

        {/* ConversationInterface 组件测试 */}
        <div className="mt-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">ConversationInterface 完整对话组件</h2>
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-2">完整对话体验</h3>
              <p className="text-sm text-gray-600">
                这是集成了ConversationCreate和ChatInterface的完整对话组件，
                管理从对话创建到实际聊天的整个生命周期。
              </p>
            </div>
            <div className="h-[600px]">
              <ConversationInterface
                onConversationClose={(conversationId) => {
                  console.log('对话已关闭:', conversationId)
                }}
              />
            </div>
          </div>
          
          {/* 功能说明 */}
          <div className="mt-6 bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h4 className="text-lg font-semibold text-blue-900 mb-4">ConversationInterface 功能特性</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h5 className="font-medium text-blue-900 mb-2">状态管理</h5>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 对话生命周期管理</li>
                  <li>• 多阶段状态转换</li>
                  <li>• 错误处理和重试</li>
                  <li>• 连接状态监控</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-blue-900 mb-2">用户体验</h5>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 清晰的阶段指示</li>
                  <li>• 响应式设计</li>
                  <li>• 加载状态提示</li>
                  <li>• 平滑的状态转换</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-blue-900 mb-2">集成功能</h5>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• WebSocket通信</li>
                  <li>• Agent管理集成</li>
                  <li>• 仓库系统集成</li>
                  <li>• 实时消息处理</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}