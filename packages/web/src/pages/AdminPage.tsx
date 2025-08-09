import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AgentManagement } from '../components/AgentManagement'
import { RepositoryManagement } from '../components/RepositoryManagement'
import { 
  ArrowLeft, Settings, Database, Activity, Shield, 
  RefreshCw, Download, Trash2, Plus, Server, 
  HardDrive, Cpu, Clock, AlertCircle, Lock,
  Key, Globe, FileText, Zap, Bot, Eye, EyeOff, GitBranch,
  CheckCircle
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { API_BASE_URL } from '../config'
import { RadixBackground } from '../components/RadixBackground'

type AdminTab = 'overview' | 'agents' | 'repositories' | 'claude' | 'database' | 'security'

export function AdminPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // 从 URL 参数或 localStorage 获取初始标签
  const getInitialTab = (): AdminTab => {
    const urlTab = searchParams.get('tab') as AdminTab
    const savedTab = localStorage.getItem('adminActiveTab') as AdminTab
    
    // 验证标签是否有效
    const validTabs: AdminTab[] = ['overview', 'agents', 'repositories', 'claude', 'database', 'security']
    
    if (urlTab && validTabs.includes(urlTab)) {
      return urlTab
    }
    if (savedTab && validTabs.includes(savedTab)) {
      return savedTab
    }
    return 'overview'
  }
  
  const [activeTab, setActiveTab] = useState<AdminTab>(getInitialTab())

  const tabs = [
    { id: 'overview' as AdminTab, label: '系统概览', icon: Activity },
    { id: 'agents' as AdminTab, label: 'Agent 管理', icon: Settings },
    { id: 'repositories' as AdminTab, label: '仓库管理', icon: GitBranch },
    { id: 'claude' as AdminTab, label: 'Claude 配置', icon: Bot },
    { id: 'database' as AdminTab, label: '数据库', icon: Database },
    { id: 'security' as AdminTab, label: '安全设置', icon: Shield },
  ]
  
  // 当标签改变时，更新 URL 和 localStorage
  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
    localStorage.setItem('adminActiveTab', tab)
  }
  
  // 初始化时同步 URL
  useEffect(() => {
    if (!searchParams.get('tab')) {
      setSearchParams({ tab: activeTab })
    }
  }, [])
  
  // 监听 URL 变化（处理浏览器前进/后退）
  useEffect(() => {
    const urlTab = searchParams.get('tab') as AdminTab
    const validTabs: AdminTab[] = ['overview', 'agents', 'repositories', 'claude', 'database', 'security']
    
    if (urlTab && validTabs.includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab)
      localStorage.setItem('adminActiveTab', urlTab)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-background relative">
      {/* 背景 */}
      <RadixBackground />
      
      {/* Header */}
      <header className="relative z-10 backdrop-blur-md bg-background/60 border-b border-border/50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回主页
            </Button>
            <div className="h-6 w-px bg-border/50" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
              AI Orchestra 管理后台
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
              管理员
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-64px)] relative z-10">
        {/* Sidebar */}
        <aside className="w-64 backdrop-blur-md bg-card/40 border-r border-border/50">
          <nav className="p-4 space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/25'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && <OverviewPanel />}
            {activeTab === 'agents' && <AgentManagement />}
            {activeTab === 'repositories' && <RepositoryManagement />}
            {activeTab === 'claude' && <ClaudeConfigPanel />}
            {activeTab === 'database' && <DatabasePanel />}
            {activeTab === 'security' && <SecurityPanel />}
          </div>
        </main>
      </div>
    </div>
  )
}

