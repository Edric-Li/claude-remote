import React, { useState, useEffect } from 'react'
import {
  Plus,
  Bot,
  Trash2,
  Edit,
  RefreshCw,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  TestTube,
  Loader2
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'

interface Agent {
  id: string
  name: string
  description: string
  status: 'online' | 'offline' | 'error'
  secretKey?: string
  createdAt: Date
  lastConnected?: Date
  capabilities: string[]
}

interface AgentFormData {
  name: string
  description: string
  capabilities: string[]
}

export function AgentSettings() {
  const { accessToken } = useAuthStore()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [showSecretKey, setShowSecretKey] = useState<{ [key: string]: boolean }>({})
  const [testingConnection, setTestingConnection] = useState<{ [key: string]: boolean }>({})
  const [connectionResults, setConnectionResults] = useState<{
    [key: string]: { success: boolean; message: string; timestamp: Date } | null
  }>({})
  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    description: '',
    capabilities: []
  })

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/agents', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setAgents(data)
      }
    } catch (error) {
      console.error('Failed to load agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const method = editingAgent ? 'PUT' : 'POST'
      const url = editingAgent ? `/api/agents/${editingAgent.id}` : '/api/agents'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await loadAgents()
        resetForm()
      } else {
        const error = await response.json()
        alert(`操作失败: ${error.message}`)
      }
    } catch (error) {
      console.error('Failed to save agent:', error)
      alert('保存失败，请重试')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除Agent "${name}" 吗？此操作不可恢复。`)) {
      return
    }

    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        await loadAgents()
      }
    } catch (error) {
      console.error('Failed to delete agent:', error)
      alert('删除失败，请重试')
    }
  }

  const handleResetKey = async (id: string) => {
    if (!confirm('确定要重置密钥吗？原密钥将失效，需要重新配置Agent连接。')) {
      return
    }

    try {
      const response = await fetch(`/api/agents/${id}/reset-key`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        await loadAgents()

        // 显示新密钥
        alert(`新密钥已生成:\n${result.secretKey}\n\n请妥善保存，密钥只显示一次。`)
      }
    } catch (error) {
      console.error('Failed to reset key:', error)
      alert('重置密钥失败')
    }
  }

  const handleDisconnect = async (id: string) => {
    try {
      const response = await fetch(`/api/agents/${id}/disconnect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        await loadAgents()
      }
    } catch (error) {
      console.error('Failed to disconnect agent:', error)
      alert('断开连接失败')
    }
  }

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setFormData({
      name: agent.name,
      description: agent.description,
      capabilities: []
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      capabilities: []
    })
    setEditingAgent(null)
    setShowForm(false)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('已复制到剪贴板')
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const toggleShowKey = (agentId: string) => {
    setShowSecretKey(prev => ({
      ...prev,
      [agentId]: !prev[agentId]
    }))
  }

  /**
   * 测试Agent连通状态 - 基于现代HTTP通信
   */
  const handleTestConnection = async (agent: Agent) => {
    setTestingConnection(prev => ({ ...prev, [agent.id]: true }))
    setConnectionResults(prev => ({ ...prev, [agent.id]: null }))

    try {
      console.log(`🧪 Testing connection to Agent: ${agent.name} (${agent.id})`)

      // 暂时模拟测试连接，因为后端还没有实现test-connection端点
      // TODO: 实现后端的test-connection端点
      await new Promise(resolve => setTimeout(resolve, 1000)) // 模拟延迟

      const result = {
        success: false,
        message: '测试连接功能暂未实现，请等待后端实现'
      }
      const response = { ok: false }

      if (false) {
        // 暂时禁用成功路径
        const successResult = {
          success: true,
          message: result.message || `Agent ${agent.name} 连接正常`,
          timestamp: new Date()
        }

        setConnectionResults(prev => ({
          ...prev,
          [agent.id]: successResult
        }))

        // 可选：更新Agent状态为在线
        setAgents(prev =>
          prev.map(a =>
            a.id === agent.id ? { ...a, status: 'online', lastConnected: new Date() } : a
          )
        )

        console.log(`✅ Connection test successful for ${agent.name}`)
      } else {
        const errorResult = {
          success: false,
          message: result.message || result.error || `Agent ${agent.name} 连接失败`,
          timestamp: new Date()
        }

        setConnectionResults(prev => ({
          ...prev,
          [agent.id]: errorResult
        }))

        // 可选：更新Agent状态为错误
        setAgents(prev => prev.map(a => (a.id === agent.id ? { ...a, status: 'error' } : a)))

        console.log(`❌ Connection test failed for ${agent.name}: ${errorResult.message}`)
      }
    } catch (error: any) {
      console.error(`❌ Connection test error for ${agent.name}:`, error)

      const errorResult = {
        success: false,
        message: `连接测试失败: ${error.message || '网络错误'}`,
        timestamp: new Date()
      }

      setConnectionResults(prev => ({
        ...prev,
        [agent.id]: errorResult
      }))

      // 更新Agent状态为错误
      setAgents(prev => prev.map(a => (a.id === agent.id ? { ...a, status: 'error' } : a)))
    } finally {
      setTestingConnection(prev => ({ ...prev, [agent.id]: false }))
    }
  }

  /**
   * 获取连接状态图标
   */
  const getConnectionStatusIcon = (agent: Agent) => {
    const isTestingNow = testingConnection[agent.id]
    const testResult = connectionResults[agent.id]

    if (isTestingNow) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
    }

    // 基于实际状态显示图标
    if (agent.status === 'online') {
      return <Wifi className="w-4 h-4 text-green-500" />
    } else if (agent.status === 'error') {
      return <WifiOff className="w-4 h-4 text-red-500" />
    } else {
      return <WifiOff className="w-4 h-4 text-gray-400" />
    }
  }

  /**
   * 格式化连接测试结果时间
   */
  const formatTestTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 1) return '刚刚测试'
    if (minutes < 60) return `${minutes}分钟前测试`
    return `${Math.floor(minutes / 60)}小时前测试`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return '在线'
      case 'error':
        return '错误'
      default:
        return '离线'
    }
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-100 text-green-700'
      case 'error':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
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
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加Agent
        </button>
      </div>

      {/* Agent列表 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {agents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h4 className="font-medium text-gray-900 mb-2">还没有配置Agent</h4>
            <p className="text-sm mb-4">添加您的第一个AI Agent开始使用</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              添加Agent
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {agents.map(agent => (
              <div key={agent.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">{agent.name}</h4>
                      <span
                        className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${getStatusBgColor(agent.status)}`}
                      >
                        {getStatusIcon(agent.status)}
                        {getStatusText(agent.status)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">{agent.description}</p>

                    {/* 连接状态和测试结果 */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        {getConnectionStatusIcon(agent)}
                        <span className="text-xs text-gray-600">
                          {testingConnection[agent.id]
                            ? '正在测试连接...'
                            : `连接状态: ${getStatusText(agent.status)}`}
                        </span>
                      </div>

                      {connectionResults[agent.id] && (
                        <div
                          className={`p-2 rounded text-xs ${
                            connectionResults[agent.id]!.success
                              ? 'bg-green-50 border border-green-200 text-green-700'
                              : 'bg-red-50 border border-red-200 text-red-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {connectionResults[agent.id]!.success ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            <span className="flex-1">{connectionResults[agent.id]!.message}</span>
                          </div>
                          <div className="text-xs opacity-75 mt-1">
                            {formatTestTime(connectionResults[agent.id]!.timestamp)}
                          </div>
                        </div>
                      )}
                    </div>

                    {agent.secretKey && (
                      <div className="bg-gray-50 rounded p-3 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium text-gray-700">密钥</label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleShowKey(agent.id)}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              {showSecretKey[agent.id] ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={() => copyToClipboard(agent.secretKey!)}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <code className="text-xs text-gray-800 font-mono break-all">
                          {showSecretKey[agent.id] ? agent.secretKey : '••••••••••••••••••••'}
                        </code>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>创建时间: {new Date(agent.createdAt).toLocaleDateString()}</span>
                      {agent.lastConnected && (
                        <span>最后连接: {new Date(agent.lastConnected).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {agent.status === 'online' && (
                      <button
                        onClick={() => handleDisconnect(agent.id)}
                        className="p-2 text-gray-400 hover:text-orange-600 transition-colors"
                        title="断开连接"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleTestConnection(agent)}
                      disabled={testingConnection[agent.id]}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                      title="测试连接"
                    >
                      {testingConnection[agent.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleResetKey(agent.id)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="重置密钥"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(agent)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(agent.id, agent.name)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加/编辑表单模态框 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingAgent ? '编辑Agent' : '添加Agent'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agent名称</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    placeholder="输入Agent名称"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    rows={3}
                    placeholder="Agent描述和用途"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    {editingAgent ? '保存更改' : '添加Agent'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
