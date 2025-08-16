import { useState, useMemo } from 'react'
import {
  Search,
  GitBranch,
  FolderOpen,
  Github,
  Gitlab,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Filter,
  X,
  RefreshCw,
  TestTube,
  Clock,
  Globe,
  Lock,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from 'lucide-react'
import { useRepositories } from '../../hooks/useRepositories'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'
import type { Repository, RepositoryType } from '../../types/api.types'

interface RepositorySelectorProps {
  selectedRepositoryId?: string
  onSelect: (repositoryId: string, repository: Repository) => void
  showBranches?: boolean
  disabled?: boolean
  className?: string
}

export function RepositorySelector({
  selectedRepositoryId,
  onSelect,
  showBranches = true,
  disabled = false,
  className
}: RepositorySelectorProps) {
  const { repositories, loading, error, loadRepositories, testConnection } = useRepositories()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | RepositoryType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set())
  const [testingConnections, setTestingConnections] = useState<Set<string>>(new Set())
  const [showTestResults, setShowTestResults] = useState<Set<string>>(new Set())

  // 过滤和搜索逻辑
  const filteredRepositories = useMemo(() => {
    return repositories.filter(repo => {
      // 搜索过滤
      const matchesSearch = !searchTerm || 
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        repo.url.toLowerCase().includes(searchTerm.toLowerCase())

      // 类型过滤
      const matchesType = typeFilter === 'all' || repo.type === typeFilter

      // 状态过滤
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'enabled' && repo.enabled) ||
        (statusFilter === 'disabled' && !repo.enabled)

      return matchesSearch && matchesType && matchesStatus
    })
  }, [repositories, searchTerm, typeFilter, statusFilter])

  // 统计信息
  const stats = useMemo(() => {
    const enabled = repositories.filter(r => r.enabled).length
    const disabled = repositories.filter(r => !r.enabled).length
    const git = repositories.filter(r => r.type === 'git').length
    const local = repositories.filter(r => r.type === 'local').length
    
    return { 
      total: repositories.length, 
      enabled, 
      disabled, 
      git, 
      local 
    }
  }, [repositories])

  const handleRepositorySelect = (repo: Repository) => {
    if (disabled || !repo.enabled) return
    onSelect(repo.id, repo)
  }

  const handleTestConnection = async (repo: Repository) => {
    if (testingConnections.has(repo.id)) return

    setTestingConnections(prev => new Set(prev).add(repo.id))
    
    try {
      await testConnection(repo.id)
      setShowTestResults(prev => new Set(prev).add(repo.id))
    } catch (error) {
      console.error('Connection test failed:', error)
      setShowTestResults(prev => new Set(prev).add(repo.id))
    } finally {
      setTestingConnections(prev => {
        const newSet = new Set(prev)
        newSet.delete(repo.id)
        return newSet
      })
    }
  }

  const toggleExpanded = (repoId: string) => {
    setExpandedRepos(prev => {
      const newSet = new Set(prev)
      if (newSet.has(repoId)) {
        newSet.delete(repoId)
      } else {
        newSet.add(repoId)
      }
      return newSet
    })
  }

  const toggleTestResult = (repoId: string) => {
    setShowTestResults(prev => {
      const newSet = new Set(prev)
      if (newSet.has(repoId)) {
        newSet.delete(repoId)
      } else {
        newSet.add(repoId)
      }
      return newSet
    })
  }

  const getRepositoryIcon = (type: string, url?: string) => {
    if (type === 'local') return <FolderOpen className="w-4 h-4 text-blue-600" />
    if (url?.includes('github.com')) return <Github className="w-4 h-4 text-gray-900" />
    if (url?.includes('gitlab.com')) return <Gitlab className="w-4 h-4 text-orange-600" />
    return <GitBranch className="w-4 h-4 text-green-600" />
  }

  const getStatusIcon = (enabled: boolean, testResult?: any) => {
    if (!enabled) return <XCircle className="w-4 h-4 text-gray-400" />
    if (testResult?.success === true) return <CheckCircle className="w-4 h-4 text-green-500" />
    if (testResult?.success === false) return <XCircle className="w-4 h-4 text-red-500" />
    return <AlertCircle className="w-4 h-4 text-yellow-500" />
  }

  const getStatusColor = (enabled: boolean, testResult?: any) => {
    if (!enabled) return 'text-gray-600 bg-gray-50 border-gray-200'
    if (testResult?.success === true) return 'text-green-600 bg-green-50 border-green-200'
    if (testResult?.success === false) return 'text-red-600 bg-red-50 border-red-200'
    return 'text-blue-600 bg-blue-50 border-blue-200'
  }

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname + urlObj.pathname
    } catch {
      return url
    }
  }

  // 加载状态
  if (loading && repositories.length === 0) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-600">正在加载仓库...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 错误状态
  if (error) {
    return (
      <Card className={cn('w-full border-red-200', className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="ml-2 text-sm text-red-600">加载失败: {error}</span>
            </div>
            <button
              onClick={loadRepositories}
              className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
            >
              重试
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-lg">选择代码仓库</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="hidden sm:inline">{stats.enabled} 已启用</span>
                <span className="sm:hidden">{stats.enabled}</span>
              </span>
              <span className="flex items-center gap-1 text-gray-600">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="hidden sm:inline">{stats.disabled} 已禁用</span>
                <span className="sm:hidden">{stats.disabled}</span>
              </span>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                showFilters ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={loadRepositories}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* 搜索和过滤 */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索仓库名称、描述或URL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {showFilters && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">类型:</span>
                <div className="flex gap-2">
                  {[
                    { value: 'all', label: '全部' },
                    { value: 'git', label: 'Git' },
                    { value: 'local', label: '本地' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setTypeFilter(option.value as any)}
                      className={cn(
                        'px-3 py-1 text-xs rounded transition-colors',
                        typeFilter === option.value
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">状态:</span>
                <div className="flex gap-2">
                  {[
                    { value: 'all', label: '全部' },
                    { value: 'enabled', label: '已启用' },
                    { value: 'disabled', label: '已禁用' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setStatusFilter(option.value as any)}
                      className={cn(
                        'px-3 py-1 text-xs rounded transition-colors',
                        statusFilter === option.value
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <button
                onClick={() => setShowFilters(false)}
                className="ml-auto p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* 无仓库状态 */}
        {repositories.length === 0 ? (
          <div className="text-center py-8">
            <GitBranch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-2">暂无代码仓库</p>
            <p className="text-sm text-gray-400">请先在仓库管理中添加代码仓库</p>
          </div>
        ) : filteredRepositories.length === 0 ? (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-2">没有找到匹配的仓库</p>
            <p className="text-sm text-gray-400">尝试调整搜索条件或过滤器</p>
          </div>
        ) : (
          /* 仓库列表 */
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredRepositories.map(repo => (
              <div
                key={repo.id}
                className={cn(
                  'p-3 sm:p-4 rounded-lg border transition-all',
                  repo.enabled && !disabled
                    ? 'hover:border-blue-300 hover:shadow-sm cursor-pointer'
                    : 'opacity-60 cursor-not-allowed',
                  selectedRepositoryId === repo.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200',
                  disabled && 'pointer-events-none opacity-50'
                )}
              >
                <div className="flex flex-col gap-3">
                  {/* 头部信息 */}
                  <div 
                    className="flex items-center justify-between"
                    onClick={() => handleRepositorySelect(repo)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getRepositoryIcon(repo.type, repo.url)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 truncate">{repo.name}</h4>
                          {repo.branch && showBranches && (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                              {repo.branch}
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-sm text-gray-600 truncate">{repo.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* 状态标签 */}
                      <span className={cn(
                        'px-2 py-1 text-xs rounded-full border flex items-center gap-1',
                        getStatusColor(repo.enabled, repo.metadata?.lastTestResult)
                      )}>
                        {getStatusIcon(repo.enabled, repo.metadata?.lastTestResult)}
                        <span className="hidden sm:inline">
                          {!repo.enabled ? '已禁用' : 
                           repo.metadata?.lastTestResult?.success === true ? '连接正常' :
                           repo.metadata?.lastTestResult?.success === false ? '连接失败' : '未测试'}
                        </span>
                      </span>

                      {/* 展开/收起按钮 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpanded(repo.id)
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {expandedRepos.has(repo.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 基础信息行 */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      {repo.type === 'git' ? <Globe className="w-3 h-3" /> : <FolderOpen className="w-3 h-3" />}
                      <span className="truncate max-w-48 sm:max-w-none">
                        {repo.type === 'local' ? repo.localPath || repo.url : formatUrl(repo.url)}
                      </span>
                    </div>
                    {repo.credentials && (
                      <div className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>私有</span>
                      </div>
                    )}
                  </div>

                  {/* 展开的详细信息 */}
                  {expandedRepos.has(repo.id) && (
                    <div className="space-y-3 pt-3 border-t border-gray-100">
                      {/* 仓库详细信息 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">类型: </span>
                          <span className="text-gray-900">{repo.type === 'git' ? 'Git仓库' : '本地目录'}</span>
                        </div>
                        {repo.branch && (
                          <div>
                            <span className="text-gray-500">分支: </span>
                            <span className="text-gray-900">{repo.branch}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">创建时间: </span>
                          <span className="text-gray-900">
                            {new Date(repo.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">更新时间: </span>
                          <span className="text-gray-900">
                            {new Date(repo.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTestConnection(repo)
                          }}
                          disabled={testingConnections.has(repo.id)}
                          className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                        >
                          {testingConnections.has(repo.id) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <TestTube className="w-3 h-3" />
                          )}
                          测试连接
                        </button>

                        {repo.metadata?.lastTestResult && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleTestResult(repo.id)
                            }}
                            className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                          >
                            {showTestResults.has(repo.id) ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                            测试结果
                          </button>
                        )}
                      </div>

                      {/* 测试结果 */}
                      {showTestResults.has(repo.id) && repo.metadata?.lastTestResult && (
                        <div className={cn(
                          'p-3 rounded border text-xs',
                          repo.metadata.lastTestResult.success
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        )}>
                          <div className="flex items-center gap-2 mb-2">
                            {repo.metadata.lastTestResult.success ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className={cn(
                              'font-medium',
                              repo.metadata.lastTestResult.success ? 'text-green-700' : 'text-red-700'
                            )}>
                              {repo.metadata.lastTestResult.success ? '连接成功' : '连接失败'}
                            </span>
                            {repo.metadata.lastTestDate && (
                              <div className="flex items-center gap-1 text-gray-500 ml-auto">
                                <Clock className="w-3 h-3" />
                                {new Date(repo.metadata.lastTestDate).toLocaleString()}
                              </div>
                            )}
                          </div>
                          <p className={cn(
                            repo.metadata.lastTestResult.success ? 'text-green-700' : 'text-red-700'
                          )}>
                            {repo.metadata.lastTestResult.message}
                          </p>
                          {repo.metadata.lastTestResult.details?.branches && (
                            <div className="mt-2">
                              <span className="text-gray-600">可用分支: </span>
                              <span className="text-gray-900">
                                {repo.metadata.lastTestResult.details.branches.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 选中指示器 */}
                  {selectedRepositoryId === repo.id && (
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-700">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">已选择此仓库</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 底部统计信息 */}
        {repositories.length > 0 && (
          <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs text-gray-500 text-center sm:text-left">
              显示 {filteredRepositories.length} / {repositories.length} 个仓库
              {repositories.length > 0 && (
                <span className="ml-2">
                  (Git: {stats.git}, 本地: {stats.local})
                </span>
              )}
            </div>
            <button
              onClick={loadRepositories}
              disabled={loading}
              className="flex items-center justify-center gap-1 px-3 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              刷新
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}