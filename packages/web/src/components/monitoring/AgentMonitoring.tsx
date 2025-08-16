import React, { useState, useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  WifiOff,
  RefreshCw,
  Settings,
  Bell,
  BellOff,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Clock,
  Zap
} from 'lucide-react'
import type { Agent } from '../../types/agent.types'

interface HealthMetrics {
  cpuUsage?: number
  memoryUsage?: number
  diskUsage?: number
  networkLatency?: number
  activeConnections?: number
  taskQueueSize?: number
  responseTime?: number
  errorRate?: number
}

interface AlertEvent {
  id: string
  agentId: string
  ruleId: string
  ruleName: string
  metric: string
  value: number
  threshold: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: Date
  acknowledged: boolean
}

interface HealthRecord {
  id: string
  agentId: string
  status: string
  metrics: HealthMetrics
  responseTime?: number
  timestamp: Date
  alerts?: AlertEvent[]
}

interface AgentMonitoringProps {
  agent: Agent
  onUpdateMonitoringConfig: (config: any) => Promise<void>
  onAcknowledgeAlert: (alertId: string) => Promise<void>
}

export function AgentMonitoring({ 
  agent, 
  onUpdateMonitoringConfig, 
  onAcknowledgeAlert 
}: AgentMonitoringProps) {
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([])
  const [currentMetrics, setCurrentMetrics] = useState<HealthMetrics>({})
  const [alerts, setAlerts] = useState<AlertEvent[]>([])
  const [monitoringEnabled, setMonitoringEnabled] = useState(
    agent.metadata?.monitoringConfig?.enabled || false
  )
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30) // 秒
  const [showSettings, setShowSettings] = useState(false)
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('1h')

  // WebSocket连接用于实时数据
  useEffect(() => {
    // 这里应该建立WebSocket连接监听实时数据
    // const socket = useSocket()
    // socket.on('agent:health_update', handleHealthUpdate)
    // socket.on('agent:alerts', handleAlertsUpdate)
    // return () => socket.off()
  }, [agent.id])

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refreshHealthData()
    }, refreshInterval * 1000)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, agent.id])

  const refreshHealthData = async () => {
    try {
      // 这里应该调用API获取最新健康数据
      // const data = await agentService.getHealthHistory(agent.id, ...)
      // setHealthRecords(data.records)
      // setCurrentMetrics(data.currentMetrics)
      // setAlerts(data.alerts)
      
      // 模拟数据
      const mockMetrics: HealthMetrics = {
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 100,
        diskUsage: Math.random() * 100,
        networkLatency: Math.random() * 200,
        activeConnections: Math.floor(Math.random() * 10),
        taskQueueSize: Math.floor(Math.random() * 20),
        responseTime: Math.random() * 500,
        errorRate: Math.random() * 5
      }
      setCurrentMetrics(mockMetrics)
    } catch (error) {
      console.error('Failed to refresh health data:', error)
    }
  }

  const handleToggleMonitoring = async () => {
    try {
      const newEnabled = !monitoringEnabled
      await onUpdateMonitoringConfig({
        enabled: newEnabled,
        checkInterval: 60
      })
      setMonitoringEnabled(newEnabled)
    } catch (error) {
      console.error('Failed to toggle monitoring:', error)
    }
  }

  const handleAcknowledgeAlertClick = async (alertId: string) => {
    try {
      await onAcknowledgeAlert(alertId)
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      ))
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return 'text-green-500'
      case 'warning':
        return 'text-yellow-500'
      case 'critical':
      case 'offline':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'critical':
      case 'offline':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Activity className="w-5 h-5 text-gray-500" />
    }
  }

  const formatMetricValue = (value: number | undefined, unit: string) => {
    if (value === undefined) return 'N/A'
    
    switch (unit) {
      case '%':
        return `${Math.round(value)}%`
      case 'ms':
        return `${Math.round(value)}ms`
      case 'MB':
        return `${Math.round(value)}MB`
      default:
        return Math.round(value).toString()
    }
  }

  const getMetricColor = (value: number | undefined, thresholds: { warning: number; critical: number }) => {
    if (value === undefined) return 'text-gray-500'
    if (value >= thresholds.critical) return 'text-red-500'
    if (value >= thresholds.warning) return 'text-yellow-500'
    return 'text-green-500'
  }

  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged)
  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical')

  return (
    <div className="space-y-6">
      {/* 监控状态和控制 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Agent监控</h3>
            {getStatusIcon(agent.status)}
            <span className={`font-medium ${getStatusColor(agent.status)}`}>
              {agent.status === 'connected' ? '在线' : '离线'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* 告警指示器 */}
            {unacknowledgedAlerts.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full">
                <Bell className="w-4 h-4" />
                <span className="text-sm font-medium">{unacknowledgedAlerts.length}</span>
              </div>
            )}

            {/* 监控开关 */}
            <button
              onClick={handleToggleMonitoring}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                monitoringEnabled
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {monitoringEnabled ? (
                <>
                  <Eye className="w-4 h-4" />
                  监控中
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" />
                  已停用
                </>
              )}
            </button>

            {/* 自动刷新 */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded-lg transition-colors ${
                autoRefresh
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={autoRefresh ? '停止自动刷新' : '开启自动刷新'}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </button>

            {/* 设置 */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="监控设置"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 监控设置面板 */}
        {showSettings && (
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  刷新间隔
                </label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value={10}>10秒</option>
                  <option value={30}>30秒</option>
                  <option value={60}>1分钟</option>
                  <option value={300}>5分钟</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  数据时间范围
                </label>
                <select
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="1h">1小时</option>
                  <option value="24h">24小时</option>
                  <option value="7d">7天</option>
                  <option value="30d">30天</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU使用率 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">CPU</span>
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className={`text-2xl font-bold ${getMetricColor(currentMetrics.cpuUsage, { warning: 70, critical: 90 })}`}>
            {formatMetricValue(currentMetrics.cpuUsage, '%')}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(currentMetrics.cpuUsage || 0, 100)}%` }}
            />
          </div>
        </div>

        {/* 内存使用率 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MemoryStick className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">内存</span>
            </div>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <div className={`text-2xl font-bold ${getMetricColor(currentMetrics.memoryUsage, { warning: 80, critical: 95 })}`}>
            {formatMetricValue(currentMetrics.memoryUsage, '%')}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(currentMetrics.memoryUsage || 0, 100)}%` }}
            />
          </div>
        </div>

        {/* 磁盘使用率 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-700">磁盘</span>
            </div>
            <TrendingUp className="w-4 h-4 text-yellow-500" />
          </div>
          <div className={`text-2xl font-bold ${getMetricColor(currentMetrics.diskUsage, { warning: 85, critical: 95 })}`}>
            {formatMetricValue(currentMetrics.diskUsage, '%')}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(currentMetrics.diskUsage || 0, 100)}%` }}
            />
          </div>
        </div>

        {/* 响应时间 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-gray-700">响应时间</span>
            </div>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <div className={`text-2xl font-bold ${getMetricColor(currentMetrics.responseTime, { warning: 200, critical: 500 })}`}>
            {formatMetricValue(currentMetrics.responseTime, 'ms')}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            延迟: {formatMetricValue(currentMetrics.networkLatency, 'ms')}
          </div>
        </div>
      </div>

      {/* 详细指标 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 连接和任务信息 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">连接和任务</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">活跃连接</span>
              </div>
              <span className="font-medium">{currentMetrics.activeConnections || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">任务队列</span>
              </div>
              <span className="font-medium">{currentMetrics.taskQueueSize || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">错误率</span>
              </div>
              <span className={`font-medium ${getMetricColor(currentMetrics.errorRate, { warning: 3, critical: 5 })}`}>
                {formatMetricValue(currentMetrics.errorRate, '%')}
              </span>
            </div>
          </div>
        </div>

        {/* 活跃告警 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-semibold text-gray-900">活跃告警</h4>
            {criticalAlerts.length > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                {criticalAlerts.length} 紧急
              </span>
            )}
          </div>

          {unacknowledgedAlerts.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">一切正常，没有活跃告警</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {unacknowledgedAlerts.slice(0, 5).map(alert => (
                <div 
                  key={alert.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    alert.severity === 'critical' 
                      ? 'bg-red-50 border-l-red-500'
                      : alert.severity === 'high'
                      ? 'bg-orange-50 border-l-orange-500'
                      : alert.severity === 'medium'
                      ? 'bg-yellow-50 border-l-yellow-500'
                      : 'bg-blue-50 border-l-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {alert.ruleName}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {alert.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAcknowledgeAlertClick(alert.id)}
                      className="ml-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
                    >
                      确认
                    </button>
                  </div>
                </div>
              ))}
              
              {unacknowledgedAlerts.length > 5 && (
                <div className="text-center py-2">
                  <span className="text-sm text-gray-500">
                    还有 {unacknowledgedAlerts.length - 5} 个告警...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 最近的健康检查记录 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-semibold text-gray-900">健康检查历史</h4>
          <button
            onClick={refreshHealthData}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>

        {healthRecords.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">暂无健康检查数据</p>
            <p className="text-xs mt-1">启用监控后将开始收集数据</p>
          </div>
        ) : (
          <div className="space-y-2">
            {healthRecords.slice(0, 10).map((record, index) => (
              <div 
                key={record.id || index}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(record.status)}
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {record.status === 'healthy' ? '健康' : '异常'}
                    </span>
                    <p className="text-xs text-gray-500">
                      响应时间: {formatMetricValue(record.responseTime, 'ms')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    {new Date(record.timestamp).toLocaleString()}
                  </p>
                  {record.alerts && record.alerts.length > 0 && (
                    <p className="text-xs text-red-600">
                      {record.alerts.length} 个告警
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}