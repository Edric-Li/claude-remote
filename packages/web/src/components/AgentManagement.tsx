import { useState, useEffect } from 'react'
import { Plus, Key, Trash2, Edit, Copy, Eye, EyeOff, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { cn } from '@/lib/utils'
import { useAuthStore } from '../store/auth.store'
import { API_BASE_URL } from '../config'

interface Agent {
  id: string
  name: string
  description?: string
  secretKey: string
  maxWorkers: number
  status: 'pending' | 'connected' | 'offline'
  hostname?: string
  platform?: string
  ipAddress?: string
  resources?: {
    cpuCores: number
    memory: number
    diskSpace: number
  }
  tags?: string[]
  allowedTools?: string[]
  lastSeenAt?: string
  createdAt: string
  updatedAt: string
}

export function AgentManagement() {
  const { accessToken } = useAuthStore()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    maxWorkers: 4,
    tags: [] as string[],
    allowedTools: ['claude', 'qwen'] as string[]
  })

  // 获取 Agent 列表
  const fetchAgents = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setAgents(data)
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  // 创建 Agent
  const handleCreate = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          createdBy: 'admin'
        })
      })
      
      if (response.ok) {
        const newAgent = await response.json()
        setAgents([newAgent, ...agents])
        setIsCreating(false)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to create agent:', error)
    }
  }

  // 更新 Agent
  const handleUpdate = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        const updatedAgent = await response.json()
        setAgents(agents.map(a => a.id === id ? updatedAgent : a))
        setEditingId(null)
        resetForm()
      }
    } catch (error) {
      console.error('Failed to update agent:', error)
    }
  }

  // 删除 Agent
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个 Agent 吗？')) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      if (response.ok) {
        setAgents(agents.filter(a => a.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete agent:', error)
    }
  }

  // 重置密钥
  const handleResetKey = async (id: string) => {
    if (!confirm('确定要重置密钥吗？旧密钥将无法使用。')) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents/${id}/reset-key`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      if (response.ok) {
        const { secretKey } = await response.json()
        setAgents(agents.map(a => 
          a.id === id ? { ...a, secretKey } : a
        ))
        // 自动显示新密钥
        setShowKeys({ ...showKeys, [id]: true })
      }
    } catch (error) {
      console.error('Failed to reset key:', error)
    }
  }

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // 切换密钥显示
  const toggleKeyVisibility = (id: string) => {
    setShowKeys({ ...showKeys, [id]: !showKeys[id] })
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      maxWorkers: 4,
      tags: [],
      allowedTools: ['claude', 'qwen']
    })
  }

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500'
      case 'offline':
        return 'bg-gray-500'
      case 'pending':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4" />
      case 'offline':
        return <WifiOff className="h-4 w-4" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* 头部操作栏 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Agent 管理</CardTitle>
            <div className="flex gap-2">
              <Button onClick={fetchAgents} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
              <Button onClick={() => setIsCreating(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                创建 Agent
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 创建/编辑表单 */}
      {(isCreating || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle>{isCreating ? '创建新 Agent' : '编辑 Agent'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">名称</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：北京-GPU服务器"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">描述</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="可选的描述信息"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">最大 Worker 数</label>
                <Input
                  type="number"
                  min={1}
                  max={32}
                  value={formData.maxWorkers}
                  onChange={(e) => setFormData({ ...formData, maxWorkers: parseInt(e.target.value) })}
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (isCreating) {
                      handleCreate()
                    } else if (editingId) {
                      handleUpdate(editingId)
                    }
                  }}
                >
                  {isCreating ? '创建' : '保存'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false)
                    setEditingId(null)
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

      {/* Agent 列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-4">名称</th>
                  <th className="text-left p-4">状态</th>
                  <th className="text-left p-4">Workers</th>
                  <th className="text-left p-4">密钥</th>
                  <th className="text-left p-4">系统信息</th>
                  <th className="text-left p-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      加载中...
                    </td>
                  </tr>
                ) : agents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      暂无 Agent，点击"创建 Agent"开始
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={agent.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{agent.name}</div>
                          {agent.description && (
                            <div className="text-sm text-muted-foreground">{agent.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={cn('gap-1', getStatusColor(agent.status))}>
                          {getStatusIcon(agent.status)}
                          {agent.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">0/{agent.maxWorkers}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {showKeys[agent.id] 
                              ? agent.secretKey 
                              : '••••••••••••••••'}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleKeyVisibility(agent.id)}
                          >
                            {showKeys[agent.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(agent.secretKey)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="p-4">
                        {agent.hostname ? (
                          <div className="text-sm">
                            <div>{agent.hostname}</div>
                            <div className="text-muted-foreground">
                              {agent.platform} • {agent.ipAddress}
                            </div>
                            {agent.resources && (
                              <div className="text-muted-foreground">
                                {agent.resources.cpuCores} CPUs • {Math.round(agent.resources.memory / 1024)}GB RAM
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">未连接</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(agent.id)
                              setFormData({
                                name: agent.name,
                                description: agent.description || '',
                                maxWorkers: agent.maxWorkers,
                                tags: agent.tags || [],
                                allowedTools: agent.allowedTools || ['claude', 'qwen']
                              })
                            }}
                            disabled={agent.status === 'connected'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResetKey(agent.id)}
                            disabled={agent.status === 'connected'}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(agent.id)}
                            disabled={agent.status === 'connected'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* 快速部署指南 */}
      <Card>
        <CardHeader>
          <CardTitle>快速部署指南</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">选择一个 Agent 并复制其密钥，然后在目标机器上运行：</p>
            <pre className="bg-muted p-4 rounded text-sm">
{`# 安装 Agent
npm install -g @ai-orchestra/agent

# 使用密钥启动 Agent  
ai-orchestra-agent start --key YOUR-SECRET-KEY --server ${window.location.origin}`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}