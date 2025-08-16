import React, { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { useAgents } from '../../hooks/useAgents'
import { AgentList } from './components/AgentList'
import { AgentFilters } from './components/AgentFilters'
import { BatchOperations } from './components/BatchOperations'
import { AgentForm } from './components/AgentForm'
import { AgentStatistics } from './components/AgentStatistics'
import type { AgentFormData } from '../../types/agent.types'

export function AgentSettings() {
  const {
    agents,
    loading,
    error,
    selectedAgents,
    filters,
    pagination,
    totalCount,
    totalPages,
    statistics,
    loadAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    resetAgentKey,
    testConnection,
    performBatchOperation,
    setFilters,
    setPagination,
    setSelectedAgents,
    toggleAgentSelection,
    selectAllAgents,
    clearSelection,
    refreshAgent
  } = useAgents()

  const [showForm, setShowForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<any>(null)

  const handleCreateAgent = async (data: AgentFormData) => {
    try {
      await createAgent(data)
      setShowForm(false)
    } catch (error) {
      console.error('Failed to create agent:', error)
      throw error
    }
  }

  const handleUpdateAgent = async (id: string, data: Partial<AgentFormData>) => {
    try {
      await updateAgent(id, data)
      setEditingAgent(null)
      setShowForm(false)
    } catch (error) {
      console.error('Failed to update agent:', error)
      throw error
    }
  }

  const handleDeleteAgent = async (id: string, name: string) => {
    if (!confirm(`确定要删除Agent "${name}" 吗？此操作不可恢复。`)) {
      return
    }

    try {
      await deleteAgent(id)
    } catch (error) {
      console.error('Failed to delete agent:', error)
      alert('删除失败，请重试')
    }
  }

  const handleEditAgent = (agent: any) => {
    setEditingAgent(agent)
    setShowForm(true)
  }

  const resetForm = () => {
    setEditingAgent(null)
    setShowForm(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">加载中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部操作 */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Agent配置</h3>
          <p className="text-sm text-gray-600">管理AI Agent和自动化工具</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAgents}
            className="px-3 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加Agent
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* 统计信息 */}
      {statistics && (
        <AgentStatistics statistics={statistics} />
      )}

      {/* 筛选器 */}
      <AgentFilters
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={totalCount}
      />

      {/* 批量操作 */}
      {selectedAgents.length > 0 && (
        <BatchOperations
          selectedAgents={selectedAgents}
          agents={agents}
          onBatchOperation={performBatchOperation}
          onClearSelection={clearSelection}
        />
      )}

      {/* Agent列表 */}
      <AgentList
        agents={agents}
        selectedAgents={selectedAgents}
        pagination={pagination}
        totalPages={totalPages}
        onAgentSelect={toggleAgentSelection}
        onSelectAll={selectAllAgents}
        onClearSelection={clearSelection}
        onEditAgent={handleEditAgent}
        onDeleteAgent={handleDeleteAgent}
        onResetKey={resetAgentKey}
        onTestConnection={testConnection}
        onPaginationChange={setPagination}
        onRefreshAgent={refreshAgent}
      />

      {/* 添加/编辑表单模态框 */}
      {showForm && (
        <AgentForm
          agent={editingAgent}
          onSubmit={editingAgent ? 
            (data) => handleUpdateAgent(editingAgent.id, data) : 
            handleCreateAgent
          }
          onCancel={resetForm}
        />
      )}
    </div>
  )
}