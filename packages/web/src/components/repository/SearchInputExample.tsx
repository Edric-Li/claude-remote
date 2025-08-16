import React, { useState, useCallback } from 'react'
import { SearchInput, SearchState } from './SearchInput'

/**
 * SearchInput组件使用示例
 * 展示如何在RepositoryManager或其他组件中集成SearchInput
 */
export function SearchInputExample() {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    type: '',
    enabled: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(false)

  // 处理搜索条件变化
  const handleSearchChange = useCallback((field: keyof SearchState, value: string) => {
    setSearchState(prev => ({
      ...prev,
      [field]: value
    }))
    
    // 这里可以触发实际的搜索逻辑
    console.log('搜索条件变化:', field, value)
    
    // 模拟搜索请求
    if (field === 'query' && value) {
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        console.log('搜索完成:', value)
      }, 1000)
    }
  }, [])

  // 清除搜索
  const handleClearSearch = useCallback(() => {
    setSearchState({
      query: '',
      type: '',
      enabled: ''
    })
    setShowFilters(false)
    console.log('搜索已清除')
  }, [])

  // 切换过滤器显示
  const handleToggleFilters = useCallback(() => {
    setShowFilters(prev => !prev)
  }, [])

  // 检查是否有活跃的搜索条件
  const hasActiveSearch = searchState.query || searchState.type || searchState.enabled

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          SearchInput 组件示例
        </h2>
        <p className="text-gray-600 mb-6">
          这是一个可复用的搜索输入组件，支持防抖搜索、过滤器和状态管理。
        </p>
      </div>

      {/* SearchInput组件 */}
      <SearchInput
        searchState={searchState}
        onSearchChange={handleSearchChange}
        onClearSearch={handleClearSearch}
        showFilters={showFilters}
        onToggleFilters={handleToggleFilters}
        hasActiveSearch={hasActiveSearch}
        loading={loading}
        placeholder="搜索仓库名称或描述..."
        debounceDelay={300}
        className="max-w-4xl"
      />

      {/* 搜索状态显示 */}
      <div className="bg-gray-50 p-4 rounded-lg max-w-4xl">
        <h3 className="font-medium text-gray-900 mb-3">当前搜索状态：</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">查询：</span>
            <span className="text-gray-600">
              {searchState.query || '(无)'}
            </span>
          </div>
          <div>
            <span className="font-medium">类型：</span>
            <span className="text-gray-600">
              {searchState.type ? (searchState.type === 'git' ? 'Git仓库' : '本地目录') : '(全部)'}
            </span>
          </div>
          <div>
            <span className="font-medium">状态：</span>
            <span className="text-gray-600">
              {searchState.enabled ? (searchState.enabled === 'true' ? '已启用' : '已禁用') : '(全部)'}
            </span>
          </div>
          <div>
            <span className="font-medium">显示过滤器：</span>
            <span className="text-gray-600">
              {showFilters ? '是' : '否'}
            </span>
          </div>
          <div>
            <span className="font-medium">有活跃搜索：</span>
            <span className="text-gray-600">
              {hasActiveSearch ? '是' : '否'}
            </span>
          </div>
          <div>
            <span className="font-medium">加载中：</span>
            <span className="text-gray-600">
              {loading ? '是' : '否'}
            </span>
          </div>
        </div>
      </div>

      {/* 集成说明 */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg max-w-4xl">
        <h3 className="font-medium text-blue-900 mb-3">集成到RepositoryManager：</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>1. 从RepositoryManager中移除现有的搜索UI代码</p>
          <p>2. 导入SearchInput组件并传入相应的props</p>
          <p>3. 使用现有的searchState和处理函数</p>
          <p>4. 保持现有的防抖搜索逻辑不变</p>
        </div>
      </div>

      {/* 代码示例 */}
      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg max-w-4xl overflow-x-auto">
        <h3 className="font-medium mb-3">代码示例：</h3>
        <pre className="text-xs">
{`// 在RepositoryManager中使用
import { SearchInput } from './SearchInput'

// 替换现有的搜索UI：
<SearchInput
  searchState={searchState}
  onSearchChange={handleSearchChange}
  onClearSearch={clearSearch}
  showFilters={showFilters}
  onToggleFilters={() => setShowFilters(!showFilters)}
  hasActiveSearch={hasActiveSearch}
  loading={searchState.loading}
  placeholder="搜索仓库名称或描述..."
  debounceDelay={300}
/>`}
        </pre>
      </div>
    </div>
  )
}

export default SearchInputExample