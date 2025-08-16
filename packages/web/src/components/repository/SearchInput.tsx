import React, { useState, useEffect, useCallback } from 'react'
import { Search, X, Filter } from 'lucide-react'

export interface SearchState {
  query: string
  type: '' | 'git' | 'local'
  enabled: '' | 'true' | 'false'
}

interface SearchInputProps {
  searchState: SearchState
  onSearchChange: (field: keyof SearchState, value: string) => void
  onClearSearch: () => void
  showFilters: boolean
  onToggleFilters: () => void
  hasActiveSearch: boolean
  loading?: boolean
  placeholder?: string
  debounceDelay?: number
  className?: string
}

export function SearchInput({
  searchState,
  onSearchChange,
  onClearSearch,
  showFilters,
  onToggleFilters,
  hasActiveSearch,
  loading = false,
  placeholder = "搜索仓库名称或描述...",
  debounceDelay = 300,
  className = ""
}: SearchInputProps) {
  const [localQuery, setLocalQuery] = useState(searchState.query)
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null)

  // 当外部searchState.query发生变化时，同步到本地状态
  useEffect(() => {
    setLocalQuery(searchState.query)
  }, [searchState.query])

  // 防抖处理搜索输入
  const handleQueryChange = useCallback((value: string) => {
    setLocalQuery(value)
    
    // 清除之前的防抖定时器
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }

    // 设置新的防抖定时器
    const timeout = setTimeout(() => {
      onSearchChange('query', value)
    }, debounceDelay)

    setDebounceTimeout(timeout)
  }, [onSearchChange, debounceTimeout, debounceDelay])

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout)
      }
    }
  }, [debounceTimeout])

  // 清除搜索查询
  const handleClearQuery = useCallback(() => {
    setLocalQuery('')
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }
    onSearchChange('query', '')
  }, [onSearchChange, debounceTimeout])

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 space-y-4 ${className}`}>
      {/* 搜索栏 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className={`h-4 w-4 ${loading ? 'text-blue-400 animate-pulse' : 'text-gray-400'}`} />
          </div>
          <input
            type="text"
            value={localQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
            className={`w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm transition-colors ${
              loading ? 'bg-gray-50 cursor-not-allowed' : ''
            }`}
          />
          {localQuery && (
            <button
              onClick={handleClearQuery}
              disabled={loading}
              className="absolute inset-y-0 right-0 pr-3 flex items-center disabled:cursor-not-allowed"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
            </button>
          )}
        </div>
        
        <button
          onClick={onToggleFilters}
          disabled={loading}
          className={`px-3 py-2 border rounded-lg flex items-center gap-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            showFilters || hasActiveSearch
              ? 'bg-gray-900 text-white border-gray-900'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          过滤器
          {hasActiveSearch && (
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
          )}
        </button>
        
        {hasActiveSearch && (
          <button
            onClick={onClearSearch}
            disabled={loading}
            className="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            清除搜索
          </button>
        )}
      </div>

      {/* 过滤器面板 */}
      {showFilters && (
        <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              仓库类型
            </label>
            <select
              value={searchState.type}
              onChange={(e) => onSearchChange('type', e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="">全部类型</option>
              <option value="git">Git仓库</option>
              <option value="local">本地目录</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              状态
            </label>
            <select
              value={searchState.enabled}
              onChange={(e) => onSearchChange('enabled', e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-sm disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="">全部状态</option>
              <option value="true">已启用</option>
              <option value="false">已禁用</option>
            </select>
          </div>
        </div>
      )}

      {/* 搜索提示 */}
      {hasActiveSearch && (
        <div className="text-xs text-gray-500 bg-blue-50 px-3 py-2 rounded border border-blue-200">
          <div className="flex items-center gap-2">
            <Search className="w-3 h-3" />
            <span>搜索条件：</span>
            {searchState.query && (
              <span className="font-medium">"{searchState.query}"</span>
            )}
            {searchState.type && (
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                {searchState.type === 'git' ? 'Git仓库' : '本地目录'}
              </span>
            )}
            {searchState.enabled && (
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                {searchState.enabled === 'true' ? '已启用' : '已禁用'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchInput

// 导出类型供外部使用
export type { SearchState }