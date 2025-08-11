import { useState, useEffect } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Cpu,
  HardDrive,
  RefreshCw,
  Server,
  Square,
  Zap
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

interface Worker {
  id: string
  workerId: string
  name: string
  agentId: string
  status: 'idle' | 'busy' | 'offline' | 'error'
  currentTaskId?: string
  currentTaskType?: string
  capabilities?: {
    supportedTools: string[]
    maxConcurrentTasks: number
    resourceLimits: {
      maxMemory: number
      maxCpu: number
      maxDiskIO: number
    }
  }
  metrics?: {
    tasksCompleted: number
    tasksFailed: number
    totalExecutionTime: number
    averageExecutionTime: number
    successRate: number
    lastTaskCompletedAt: string | null
  }
  systemInfo?: {
    pid: number
    memory: {
      used: number
      total: number
    }
    cpu: {
      usage: number
      cores: number
    }
  }
  startedAt: string
  lastHeartbeat: string
  lastError?: string
  lastErrorAt?: string
}

interface Agent {
  id: string
  name: string
  status: string
}

interface WorkerStats {
  total: number
  idle: number
  busy: number
  offline: number
  error: number
}

export function WorkerManagement() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all')
  const [stats, setStats] = useState<WorkerStats>({
    total: 0,
    idle: 0,
    busy: 0,
    offline: 0,
    error: 0
  })
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 获取 Agent 列表
  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents')
      if (response.ok) {
        const data = await response.json()
        setAgents(data.filter((a: Agent) => a.status === 'connected'))
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    }
  }

  // 获取 Worker 列表
  const fetchWorkers = async () => {
    setLoading(true)
    try {
      const url =
        selectedAgentId === 'all' ? '/api/workers/active' : `/api/workers/agent/${selectedAgentId}`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setWorkers(data)

        // 计算统计信息
        const newStats: WorkerStats = {
          total: data.length,
          idle: data.filter((w: Worker) => w.status === 'idle').length,
          busy: data.filter((w: Worker) => w.status === 'busy').length,
          offline: data.filter((w: Worker) => w.status === 'offline').length,
          error: data.filter((w: Worker) => w.status === 'error').length
        }
        setStats(newStats)
      }
    } catch (error) {
      console.error('Failed to fetch workers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  useEffect(() => {
    fetchWorkers()

    // 自动刷新
    if (autoRefresh) {
      const interval = setInterval(fetchWorkers, 5000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [selectedAgentId, autoRefresh])

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'bg-green-500'
      case 'busy':
        return 'bg-blue-500'
      case 'offline':
        return 'bg-gray-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle':
        return <CheckCircle className="h-4 w-4" />
      case 'busy':
        return <Activity className="h-4 w-4" />
      case 'offline':
        return <AlertCircle className="h-4 w-4" />
      case 'error':
        return <AlertCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  // 格式化时间
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`
    return `${(seconds / 3600).toFixed(1)}h`
  }

  // 格式化内存
  const formatMemory = (mb: number): string => {
    if (mb < 1024) return `${mb.toFixed(0)}MB`
    return `${(mb / 1024).toFixed(1)}GB`
  }

  // 计算时间差
  const getTimeDiff = (date: string): string => {
    const diff = Date.now() - new Date(date).getTime()
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return `${seconds}秒前`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小时前`
    const days = Math.floor(hours / 24)
    return `${days}天前`
  }

  return (
    <div className="space-y-6">
      {/* 头部操作栏 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Worker 管理</CardTitle>
            <div className="flex gap-2 items-center">
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="选择 Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有 Agent</SelectItem>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', autoRefresh && 'animate-spin')} />
                自动刷新
              </Button>

              <Button onClick={fetchWorkers} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总计</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">空闲</p>
                <p className="text-2xl font-bold text-green-600">{stats.idle}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">工作中</p>
                <p className="text-2xl font-bold text-blue-600">{stats.busy}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">离线</p>
                <p className="text-2xl font-bold text-gray-600">{stats.offline}</p>
              </div>
              <Square className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">错误</p>
                <p className="text-2xl font-bold text-red-600">{stats.error}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Worker 列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-4">Worker</th>
                  <th className="text-left p-4">状态</th>
                  <th className="text-left p-4">当前任务</th>
                  <th className="text-left p-4">性能指标</th>
                  <th className="text-left p-4">系统资源</th>
                  <th className="text-left p-4">心跳</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      加载中...
                    </td>
                  </tr>
                ) : workers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      暂无活跃的 Worker
                    </td>
                  </tr>
                ) : (
                  workers.map(worker => (
                    <tr key={worker.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{worker.name}</div>
                          <div className="text-sm text-muted-foreground">ID: {worker.workerId}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={cn('gap-1', getStatusColor(worker.status))}>
                          {getStatusIcon(worker.status)}
                          {worker.status}
                        </Badge>
                        {worker.lastError && (
                          <div className="mt-1 text-xs text-red-600">{worker.lastError}</div>
                        )}
                      </td>
                      <td className="p-4">
                        {worker.currentTaskId ? (
                          <div className="text-sm">
                            <div className="font-medium">{worker.currentTaskType}</div>
                            <div className="text-muted-foreground">
                              {worker.currentTaskId.substring(0, 8)}...
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {worker.metrics ? (
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <Zap className="h-3 w-3 text-green-600" />
                              <span>完成: {worker.metrics.tasksCompleted}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-3 w-3 text-red-600" />
                              <span>失败: {worker.metrics.tasksFailed}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-blue-600" />
                              <span>平均: {formatTime(worker.metrics.averageExecutionTime)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Activity className="h-3 w-3 text-purple-600" />
                              <span>成功率: {worker.metrics.successRate.toFixed(1)}%</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {worker.systemInfo ? (
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <Cpu className="h-3 w-3" />
                              <span>CPU: {worker.systemInfo.cpu.usage.toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <HardDrive className="h-3 w-3" />
                              <span>
                                内存: {formatMemory(worker.systemInfo.memory.used)}/
                                {formatMemory(worker.systemInfo.memory.total)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm">{getTimeDiff(worker.lastHeartbeat)}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Worker 能力说明 */}
      <Card>
        <CardHeader>
          <CardTitle>Worker 能力说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">支持的工具</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Claude</Badge>
                <Badge variant="outline">GPT-4</Badge>
                <Badge variant="outline">Qwen</Badge>
                <Badge variant="outline">DeepSeek</Badge>
                <Badge variant="outline">GLM</Badge>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">资源限制</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 最大内存: 8GB</li>
                <li>• 最大 CPU: 4 核</li>
                <li>• 最大并发任务: 2</li>
                <li>• 心跳超时: 60 秒</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
