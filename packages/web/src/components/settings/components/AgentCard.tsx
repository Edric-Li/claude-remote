import React, { useState } from 'react'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  TestTube,
  Loader2,
  Terminal,
  Info,
  Key,
  Edit,
  Trash2,
  RefreshCw,
  Settings,
  Activity,
  Tag,
  Cpu,
  HardDrive,
  MemoryStick
} from 'lucide-react'
import type { Agent, ConnectionTestResult } from '../../../types/agent.types'
import { agentService } from '../../../services/agent.service'
import { useAuthStore } from '../../../store/auth.store'

interface AgentCardProps {
  agent: Agent
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onResetKey: () => Promise<string>
  onTestConnection: () => Promise<ConnectionTestResult>
  onRefresh: () => void
}

export function AgentCard({
  agent,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onResetKey,
  onTestConnection,
  onRefresh
}: AgentCardProps) {
  const { accessToken } = useAuthStore()
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [showConnectionCommand, setShowConnectionCommand] = useState(false)
  const [connectionCommand, setConnectionCommand] = useState<any>(null)
  const [selectedEnv, setSelectedEnv] = useState('local')
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<ConnectionTestResult | null>(null)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'offline':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return '已连接'
      case 'offline':
        return '离线'
      case 'pending':
        return '待连接'
      default:
        return '未知'
    }
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-700'
      case 'offline':
        return 'bg-red-100 text-red-700'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getConnectionStatusIcon = () => {
    if (testingConnection) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
    }

    if (agent.status === 'connected') {
      return <Wifi className="w-4 h-4 text-green-500" />
    } else if (agent.status === 'offline') {
      return <WifiOff className="w-4 h-4 text-red-500" />
    } else {
      return <WifiOff className="w-4 h-4 text-gray-400" />
    }
  }

  const copyToClipboard = async (text: string, silent = false) => {
    try {
      await navigator.clipboard.writeText(text)
      if (!silent) {
        alert('已复制到剪贴板')
      }
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const loadConnectionCommand = async (env: string = 'local') => {
    if (!accessToken) return

    try {
      const data = await agentService.getConnectionCommand(accessToken, agent.id, env)
      setConnectionCommand(data)
    } catch (error) {
      console.error('Failed to load connection command:', error)
    }
  }

  const toggleShowCommand = async () => {
    if (!showConnectionCommand && !connectionCommand) {
      await loadConnectionCommand(selectedEnv)
    }
    setShowConnectionCommand(!showConnectionCommand)
  }

  const handleEnvChange = async (env: string) => {
    setSelectedEnv(env)
    await loadConnectionCommand(env)
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setConnectionResult(null)

    try {
      const result = await onTestConnection()
      setConnectionResult(result)
    } catch (error) {
      console.error('Connection test failed:', error)
      setConnectionResult({
        success: false,
        message: error instanceof Error ? error.message : '连接测试失败',
        timestamp: new Date()
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleResetKey = async () => {
    if (!confirm('确定要重置密钥吗？原密钥将失效，需要重新配置Agent连接。')) {
      return
    }

    try {
      const newKey = await onResetKey()
      alert(`新密钥已生成:\n${newKey}\n\n请妥善保存，密钥只显示一次。`)
    } catch (error) {
      console.error('Failed to reset key:', error)
      alert('重置密钥失败')
    }
  }

  const formatTestTime = (date: Date | string | number) => {
    const now = new Date()
    const testDate = new Date(date)
    
    // 检查日期是否有效
    if (isNaN(testDate.getTime())) {
      return '时间未知'
    }
    
    const diff = now.getTime() - testDate.getTime()
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 1) return '刚刚测试'
    if (minutes < 60) return `${minutes}分钟前测试`
    return `${Math.floor(minutes / 60)}小时前测试`
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  return (
    <div className={`p-4 transition-colors ${selected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {/* 选择框 */}
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />

          {/* Agent信息 */}
          <div className="flex-1">
            {/* 基础信息行 */}
            <div className="flex items-center gap-3 mb-2">
              <h4 className="font-medium text-gray-900">{agent.name}</h4>
              <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${getStatusBgColor(agent.status)}`}>
                {getStatusIcon(agent.status)}
                {getStatusText(agent.status)}
              </span>
              
              {/* 最后验证时间 */}
              {agent.metadata?.lastValidationResult && (
                <span className={`px-2 py-1 text-xs rounded-full ${
                  agent.metadata.lastValidationResult.success
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {agent.metadata.lastValidationResult.success ? '✓ 已验证' : '✗ 验证失败'}
                </span>
              )}
            </div>

            {/* 描述 */}
            <p className="text-sm text-gray-600 mb-3">{agent.description}</p>

            {/* 标签 */}
            {agent.tags && agent.tags.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-gray-400" />
                <div className="flex flex-wrap gap-1">
                  {agent.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 资源信息 */}
            {agent.resources && (
              <div className="grid grid-cols-3 gap-4 mb-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="text-xs text-gray-500">CPU</div>
                    <div className="text-sm font-medium">{agent.resources.cpuCores} 核</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MemoryStick className="w-4 h-4 text-green-500" />
                  <div>
                    <div className="text-xs text-gray-500">内存</div>
                    <div className="text-sm font-medium">{formatBytes(agent.resources.memory * 1024 * 1024)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-purple-500" />
                  <div>
                    <div className="text-xs text-gray-500">磁盘</div>
                    <div className="text-sm font-medium">{formatBytes(agent.resources.diskSpace * 1024 * 1024)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 连接状态和测试结果 */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                {getConnectionStatusIcon()}
                <span className="text-xs text-gray-600">
                  {testingConnection ? '正在测试连接...' : `连接状态: ${getStatusText(agent.status)}`}
                </span>
                
                {agent.metadata?.lastValidationResult && (
                  <span className="text-xs text-gray-500">
                    • 验证响应: {agent.metadata.lastValidationResult.responseTime}ms
                  </span>
                )}
              </div>

              {connectionResult && (
                <div className={`p-2 rounded text-xs ${
                  connectionResult.success
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <div className="flex items-center gap-2">
                    {connectionResult.success ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    <span className="flex-1">{connectionResult.message}</span>
                  </div>
                  <div className="text-xs opacity-75 mt-1">
                    {formatTestTime(connectionResult.timestamp)}
                  </div>
                </div>
              )}
            </div>

            {/* 密钥显示 */}
            {agent.secretKey && (
              <div className="bg-gray-50 rounded p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">密钥</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      {showSecretKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(agent.secretKey)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <code className="text-xs text-gray-800 font-mono break-all">
                  {showSecretKey ? agent.secretKey : '••••••••••••••••••••'}
                </code>
              </div>
            )}

            {/* 基础统计信息 */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>创建时间: {new Date(agent.createdAt).toLocaleDateString()}</span>
              <span>最大Workers: {agent.maxWorkers}</span>
              {agent.lastSeenAt && (
                <span>最后活跃: {new Date(agent.lastSeenAt).toLocaleDateString()}</span>
              )}
              {agent.platform && (
                <span>平台: {agent.platform}</span>
              )}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={onRefresh}
            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
            title="刷新Agent信息"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleShowCommand}
            className="p-2 text-gray-400 hover:text-purple-600 transition-colors"
            title="显示连接命令"
          >
            <Terminal className="w-4 h-4" />
          </button>

          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="p-2 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
            title="测试连接"
          >
            {testingConnection ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <TestTube className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={handleResetKey}
            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
            title="重置密钥"
          >
            <Key className="w-4 h-4" />
          </button>

          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="编辑"
          >
            <Edit className="w-4 h-4" />
          </button>

          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 连接命令显示 */}
      {showConnectionCommand && connectionCommand && (
        <div className="mt-4 p-4 bg-gray-900 rounded-lg text-white">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-medium flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Agent 连接命令
            </h5>
            <div className="flex items-center gap-2">
              <select
                value={selectedEnv}
                onChange={(e) => handleEnvChange(e.target.value)}
                className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white"
              >
                <option value="local">本地环境</option>
                <option value="development">开发环境</option>
                <option value="production">生产环境</option>
              </select>
              <button
                onClick={() => copyToClipboard(connectionCommand.command, true)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title="复制命令"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
          
          <div className="mb-3">
            <code className="text-xs font-mono text-green-400 break-all block p-2 bg-gray-800 rounded">
              {connectionCommand.command}
            </code>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-gray-400 flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>使用说明：</span>
            </p>
            {connectionCommand.instructions.map((instruction: string, idx: number) => (
              <p key={idx} className="text-xs text-gray-300 ml-4">
                {instruction}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}