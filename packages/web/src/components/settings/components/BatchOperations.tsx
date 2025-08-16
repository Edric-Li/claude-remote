import React, { useState } from 'react'
import { 
  Trash2, 
  Power, 
  Tag, 
  Settings, 
  X, 
  AlertTriangle,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react'
import type { Agent, BatchOperation, BatchOperationResult } from '../../../types/agent.types'

interface BatchOperationsProps {
  selectedAgents: string[]
  agents: Agent[]
  onBatchOperation: (operation: BatchOperation) => Promise<BatchOperationResult>
  onClearSelection: () => void
}

export function BatchOperations({ 
  selectedAgents, 
  agents, 
  onBatchOperation, 
  onClearSelection 
}: BatchOperationsProps) {
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showStatusUpdate, setShowStatusUpdate] = useState(false)
  const [showTagsUpdate, setShowTagsUpdate] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'offline'>('offline')
  const [tagsInput, setTagsInput] = useState('')
  const [tagsMode, setTagsMode] = useState<'replace' | 'add' | 'remove'>('add')
  const [lastResult, setLastResult] = useState<BatchOperationResult | null>(null)

  const selectedAgentDetails = agents.filter(agent => selectedAgents.includes(agent.id))
  const hasConnectedAgents = selectedAgentDetails.some(agent => agent.status === 'connected')

  const handleBatchDelete = async () => {
    setLoading(true)
    try {
      const result = await onBatchOperation({
        type: 'delete',
        agentIds: selectedAgents,
        userId: 'admin' // 这里应该从认证状态获取
      })
      setLastResult(result)
      setShowDeleteConfirm(false)
      if (result.successCount > 0) {
        onClearSelection()
      }
    } catch (error) {
      console.error('Batch delete failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchStatusUpdate = async () => {
    setLoading(true)
    try {
      const result = await onBatchOperation({
        type: 'update_status',
        agentIds: selectedAgents,
        payload: { status: selectedStatus },
        userId: 'admin'
      })
      setLastResult(result)
      setShowStatusUpdate(false)
      if (result.successCount > 0) {
        onClearSelection()
      }
    } catch (error) {
      console.error('Batch status update failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchTagsUpdate = async () => {
    const tags = tagsInput.split(',').map(tag => tag.trim()).filter(Boolean)
    if (tags.length === 0) {
      alert('请输入至少一个标签')
      return
    }

    setLoading(true)
    try {
      const result = await onBatchOperation({
        type: 'update_tags',
        agentIds: selectedAgents,
        payload: { tags, mode: tagsMode },
        userId: 'admin'
      })
      setLastResult(result)
      setShowTagsUpdate(false)
      setTagsInput('')
      if (result.successCount > 0) {
        onClearSelection()
      }
    } catch (error) {
      console.error('Batch tags update failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">
                已选择 {selectedAgents.length} 个Agent
              </span>
            </div>
            
            {hasConnectedAgents && (
              <div className="flex items-center gap-1 text-amber-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>包含已连接的Agent</span>
              </div>
            )}
          </div>

          <button
            onClick={onClearSelection}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            取消选择
          </button>
        </div>

        {/* 批量操作按钮 */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => setShowStatusUpdate(true)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Power className="w-4 h-4" />
            批量更新状态
          </button>

          <button
            onClick={() => setShowTagsUpdate(true)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Tag className="w-4 h-4" />
            批量管理标签
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading || hasConnectedAgents}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            批量删除
          </button>

          {loading && (
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">处理中...</span>
            </div>
          )}
        </div>

        {/* 操作结果显示 */}
        {lastResult && (
          <div className="mt-4 p-3 bg-white rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              {lastResult.failureCount === 0 ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              )}
              <span className="font-medium text-sm">
                批量操作完成
              </span>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>成功: {lastResult.successCount} 个</p>
              {lastResult.failureCount > 0 && (
                <p className="text-red-600">失败: {lastResult.failureCount} 个</p>
              )}
              {lastResult.skippedCount > 0 && (
                <p className="text-amber-600">跳过: {lastResult.skippedCount} 个</p>
              )}
            </div>
            <button
              onClick={() => setLastResult(null)}
              className="mt-2 text-xs text-gray-500 hover:text-gray-700"
            >
              关闭
            </button>
          </div>
        )}
      </div>

      {/* 删除确认模态框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <h3 className="text-lg font-semibold text-gray-900">确认批量删除</h3>
              </div>

              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  您确定要删除以下 {selectedAgents.length} 个Agent吗？此操作不可恢复。
                </p>
                
                <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3">
                  {selectedAgentDetails.map(agent => (
                    <div key={agent.id} className="flex items-center justify-between py-1">
                      <span className="text-sm">{agent.name}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        agent.status === 'connected' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {agent.status === 'connected' ? '无法删除(已连接)' : agent.status}
                      </span>
                    </div>
                  ))}
                </div>

                {hasConnectedAgents && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700">
                      已连接的Agent无法删除，请先断开连接。
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={loading || hasConnectedAgents}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 状态更新模态框 */}
      {showStatusUpdate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Power className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-900">批量更新状态</h3>
              </div>

              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  将 {selectedAgents.length} 个Agent的状态更新为：
                </p>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="status"
                      value="offline"
                      checked={selectedStatus === 'offline'}
                      onChange={(e) => setSelectedStatus(e.target.value as 'offline')}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm">离线</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="status"
                      value="pending"
                      checked={selectedStatus === 'pending'}
                      onChange={(e) => setSelectedStatus(e.target.value as 'pending')}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm">待连接</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowStatusUpdate(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchStatusUpdate}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  确认更新
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 标签管理模态框 */}
      {showTagsUpdate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Tag className="w-6 h-6 text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900">批量管理标签</h3>
              </div>

              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    操作模式
                  </label>
                  <select
                    value={tagsMode}
                    onChange={(e) => setTagsMode(e.target.value as 'replace' | 'add' | 'remove')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="add">添加标签</option>
                    <option value="remove">移除标签</option>
                    <option value="replace">替换所有标签</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    标签（逗号分隔）
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="例如: 生产环境, 高性能, 专用"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="text-sm text-gray-600">
                  将对 {selectedAgents.length} 个Agent 
                  {tagsMode === 'add' && '添加'}
                  {tagsMode === 'remove' && '移除'}
                  {tagsMode === 'replace' && '替换'}
                  标签
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowTagsUpdate(false)
                    setTagsInput('')
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchTagsUpdate}
                  disabled={loading || !tagsInput.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  确认操作
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}