// 系统概览面板
function OverviewPanel() {
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOverview()
    const interval = setInterval(fetchOverview, 10000) // 每10秒刷新
    return () => clearInterval(interval)
  }, [])

  const fetchOverview = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/system/overview`)
      const data = await response.json()
      setOverview(data)
    } catch (error) {
      console.error('Failed to fetch overview:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
          系统概览
        </h2>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={fetchOverview}
          className="border-purple-500/20 hover:bg-purple-500/10"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="backdrop-blur-md bg-card/60 border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Settings className="h-4 w-4" />
              总 Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
              {overview?.statistics?.totalAgents || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-400">{overview?.statistics?.connectedAgents || 0}</span> 在线
            </p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-card/60 border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              CPU 使用率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              <span className={`${(overview?.resources?.cpu?.usage || 0) > 80 ? 'text-red-400' : 'text-green-400'}`}>
                {overview?.resources?.cpu?.usage || 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview?.resources?.cpu?.cores || 0} 核心
            </p>
          </CardContent>
        </Card>
        
        <Card className="backdrop-blur-md bg-card/60 border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              内存使用
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              <span className={`${(overview?.resources?.memory?.usage || 0) > 80 ? 'text-red-400' : 'text-green-400'}`}>
                {overview?.resources?.memory?.usage || 0}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview?.resources?.memory?.used} / {overview?.resources?.memory?.total}
            </p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-md bg-card/60 border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              运行时间
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {overview?.application?.uptime || '0h'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              版本 {overview?.application?.version || 'unknown'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 系统信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4 text-purple-400" />
              系统信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: '平台', value: overview?.platform?.name },
              { label: '架构', value: overview?.platform?.arch },
              { label: '主机名', value: overview?.platform?.hostname },
              { label: '系统运行时间', value: overview?.platform?.uptime },
              { label: 'Node 版本', value: overview?.application?.nodeVersion },
            ].map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}:</span>
                <span className="font-mono text-purple-400">{item.value || 'N/A'}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              最近活动
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overview?.recentActivity?.length > 0 ? (
                overview.recentActivity.slice(0, 5).map((activity: any) => (
                  <div key={activity.id} className="flex items-start gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 animate-pulse" />
                    <div className="flex-1">
                      <p className="text-foreground">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  暂无活动记录
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// 数据库面板
function DatabasePanel() {
  const [dbInfo, setDbInfo] = useState<any>(null)
  const [backups, setBackups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDatabaseInfo()
    fetchBackups()
  }, [])

  const fetchDatabaseInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/database/info`)
      const data = await response.json()
      setDbInfo(data)
    } catch (error) {
      console.error('Failed to fetch database info:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBackups = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/database/backups`)
      const data = await response.json()
      setBackups(data)
    } catch (error) {
      console.error('Failed to fetch backups:', error)
    }
  }

  const handleBackup = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/database/backup`, {
        method: 'POST'
      })
      const result = await response.json()
      if (result.success) {
        alert(`备份成功: ${result.filename}`)
        fetchBackups()
      } else {
        alert(`备份失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to create backup:', error)
      alert('备份失败')
    }
  }

  const handleOptimize = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/database/optimize`, {
        method: 'POST'
      })
      const result = await response.json()
      if (result.success) {
        alert('数据库优化成功')
        fetchDatabaseInfo()
      } else {
        alert(`优化失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to optimize database:', error)
      alert('优化失败')
    }
  }

  const handleClearConversations = async () => {
    if (!confirm('确定要清除所有对话内容吗？此操作不可恢复！')) {
      return
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/database/conversations`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (result.success) {
        alert(`清除成功！删除了 ${result.deletedSessions} 个会话，${result.deletedMessages} 条消息`)
        fetchDatabaseInfo()
      } else {
        alert(`清除失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to clear conversations:', error)
      alert('清除失败')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
        数据库管理
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-400" />
              数据库信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: '类型', value: dbInfo?.type?.toUpperCase() },
              { label: '数据库', value: dbInfo?.database },
              { label: '版本', value: dbInfo?.version },
              { label: '大小', value: dbInfo?.size },
            ].map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}:</span>
                <span className="font-mono text-purple-400">{item.value || 'N/A'}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">状态:</span>
              <Badge 
                variant={dbInfo?.status === 'connected' ? 'default' : 'destructive'}
                className={dbInfo?.status === 'connected' ? 'bg-green-500/10 text-green-400 border-green-500/20' : ''}
              >
                {dbInfo?.status === 'connected' ? '已连接' : '未连接'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-400" />
              数据库操作
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={handleBackup} 
              className="w-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400"
            >
              <Download className="h-4 w-4 mr-2" />
              创建备份
            </Button>
            <Button 
              onClick={handleOptimize} 
              className="w-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              优化数据库
            </Button>
            <Button 
              onClick={handleClearConversations} 
              className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              清除所有对话
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 数据表信息 */}
      {dbInfo?.tables && dbInfo.tables.length > 0 && (
        <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-400" />
              数据表
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {dbInfo.tables.map((table: any) => (
                <div key={table.name} className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                  <p className="font-mono text-sm text-purple-400">{table.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{table.rowCount} 行</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 备份列表 */}
      <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-purple-400" />
            备份列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {backups.length > 0 ? (
            <div className="space-y-2">
              {backups.map((backup: any) => (
                <div key={backup.filename} className="flex items-center justify-between p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                  <div className="text-sm">
                    <p className="font-mono text-purple-400">{backup.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {backup.size} · {new Date(backup.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              暂无备份
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// 安全设置面板
function SecurityPanel() {
  const [settings, setSettings] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [tokens, setTokens] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newTokenName, setNewTokenName] = useState('')
  const [newIP, setNewIP] = useState('')

  useEffect(() => {
    fetchSecuritySettings()
    fetchSecurityLogs()
    fetchTokens()
  }, [])

  const fetchSecuritySettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/settings`)
      const data = await response.json()
      setSettings(data)
    } catch (error) {
      console.error('Failed to fetch security settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSecurityLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/logs?limit=50`)
      const data = await response.json()
      setLogs(data)
    } catch (error) {
      console.error('Failed to fetch security logs:', error)
    }
  }

  const fetchTokens = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/tokens`)
      const data = await response.json()
      setTokens(data)
    } catch (error) {
      console.error('Failed to fetch tokens:', error)
    }
  }

  const updateSettings = async (newSettings: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })
      const data = await response.json()
      setSettings(data)
    } catch (error) {
      console.error('Failed to update settings:', error)
    }
  }

  const generateToken = async () => {
    if (!newTokenName) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName })
      })
      const data = await response.json()
      alert(`令牌已生成: ${data.token}\n请妥善保存，此令牌仅显示一次！`)
      setNewTokenName('')
      fetchTokens()
    } catch (error) {
      console.error('Failed to generate token:', error)
    }
  }

  const addIPToWhitelist = async () => {
    if (!newIP) return
    
    try {
      await fetch(`${API_BASE_URL}/api/security/whitelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIP })
      })
      setNewIP('')
      
      const updatedSettings = {
        ...settings,
        ipWhitelist: {
          ...settings.ipWhitelist,
          ips: [...settings.ipWhitelist.ips, newIP]
        }
      }
      setSettings(updatedSettings)
    } catch (error) {
      console.error('Failed to add IP:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
        安全设置
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 认证设置 */}
        <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-purple-400" />
              认证设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-purple-400">启用认证</Label>
              <Switch 
                checked={settings?.authentication?.enabled}
                onCheckedChange={(checked) => {
                  updateSettings({
                    ...settings,
                    authentication: { ...settings.authentication, enabled: checked }
                  })
                }}
                className="data-[state=checked]:bg-purple-500"
              />
            </div>
            
            <div>
              <Label className="text-purple-400">认证方式</Label>
              <Select 
                value={settings?.authentication?.method}
                onValueChange={(value) => {
                  updateSettings({
                    ...settings,
                    authentication: { ...settings.authentication, method: value }
                  })
                }}
              >
                <SelectTrigger className="border-purple-500/20 bg-purple-500/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无</SelectItem>
                  <SelectItem value="basic">基础认证</SelectItem>
                  <SelectItem value="token">令牌认证</SelectItem>
                  <SelectItem value="oauth">OAuth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* IP 白名单 */}
        <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-400" />
              IP 白名单
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-purple-400">启用 IP 白名单</Label>
              <Switch 
                checked={settings?.ipWhitelist?.enabled}
                onCheckedChange={(checked) => {
                  updateSettings({
                    ...settings,
                    ipWhitelist: { ...settings.ipWhitelist, enabled: checked }
                  })
                }}
                className="data-[state=checked]:bg-purple-500"
              />
            </div>
            
            <div className="flex gap-2">
              <Input 
                placeholder="IP 地址 (如: 192.168.1.1)" 
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                className="border-purple-500/20 bg-purple-500/5 placeholder:text-muted-foreground/50"
              />
              <Button 
                onClick={addIPToWhitelist}
                className="bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {settings?.ipWhitelist?.ips?.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {settings.ipWhitelist.ips.map((ip: string) => (
                  <div key={ip} className="flex items-center justify-between p-2 rounded bg-purple-500/5 border border-purple-500/10">
                    <span className="font-mono text-sm text-purple-400">{ip}</span>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="hover:bg-red-500/10 hover:text-red-400"
                      onClick={async () => {
                        await fetch(`${API_BASE_URL}/api/security/whitelist/${encodeURIComponent(ip)}`, {
                          method: 'DELETE'
                        })
                        const updatedSettings = {
                          ...settings,
                          ipWhitelist: {
                            ...settings.ipWhitelist,
                            ips: settings.ipWhitelist.ips.filter((i: string) => i !== ip)
                          }
                        }
                        setSettings(updatedSettings)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 访问令牌 */}
      <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-4 w-4 text-purple-400" />
            访问令牌
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              placeholder="令牌名称" 
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              className="border-purple-500/20 bg-purple-500/5 placeholder:text-muted-foreground/50"
            />
            <Button 
              onClick={generateToken}
              className="bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400"
            >
              <Plus className="h-4 w-4 mr-2" />
              生成令牌
            </Button>
          </div>
          
          {tokens.length > 0 ? (
            <div className="space-y-2">
              {tokens.map((token: any) => (
                <div key={token.id} className="flex items-center justify-between p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                  <div className="text-sm">
                    <p className="font-medium text-purple-400">{token.name}</p>
                    <p className="text-xs text-muted-foreground">
                      创建于 {new Date(token.createdAt).toLocaleString()}
                      {token.lastUsed && ` · 最后使用 ${new Date(token.lastUsed).toLocaleString()}`}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="hover:bg-red-500/10 hover:text-red-400"
                    onClick={async () => {
                      await fetch(`${API_BASE_URL}/api/security/tokens/${token.id}`, {
                        method: 'DELETE'
                      })
                      fetchTokens()
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              暂无访问令牌
            </div>
          )}
        </CardContent>
      </Card>

      {/* 安全日志 */}
      <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-purple-400" />
            安全日志
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.map((log: any) => (
                <div key={log.id} className="text-sm p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                  <div className="flex items-center justify-between">
                    <Badge 
                      variant={
                        log.severity === 'critical' || log.severity === 'high' ? 'destructive' :
                        log.severity === 'medium' ? 'secondary' :
                        'outline'
                      }
                      className={
                        log.severity === 'critical' || log.severity === 'high' 
                          ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        log.severity === 'medium' 
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                          'bg-green-500/10 text-green-400 border-green-500/20'
                      }
                    >
                      {log.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-foreground">{log.message}</p>
                  {log.ip && <p className="text-xs text-muted-foreground mt-1">IP: {log.ip}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              暂无安全日志
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Claude 配置面板
function ClaudeConfigPanel() {
  const [config, setConfig] = useState({
    baseUrl: '',
    authToken: '',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4000,
    temperature: 0.7,
    timeout: 30000
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error'>('unknown')

  useEffect(() => {
    fetchClaudeConfig()
  }, [])

  const fetchClaudeConfig = async () => {
    try {
      setError(null)
      // 获取当前token
      const authStorage = localStorage.getItem('auth-storage')
      const authState = authStorage ? JSON.parse(authStorage) : null
      const token = authState?.state?.accessToken

      let response = await fetch(`${API_BASE_URL}/api/claude/config`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      // 如果401错误，尝试刷新token
      if (response.status === 401) {
        try {
          console.log('Token过期，尝试刷新...')
          // 手动调用refresh API
          const refreshToken = authState?.state?.refreshToken
          
          if (refreshToken) {
            const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            })
            
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              // 更新localStorage
              const updatedState = {...authState}
              updatedState.state.accessToken = refreshData.accessToken
              if (refreshData.refreshToken) {
                updatedState.state.refreshToken = refreshData.refreshToken
              }
              localStorage.setItem('auth-storage', JSON.stringify(updatedState))
              
              // 使用新token重试
              response = await fetch(`${API_BASE_URL}/api/claude/config`, {
                headers: {
                  'Authorization': `Bearer ${refreshData.accessToken}`
                }
              })
            }
          }
        } catch (refreshError) {
          console.error('Token刷新失败:', refreshError)
          setError('认证失败，请重新登录')
          return
        }
      }

      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        // 检查是否有完整配置
        if (data.baseUrl && data.authToken) {
          setConnectionStatus('unknown')
        }
      } else {
        setError(`获取配置失败: HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to fetch Claude config:', error)
      setError(error instanceof Error ? error.message : '获取配置失败')
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    // 验证配置
    if (!config.baseUrl.trim()) {
      setError('请填写 Base URL')
      setSaving(false)
      return
    }
    
    if (!config.authToken.trim()) {
      setError('请填写 Auth Token')
      setSaving(false)
      return
    }
    
    // 验证URL格式
    try {
      new URL(config.baseUrl)
    } catch {
      setError('Base URL 格式不正确，请输入有效的URL')
      setSaving(false)
      return
    }
    
    try {
      // 获取当前token
      const authStorage = localStorage.getItem('auth-storage')
      const authState = authStorage ? JSON.parse(authStorage) : null
      const token = authState?.state?.accessToken

      let response = await fetch(`${API_BASE_URL}/api/claude/config`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          authToken: config.authToken,
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          timeout: config.timeout
        })
      })

      // 如果401错误，尝试刷新token
      if (response.status === 401) {
        try {
          console.log('Token过期，尝试刷新...')
          const refreshToken = authState?.state?.refreshToken
          
          if (refreshToken) {
            const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            })
            
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              // 更新localStorage
              const updatedState = {...authState}
              updatedState.state.accessToken = refreshData.accessToken
              if (refreshData.refreshToken) {
                updatedState.state.refreshToken = refreshData.refreshToken
              }
              localStorage.setItem('auth-storage', JSON.stringify(updatedState))
              
              // 使用新token重试
              response = await fetch(`${API_BASE_URL}/api/claude/config`, {
                method: 'PUT',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${refreshData.accessToken}`
                },
                body: JSON.stringify({
                  baseUrl: config.baseUrl,
                  authToken: config.authToken,
                  model: config.model,
                  maxTokens: config.maxTokens,
                  temperature: config.temperature,
                  timeout: config.timeout
                })
              })
            }
          }
        } catch (refreshError) {
          console.error('Token刷新失败:', refreshError)
          setError('认证失败，请重新登录')
          return
        }
      }
      
      if (response.ok) {
        setSuccess('配置保存成功')
        setConnectionStatus('unknown') // 重置连接状态，需要重新测试
        // 3秒后清除成功消息
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const errorData = await response.json().catch(() => null)
        setError(errorData?.message || `保存失败: HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to save Claude config:', error)
      setError(error instanceof Error ? error.message : '保存失败，请检查网络连接')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setError(null)
    setSuccess(null)
    setConnectionStatus('unknown')
    
    // 验证配置
    if (!config.baseUrl.trim() || !config.authToken.trim()) {
      setError('请先填写完整的配置信息')
      setTesting(false)
      return
    }
    
    try {
      // 获取当前token
      const authStorage = localStorage.getItem('auth-storage')
      const authState = authStorage ? JSON.parse(authStorage) : null
      const token = authState?.state?.accessToken

      let response = await fetch(`${API_BASE_URL}/api/claude/test`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          baseUrl: config.baseUrl, 
          authToken: config.authToken,
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature
        })
      })

      // 如果401错误，尝试刷新token
      if (response.status === 401) {
        try {
          console.log('Token过期，尝试刷新...')
          const refreshToken = authState?.state?.refreshToken
          
          if (refreshToken) {
            const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            })
            
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              // 更新localStorage
              const updatedState = {...authState}
              updatedState.state.accessToken = refreshData.accessToken
              if (refreshData.refreshToken) {
                updatedState.state.refreshToken = refreshData.refreshToken
              }
              localStorage.setItem('auth-storage', JSON.stringify(updatedState))
              
              // 使用新token重试
              response = await fetch(`${API_BASE_URL}/api/claude/test`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${refreshData.accessToken}`
                },
                body: JSON.stringify({ 
          baseUrl: config.baseUrl, 
          authToken: config.authToken,
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature
        })
              })
            }
          }
        } catch (refreshError) {
          console.error('Token刷新失败:', refreshError)
          setError('认证失败，请重新登录')
          setConnectionStatus('error')
          return
        }
      }
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        setError(`测试请求失败: HTTP ${response.status} ${errorText}`)
        setConnectionStatus('error')
        return
      }
      
      const result = await response.json()
      if (result.success) {
        setSuccess('✅ Claude API 连接测试成功！')
        setConnectionStatus('success')
        // 5秒后清除成功消息
        setTimeout(() => setSuccess(null), 5000)
      } else {
        setError(`❌ 连接测试失败: ${result.error || '未知错误'}`)
        setConnectionStatus('error')
      }
    } catch (error) {
      console.error('Failed to test connection:', error)
      setError(error instanceof Error ? error.message : '连接测试失败，请检查网络连接')
      setConnectionStatus('error')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
        Claude 配置
      </h2>
      
      {/* 错误和成功消息 */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span className="text-sm text-red-400 font-medium">错误</span>
          </div>
          <p className="text-sm text-red-300 mt-1">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <span className="text-sm text-green-400 font-medium">成功</span>
          </div>
          <p className="text-sm text-green-300 mt-1">{success}</p>
        </div>
      )}
      
      {/* API配置 */}
      <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-400" />
            API 配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-purple-400">Base URL</Label>
            <Input 
              placeholder="https://api.anthropic.com" 
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              className="border-purple-500/20 bg-purple-500/5 placeholder:text-muted-foreground/50"
            />
            <p className="text-xs text-muted-foreground">
              Claude API 的基础地址，默认为官方地址 (https://api.anthropic.com)
            </p>
          </div>
          
          <div className="space-y-2">
            <Label className="text-purple-400">Auth Token</Label>
            <div className="relative">
              <Input 
                type={showToken ? 'text' : 'password'}
                placeholder="sk-ant-api03-..." 
                value={config.authToken}
                onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
                className="border-purple-500/20 bg-purple-500/5 placeholder:text-muted-foreground/50 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-purple-500/10"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4 text-purple-400" />
                ) : (
                  <Eye className="h-4 w-4 text-purple-400" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              您的 Claude API 密钥，格式为 sk-ant-api03-... 请妥善保管
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* 高级配置 */}
      <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-purple-400" />
            高级配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-purple-400">模型</Label>
              <Select 
                value={config.model}
                onValueChange={(value) => setConfig({ ...config, model: value })}
              >
                <SelectTrigger className="border-purple-500/20 bg-purple-500/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (最新)</SelectItem>
                  <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet</SelectItem>
                  <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                  <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                选择要使用的 Claude 模型
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-purple-400">最大 Token 数</Label>
              <Input 
                type="number"
                min="1"
                max="200000"
                placeholder="4000" 
                value={config.maxTokens}
                onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) || 4000 })}
                className="border-purple-500/20 bg-purple-500/5 placeholder:text-muted-foreground/50"
              />
              <p className="text-xs text-muted-foreground">
                单次对话的最大 token 数量 (1-200000)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-purple-400">温度 (Temperature)</Label>
              <div className="flex items-center gap-3">
                <Input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm text-purple-400 font-mono w-12">{config.temperature}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                控制回复的随机性，0 表示最确定，1 表示最随机
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-purple-400">请求超时 (秒)</Label>
              <Input 
                type="number"
                min="1"
                max="300"
                placeholder="30" 
                value={config.timeout / 1000}
                onChange={(e) => setConfig({ ...config, timeout: (parseInt(e.target.value) || 30) * 1000 })}
                className="border-purple-500/20 bg-purple-500/5 placeholder:text-muted-foreground/50"
              />
              <p className="text-xs text-muted-foreground">
                API 请求超时时间 (1-300 秒)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* 连接状态指示器 */}
            {connectionStatus !== 'unknown' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'success' ? 'bg-green-500' : 'bg-red-500'
                } animate-pulse`} />
                <span className="text-sm text-muted-foreground">
                  连接状态: {
                    connectionStatus === 'success' ? '✅ 连接正常' : '❌ 连接失败'
                  }
                </span>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button 
                onClick={saveConfig}
                disabled={saving || loading}
                className="bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  '保存配置'
                )}
              </Button>
              
              <Button 
                onClick={testConnection}
                variant="outline"
                className="border-purple-500/20 hover:bg-purple-500/10 text-purple-400 disabled:border-gray-500/20 disabled:text-gray-400"
                disabled={testing || !config.baseUrl.trim() || !config.authToken.trim()}
              >
                {testing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    测试中...
                  </>
                ) : (
                  '测试连接'
                )}
              </Button>
              
              <Button 
                onClick={() => {
                  setError(null)
                  setSuccess(null)
                  fetchClaudeConfig()
                }}
                variant="outline"
                className="border-purple-500/20 hover:bg-purple-500/10 text-purple-400 disabled:border-gray-500/20 disabled:text-gray-400"
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                重新加载
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-purple-400" />
            使用说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>• Base URL：Claude API 的访问地址，可以使用官方地址或代理地址</p>
          <p>• Auth Token：您的 API 密钥，可以从 Anthropic Console 获取</p>
          <p>• 此配置将用于 Claude Code 工具连接 Claude API</p>
          <p>• 配置将被加密存储，仅管理员可以查看和修改</p>
        </CardContent>
      </Card>
    </div>
  )
}