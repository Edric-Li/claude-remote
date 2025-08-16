import React, { useState } from 'react'
import { 
  Search, 
  Filter, 
  X, 
  Calendar,
  Tag,
  Cpu,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import type { AgentFilters } from '../../../types/agent.types'

interface AgentFiltersProps {
  filters: AgentFilters
  onFiltersChange: (filters: Partial<AgentFilters>) => void
  totalCount: number
}

export function AgentFilters({ filters, onFiltersChange, totalCount }: AgentFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [tempFilters, setTempFilters] = useState<AgentFilters>(filters)

  const handleSearchChange = (search: string) => {
    onFiltersChange({ search: search || undefined })
  }

  const handleStatusChange = (status: string) => {
    onFiltersChange({ 
      status: status === 'all' ? undefined : status as 'pending' | 'connected' | 'offline'
    })
  }

  const handleTagsChange = (tags: string[]) => {
    onFiltersChange({ tags: tags.length > 0 ? tags : undefined })
  }

  const handleAdvancedFiltersApply = () => {
    onFiltersChange(tempFilters)
    setShowAdvanced(false)
  }

  const handleAdvancedFiltersReset = () => {
    setTempFilters({})
    onFiltersChange({})
    setShowAdvanced(false)
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.search) count++
    if (filters.status) count++
    if (filters.tags?.length) count++
    if (filters.platform) count++
    if (filters.lastSeenAfter || filters.lastSeenBefore) count++
    if (filters.hasValidationResult !== undefined) count++
    if (filters.monitoringEnabled !== undefined) count++
    return count
  }

  const activeFiltersCount = getActiveFiltersCount()

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {/* 基础筛选行 */}
      <div className="flex items-center gap-4 mb-4">
        {/* 搜索框 */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索Agent名称、描述或主机名..."
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
          />
          {filters.search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 状态筛选 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">状态:</span>
          <select
            value={filters.status || 'all'}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            <option value="all">全部</option>
            <option value="connected">已连接</option>
            <option value="offline">离线</option>
            <option value="pending">待连接</option>
          </select>
        </div>

        {/* 高级筛选按钮 */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
            showAdvanced || activeFiltersCount > 0
              ? 'border-gray-900 text-gray-900 bg-gray-50'
              : 'border-gray-300 text-gray-600 hover:border-gray-400'
          }`}
        >
          <Filter className="w-4 h-4" />
          高级筛选
          {activeFiltersCount > 0 && (
            <span className="bg-gray-900 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
              {activeFiltersCount}
            </span>
          )}
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* 快速状态筛选按钮 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-600">快速筛选:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleStatusChange('connected')}
            className={`flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors ${
              filters.status === 'connected'
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <CheckCircle className="w-3 h-3" />
            已连接
          </button>
          <button
            onClick={() => handleStatusChange('offline')}
            className={`flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors ${
              filters.status === 'offline'
                ? 'bg-red-100 text-red-700 border border-red-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <XCircle className="w-3 h-3" />
            离线
          </button>
          <button
            onClick={() => handleStatusChange('pending')}
            className={`flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors ${
              filters.status === 'pending'
                ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <AlertCircle className="w-3 h-3" />
            待连接
          </button>
        </div>
      </div>

      {/* 高级筛选面板 */}
      {showAdvanced && (
        <div className="border-t border-gray-200 pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 平台筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Cpu className="w-4 h-4 inline mr-1" />
                平台
              </label>
              <select
                value={tempFilters.platform || ''}
                onChange={(e) => setTempFilters({ ...tempFilters, platform: e.target.value || undefined })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <option value="">全部平台</option>
                <option value="linux">Linux</option>
                <option value="darwin">macOS</option>
                <option value="win32">Windows</option>
              </select>
            </div>

            {/* 标签筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="w-4 h-4 inline mr-1" />
                标签
              </label>
              <input
                type="text"
                placeholder="输入标签，逗号分隔"
                value={tempFilters.tags?.join(', ') || ''}
                onChange={(e) => {
                  const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  setTempFilters({ ...tempFilters, tags: tags.length > 0 ? tags : undefined })
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            {/* 验证状态 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">验证状态</label>
              <select
                value={tempFilters.hasValidationResult?.toString() || ''}
                onChange={(e) => {
                  const value = e.target.value
                  setTempFilters({ 
                    ...tempFilters, 
                    hasValidationResult: value === '' ? undefined : value === 'true'
                  })
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <option value="">全部</option>
                <option value="true">已验证</option>
                <option value="false">未验证</option>
              </select>
            </div>

            {/* 监控状态 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">监控状态</label>
              <select
                value={tempFilters.monitoringEnabled?.toString() || ''}
                onChange={(e) => {
                  const value = e.target.value
                  setTempFilters({ 
                    ...tempFilters, 
                    monitoringEnabled: value === '' ? undefined : value === 'true'
                  })
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <option value="">全部</option>
                <option value="true">已启用</option>
                <option value="false">未启用</option>
              </select>
            </div>

            {/* 最后活跃时间 - 开始 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                活跃时间 - 开始
              </label>
              <input
                type="datetime-local"
                value={tempFilters.lastSeenAfter?.toISOString().slice(0, 16) || ''}
                onChange={(e) => {
                  setTempFilters({ 
                    ...tempFilters, 
                    lastSeenAfter: e.target.value ? new Date(e.target.value) : undefined
                  })
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            {/* 最后活跃时间 - 结束 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                活跃时间 - 结束
              </label>
              <input
                type="datetime-local"
                value={tempFilters.lastSeenBefore?.toISOString().slice(0, 16) || ''}
                onChange={(e) => {
                  setTempFilters({ 
                    ...tempFilters, 
                    lastSeenBefore: e.target.value ? new Date(e.target.value) : undefined
                  })
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>
          </div>

          {/* 高级筛选操作按钮 */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={handleAdvancedFiltersReset}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              重置筛选
            </button>
            <button
              onClick={handleAdvancedFiltersApply}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              应用筛选
            </button>
          </div>
        </div>
      )}

      {/* 筛选结果统计 */}
      <div className="flex items-center justify-between text-sm text-gray-600 mt-4 pt-4 border-t border-gray-200">
        <div>
          找到 {totalCount} 个Agent
          {activeFiltersCount > 0 && (
            <span className="ml-2 text-gray-500">
              (应用了 {activeFiltersCount} 个筛选条件)
            </span>
          )}
        </div>
        
        {activeFiltersCount > 0 && (
          <button
            onClick={() => onFiltersChange({})}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            清除所有筛选
          </button>
        )}
      </div>

      {/* 活跃筛选标签显示 */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              搜索: {filters.search}
              <button onClick={() => handleSearchChange('')}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.status && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
              状态: {filters.status}
              <button onClick={() => handleStatusChange('all')}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.platform && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
              平台: {filters.platform}
              <button onClick={() => onFiltersChange({ platform: undefined })}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.tags && filters.tags.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
              标签: {filters.tags.join(', ')}
              <button onClick={() => handleTagsChange([])}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}