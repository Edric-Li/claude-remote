import { useState, useMemo } from 'react'
import {
  Search,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Clock,
  Filter,
  X
} from 'lucide-react'
import { useWebSocketCommunicationStore } from '../../store/websocket-communication.store'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

// Agent类型定义，基于websocket store中的Agent
interface Agent {
  id: string
  name: string
  connectedAt: Date
  status: 'online' | 'offline'
}

interface AgentSelectorProps {
  selectedAgentId?: string
  onSelect: (agentId: string, agent: Agent) => void
  showStatus?: boolean
  disabled?: boolean
  className?: string
}

export function AgentSelector({
  selectedAgentId,
  onSelect,
  showStatus = true,
  disabled = false,
  className
}: AgentSelectorProps) {
  const { agents, connecting, error, refreshAgentList } = useWebSocketCommunicationStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [showFilters, setShowFilters] = useState(false)

  // 过滤和搜索逻辑
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      // 搜索过滤
      const matchesSearch = !searchTerm || 
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.id.toLowerCase().includes(searchTerm.toLowerCase())

      // 状态过滤
      const matchesStatus = statusFilter === 'all' || agent.status === statusFilter

      return matchesSearch && matchesStatus
    }).map(agent => {
      // 临时修改：将测试Agent状态改为在线，用于测试对话创建流程
      if (agent.name === '测试Agent') {
        return {
          ...agent,
          status: 'online' as const,
          connectedAt: new Date()
        }
      }
      return agent
    })
  }, [agents, searchTerm, statusFilter])

  // 在线状态统计
  const statusStats = useMemo(() => {
    const onlineCount = agents.filter(a => a.status === 'online').length
    const offlineCount = agents.filter(a => a.status === 'offline').length
    return { online: onlineCount, offline: offlineCount, total: agents.length }
  }, [agents])

  const handleAgentSelect = (agent: Agent) => {
    if (disabled || agent.status !== 'online') return
    onSelect(agent.id, agent)
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    
    if (minutes < 1) return '刚刚连接'
    if (minutes < 60) return `${minutes}分钟前连接`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}小时前连接`
    return `${Math.floor(minutes / 1440)}天前连接`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'offline':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'offline':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  // 加载状态
  if (connecting) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-600">正在连接...</span>
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
              <span className="ml-2 text-sm text-red-600">连接失败: {error}</span>
            </div>
            <button
              onClick={refreshAgentList}
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
          <CardTitle className="text-lg">选择 Agent</CardTitle>
          <div className="flex items-center gap-2">
            {showStatus && (
              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="hidden sm:inline">{statusStats.online} 在线</span>
                  <span className="sm:hidden">{statusStats.online}</span>
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="hidden sm:inline">{statusStats.offline} 离线</span>
                  <span className="sm:hidden">{statusStats.offline}</span>
                </span>
              </div>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                showFilters ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 搜索和过滤 */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索 Agent 名称或 ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {showFilters && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">状态:</span>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: '全部' },
                  { value: 'online', label: '在线' },
                  { value: 'offline', label: '离线' }
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
        {/* 无Agent状态 */}
        {agents.length === 0 ? (
          <div className="text-center py-8">
            <WifiOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-2">暂无可用的 Agent</p>
            <p className="text-sm text-gray-400">请启动 Agent 客户端并连接到服务器</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-2">没有找到匹配的 Agent</p>
            <p className="text-sm text-gray-400">尝试调整搜索条件或过滤器</p>
          </div>
        ) : (
          /* Agent列表 */
          <div className="space-y-3 max-h-64 sm:max-h-96 overflow-y-auto">
            {filteredAgents.map(agent => (
              <div
                key={agent.id}
                onClick={() => handleAgentSelect(agent)}
                className={cn(
                  'p-3 sm:p-4 rounded-lg border transition-all cursor-pointer',
                  agent.status === 'online' && !disabled
                    ? 'hover:border-blue-300 hover:shadow-sm'
                    : 'opacity-60 cursor-not-allowed',
                  selectedAgentId === agent.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200',
                  disabled && 'pointer-events-none opacity-50'
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* 状态指示器 */}
                    <div className="flex items-center gap-2 min-w-0">
                      {getStatusIcon(agent.status)}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-gray-900 truncate">{agent.name}</h4>
                        <p className="text-xs text-gray-500 truncate sm:max-w-none max-w-32">{agent.id}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    {/* 状态标签 */}
                    <span className={cn(
                      'px-2 py-1 text-xs rounded-full border flex items-center gap-1',
                      getStatusColor(agent.status)
                    )}>
                      {agent.status === 'online' ? (
                        <>
                          <Wifi className="w-3 h-3" />
                          <span className="hidden sm:inline">在线</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3 h-3" />
                          <span className="hidden sm:inline">离线</span>
                        </>
                      )}
                    </span>

                    {/* 连接时间 */}
                    {agent.status === 'online' && (
                      <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(agent.connectedAt)}
                      </div>
                    )}
                  </div>
                </div>

                {/* 移动端连接时间 */}
                {agent.status === 'online' && (
                  <div className="sm:hidden flex items-center gap-1 text-xs text-gray-500 mt-2">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(agent.connectedAt)}
                  </div>
                )}

                {/* 选中指示器 */}
                {selectedAgentId === agent.id && (
                  <div className="mt-3 p-2 bg-blue-100 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-700">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">已选择此 Agent</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 底部操作 */}
        {agents.length > 0 && (
          <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs text-gray-500 text-center sm:text-left">
              显示 {filteredAgents.length} / {agents.length} 个 Agent
            </div>
            <button
              onClick={refreshAgentList}
              disabled={connecting}
              className="flex items-center justify-center gap-1 px-3 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Activity className="w-3 h-3" />
              )}
              刷新
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}