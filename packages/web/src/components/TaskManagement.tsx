import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Square,
  X
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { cn } from '@/lib/utils'

interface Task {
  id: string
  type: string
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority: number
  payload: Record<string, any>
  result?: Record<string, any>
  error?: string
  agentId?: string
  workerId?: string
  createdBy: string
  assignedAt?: string
  startedAt?: string
  completedAt?: string
  executionTime?: number
  retryCount: number
  maxRetries: number
  metadata?: Record<string, any>
  requirements?: {
    tools?: string[]
    minMemory?: number
    minCpu?: number
    tags?: string[]
  }
  scheduledFor?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

interface TaskStats {
  total: number
  pending: number
  running: number
  completed: number
  failed: number
  avgExecutionTime: number
}

export function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    avgExecutionTime: 0
  })
  const [loading, setLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 表单状态
  const [formData, setFormData] = useState({
    type: 'claude-chat',
    priority: 5,
    payload: {
      prompt: '',
      model: 'claude-3-sonnet',
      maxTokens: 4096
    },
    requirements: {
      tools: ['claude'],
      minMemory: 2048,
      minCpu: 1
    },
    maxRetries: 3
  })

  // 获取任务列表
  const fetchTasks = async () => {
    setLoading(true)
    try {
      const url = filterStatus === 'all' ? '/api/tasks' : `/api/tasks?status=${filterStatus}`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setTasks(data)
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取统计信息
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/tasks/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  useEffect(() => {
    fetchTasks()
    fetchStats()

    // 自动刷新
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchTasks()
        fetchStats()
      }, 3000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [filterStatus, autoRefresh])

  // 创建任务
  const handleCreateTask = async () => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          createdBy: 'admin' // TODO: 从用户上下文获取
        })
      })

      if (response.ok) {
        const newTask = await response.json()
        setTasks([newTask, ...tasks])
        setIsCreating(false)
        resetForm()
        fetchStats()
      }
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  // 取消任务
  const handleCancelTask = async (id: string) => {
    if (!confirm('确定要取消这个任务吗？')) return

    try {
      const response = await fetch(`/api/tasks/${id}/cancel`, {
        method: 'POST'
      })

      if (response.ok) {
        setTasks(tasks.map(t => (t.id === id ? { ...t, status: 'cancelled' } : t)))
        fetchStats()
      }
    } catch (error) {
      console.error('Failed to cancel task:', error)
    }
  }

  // 重试任务
  const handleRetryTask = async (id: string) => {
    try {
      const response = await fetch(`/api/tasks/${id}/retry`, {
        method: 'POST'
      })

      if (response.ok) {
        fetchTasks()
        fetchStats()
      }
    } catch (error) {
      console.error('Failed to retry task:', error)
    }
  }

  // 删除任务
  const handleDeleteTask = async (id: string) => {
    if (!confirm('确定要删除这个任务吗？')) return

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setTasks(tasks.filter(t => t.id !== id))
        fetchStats()
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      type: 'claude-chat',
      priority: 5,
      payload: {
        prompt: '',
        model: 'claude-3-sonnet',
        maxTokens: 4096
      },
      requirements: {
        tools: ['claude'],
        minMemory: 2048,
        minCpu: 1
      },
      maxRetries: 3
    })
  }

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500'
      case 'assigned':
        return 'bg-blue-500'
      case 'running':
        return 'bg-blue-600'
      case 'completed':
        return 'bg-green-500'
      case 'failed':
        return 'bg-red-500'
      case 'cancelled':
        return 'bg-gray-500'
      default:
        return 'bg-gray-500'
    }
  }

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'assigned':
        return <Package className="h-4 w-4" />
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'failed':
        return <AlertTriangle className="h-4 w-4" />
      case 'cancelled':
        return <X className="h-4 w-4" />
      default:
        return null
    }
  }

  // 格式化时间
  const formatTime = (ms: number): string => {
    const seconds = ms / 1000
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`
    return `${(seconds / 3600).toFixed(1)}h`
  }

  // 格式化日期
  const formatDate = (date: string): string => {
    return new Date(date).toLocaleString('zh-CN')
  }

  return (
    <div className="space-y-6">
      {/* 头部操作栏 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>任务管理</CardTitle>
            <div className="flex gap-2 items-center">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="筛选状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="running">运行中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
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

              <Button
                onClick={() => {
                  fetchTasks()
                  fetchStats()
                }}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>

              <Button onClick={() => setIsCreating(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                创建任务
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总计</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">待处理</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">运行中</p>
                <p className="text-2xl font-bold text-blue-600">{stats.running}</p>
              </div>
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已完成</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">失败</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">平均耗时</p>
                <p className="text-2xl font-bold">{formatTime(stats.avgExecutionTime)}</p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 创建任务表单 */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>创建新任务</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">任务类型</label>
                  <Select
                    value={formData.type}
                    onValueChange={value => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-chat">Claude 对话</SelectItem>
                      <SelectItem value="code-generation">代码生成</SelectItem>
                      <SelectItem value="data-analysis">数据分析</SelectItem>
                      <SelectItem value="file-processing">文件处理</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">优先级</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">提示词</label>
                <Textarea
                  rows={4}
                  value={formData.payload.prompt}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      payload: { ...formData.payload, prompt: e.target.value }
                    })
                  }
                  placeholder="输入任务提示词..."
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateTask}>创建任务</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false)
                    resetForm()
                  }}
                >
                  取消
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 任务列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-4">任务</th>
                  <th className="text-left p-4">状态</th>
                  <th className="text-left p-4">优先级</th>
                  <th className="text-left p-4">分配</th>
                  <th className="text-left p-4">执行时间</th>
                  <th className="text-left p-4">创建时间</th>
                  <th className="text-left p-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                      加载中...
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                      暂无任务
                    </td>
                  </tr>
                ) : (
                  tasks.map(task => (
                    <tr key={task.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{task.type}</div>
                          <div className="text-sm text-muted-foreground">
                            {task.id.substring(0, 8)}...
                          </div>
                          {task.error && (
                            <div className="text-xs text-red-600 mt-1">{task.error}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={cn('gap-1', getStatusColor(task.status))}>
                          {getStatusIcon(task.status)}
                          {task.status}
                        </Badge>
                        {task.retryCount > 0 && (
                          <Badge variant="outline" className="ml-1">
                            重试 {task.retryCount}/{task.maxRetries}
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">P{task.priority}</Badge>
                      </td>
                      <td className="p-4">
                        {task.workerId ? (
                          <div className="text-sm">
                            <div className="text-muted-foreground">
                              Worker: {task.workerId?.substring(0, 8)}...
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">未分配</span>
                        )}
                      </td>
                      <td className="p-4">
                        {task.executionTime ? (
                          <span className="text-sm">{formatTime(task.executionTime)}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">
                          {formatDate(task.createdAt)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          {task.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelTask(task.id)}
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          )}
                          {task.status === 'failed' && task.retryCount < task.maxRetries && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRetryTask(task.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          {(task.status === 'completed' ||
                            task.status === 'failed' ||
                            task.status === 'cancelled') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTask(task.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
