import React from 'react'
import { Bot, ChevronLeft, ChevronRight } from 'lucide-react'
import { AgentCard } from './AgentCard'
import type { Agent, PaginationOptions, ConnectionTestResult } from '../../../types/agent.types'

interface AgentListProps {
  agents: Agent[]
  selectedAgents: string[]
  pagination: PaginationOptions
  totalPages: number
  onAgentSelect: (agentId: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onEditAgent: (agent: Agent) => void
  onDeleteAgent: (id: string, name: string) => void
  onResetKey: (id: string) => Promise<string>
  onTestConnection: (id: string) => Promise<ConnectionTestResult>
  onPaginationChange: (pagination: Partial<PaginationOptions>) => void
  onRefreshAgent: (id: string) => void
}

export function AgentList({
  agents,
  selectedAgents,
  pagination,
  totalPages,
  onAgentSelect,
  onSelectAll,
  onClearSelection,
  onEditAgent,
  onDeleteAgent,
  onResetKey,
  onTestConnection,
  onPaginationChange,
  onRefreshAgent
}: AgentListProps) {
  const isAllSelected = agents.length > 0 && selectedAgents.length === agents.length

  const handleSelectAll = () => {
    if (isAllSelected) {
      onClearSelection()
    } else {
      onSelectAll()
    }
  }

  const handlePageChange = (page: number) => {
    onPaginationChange({ page })
  }

  const handleSortChange = (sortBy: string) => {
    const newSortOrder = pagination.sortBy === sortBy && pagination.sortOrder === 'DESC' ? 'ASC' : 'DESC'
    onPaginationChange({ sortBy, sortOrder: newSortOrder })
  }

  if (agents.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-8 text-center text-gray-500">
          <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h4 className="font-medium text-gray-900 mb-2">还没有配置Agent</h4>
          <p className="text-sm mb-4">添加您的第一个AI Agent开始使用</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* 列表头部 */}
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                className="h-4 w-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
              />
              <span className="text-sm text-gray-600">
                {selectedAgents.length > 0 ? (
                  `已选择 ${selectedAgents.length} 个Agent`
                ) : (
                  '全选'
                )}
              </span>
            </div>
            
            {selectedAgents.length > 0 && (
              <button
                onClick={onClearSelection}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                清除选择
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* 排序选择器 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">排序:</span>
              <select
                value={`${pagination.sortBy}-${pagination.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-') as [string, 'ASC' | 'DESC']
                  onPaginationChange({ sortBy, sortOrder })
                }}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="createdAt-DESC">创建时间 (最新)</option>
                <option value="createdAt-ASC">创建时间 (最早)</option>
                <option value="name-ASC">名称 A-Z</option>
                <option value="name-DESC">名称 Z-A</option>
                <option value="lastSeenAt-DESC">最后活跃 (最新)</option>
                <option value="lastSeenAt-ASC">最后活跃 (最早)</option>
                <option value="status-ASC">状态</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Agent卡片列表 */}
      <div className="divide-y divide-gray-200">
        {agents.map(agent => (
          <AgentCard
            key={agent.id}
            agent={agent}
            selected={selectedAgents.includes(agent.id)}
            onSelect={() => onAgentSelect(agent.id)}
            onEdit={() => onEditAgent(agent)}
            onDelete={() => onDeleteAgent(agent.id, agent.name)}
            onResetKey={() => onResetKey(agent.id)}
            onTestConnection={() => onTestConnection(agent.id)}
            onRefresh={() => onRefreshAgent(agent.id)}
          />
        ))}
      </div>

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>每页显示:</span>
              <select
                value={pagination.limit}
                onChange={(e) => onPaginationChange({ 
                  limit: parseInt(e.target.value),
                  page: 1 
                })}
                className="border border-gray-300 rounded px-2 py-1"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                第 {pagination.page} 页，共 {totalPages} 页
              </span>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {/* 页码按钮 */}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1
                  } else if (pagination.page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = pagination.page - 2 + i
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1 text-sm rounded ${
                        pageNum === pagination.page
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= totalPages}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}