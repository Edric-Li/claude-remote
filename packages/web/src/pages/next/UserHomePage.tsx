import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Sparkles, Plus, Bot, BarChart3, Settings, 
  MessageSquare, Activity, Users, Zap,
  ChevronRight, Clock, TrendingUp, Shield,
  Command, Search, Bell, User, LogOut
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useStore } from '../../store'
import './design-system.css'

interface QuickActionCardProps {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
  variant: 'primary' | 'secondary' | 'accent'
  badge?: string
}

function QuickActionCard({ icon, title, description, onClick, variant, badge }: QuickActionCardProps) {
  const variantStyles = {
    primary: 'border-primary-200 bg-gradient-to-br from-primary-50 to-primary-100 hover:from-primary-100 hover:to-primary-200',
    secondary: 'border-secondary-200 bg-gradient-to-br from-secondary-50 to-secondary-100 hover:from-secondary-100 hover:to-secondary-200',
    accent: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200'
  }
  
  return (
    <div
      className={`group cursor-pointer rounded-2xl border-2 p-6 transition-all duration-300 hover:shadow-lg hover:shadow-current/10 hover:scale-[1.02] ${variantStyles[variant]} animate-fade-in`}
      onClick={onClick}
    >
      <div className="flex flex-col items-center text-center space-y-4 relative">
        {badge && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            {badge}
          </div>
        )}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
          variant === 'primary' ? 'bg-primary-500 text-white' :
          variant === 'secondary' ? 'bg-secondary-500 text-white' :
          'bg-emerald-500 text-white'
        }`}>
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </div>
  )
}

interface SessionCardProps {
  id: string
  title: string
  lastMessage: string
  timestamp: Date
  agentCount: number
  messageCount: number
  onClick: () => void
}

function SessionCard({ title, lastMessage, timestamp, agentCount, messageCount, onClick }: SessionCardProps) {
  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    return `${days}天前`
  }

  return (
    <div 
      className="modern-card p-6 cursor-pointer hover:scale-[1.01] transition-all duration-200 animate-slide-in"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-gray-900 truncate flex-1 mr-4">{title}</h3>
        <span className="text-xs text-gray-500 whitespace-nowrap">{formatTime(timestamp)}</span>
      </div>
      
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{lastMessage}</p>
      
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4 text-xs text-gray-500">
          <div className="flex items-center">
            <Bot className="w-3 h-3 mr-1" />
            {agentCount} Agents
          </div>
          <div className="flex items-center">
            <MessageSquare className="w-3 h-3 mr-1" />
            {messageCount} 消息
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  )
}

interface SystemStatusCardProps {
  agents: Array<{ id: string; name: string; status: string }>
}

function SystemStatusCard({ agents }: SystemStatusCardProps) {
  const onlineAgents = agents.filter(a => a.status === 'online').length
  const totalAgents = agents.length
  
  return (
    <div className="modern-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">系统状态</h3>
        <Activity className="w-5 h-5 text-green-500" />
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Agent 状态</span>
            <span className="text-sm font-medium text-gray-900">{onlineAgents}/{totalAgents}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${totalAgents > 0 ? (onlineAgents / totalAgents) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-700">{onlineAgents}</div>
            <div className="text-xs text-green-600">在线</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-700">{totalAgents - onlineAgents}</div>
            <div className="text-xs text-gray-600">离线</div>
          </div>
        </div>
        
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">系统负载</span>
            <span className="text-green-600 font-medium">正常</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function UsageStatsCard() {
  const stats = {
    todayMessages: 127,
    monthlyUsage: 2840,
    growthRate: 23.5
  }
  
  return (
    <div className="modern-card p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">使用统计</h3>
        <BarChart3 className="w-5 h-5 text-primary-500" />
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-primary-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-primary-700">{stats.todayMessages}</div>
                <div className="text-sm text-primary-600">今日对话</div>
              </div>
              <TrendingUp className="w-8 h-8 text-primary-500" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-gray-700">{stats.monthlyUsage}</div>
              <div className="text-xs text-gray-600">月使用量</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-700">+{stats.growthRate}%</div>
              <div className="text-xs text-green-600">增长率</div>
            </div>
          </div>
        </div>
        
        <button className="w-full text-sm text-primary-600 hover:text-primary-700 font-medium">
          查看详细报告 →
        </button>
      </div>
    </div>
  )
}

function UserProfileDropdown({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-semibold">
          {user?.nickname?.[0] || user?.username?.[0] || 'U'}
        </div>
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-gray-900">{user?.nickname || user?.username}</div>
          <div className="text-xs text-gray-500">{user?.email}</div>
        </div>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 modern-card p-2 z-50">
          <button className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
            <User className="w-4 h-4 mr-3" />
            个人资料
          </button>
          <button className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
            <Settings className="w-4 h-4 mr-3" />
            设置
          </button>
          <hr className="my-2" />
          <button 
            onClick={onLogout}
            className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
          >
            <LogOut className="w-4 h-4 mr-3" />
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}

export function UserHomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { agents, connect, connected } = useStore()
  
  // 模拟会话数据
  const [sessions] = useState([
    {
      id: '1',
      title: 'Claude代码助手会话',
      lastMessage: '帮我分析这段React代码的性能优化方案...',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      agentCount: 1,
      messageCount: 15
    },
    {
      id: '2', 
      title: '系统架构讨论',
      lastMessage: '关于微服务架构的最佳实践讨论...',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      agentCount: 2,
      messageCount: 28
    },
    {
      id: '3',
      title: 'AI模型对比分析',
      lastMessage: '比较不同AI模型在代码生成方面的表现...',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      agentCount: 1,
      messageCount: 42
    }
  ])
  
  useEffect(() => {
    if (!connected) {
      connect()
    }
  }, [connected, connect])

  const handleCreateSession = () => {
    navigate('/next/chat/new')
  }

  const handleLogout = async () => {
    await logout()
    navigate('/next/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* 现代化头部 */}
      <header className="backdrop-blur-xl bg-white/80 border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-xl font-bold modern-text-gradient">
                  AI Orchestra
                </h1>
              </div>
              
              {/* 搜索栏 */}
              <div className="hidden md:block relative ml-8">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索会话、Agent..."
                  className="pl-10 pr-4 py-2 w-64 bg-gray-100 border-0 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 transition-all"
                />
                <kbd className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 bg-gray-200 px-2 py-1 rounded">
                  ⌘K
                </kbd>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              
              <button 
                onClick={() => navigate('/next/settings')}
                className="modern-btn modern-btn-ghost flex items-center"
              >
                <Settings className="w-4 h-4 mr-2" />
                设置
              </button>
              
              <UserProfileDropdown user={user} onLogout={handleLogout} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 欢迎区域 */}
        <div className="mb-8 animate-fade-in">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            欢迎回来，{user?.nickname || user?.username} 👋
          </h2>
          <p className="text-gray-600">
            开始新的AI对话，或继续之前的会话
          </p>
        </div>

        {/* 快速操作 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <QuickActionCard
            icon={<Plus className="w-6 h-6" />}
            title="新建会话"
            description="开始与AI的新对话"
            onClick={handleCreateSession}
            variant="primary"
          />
          
          <QuickActionCard
            icon={<Bot className="w-6 h-6" />}
            title="Agent管理"
            description="配置和管理AI Agent"
            onClick={() => navigate('/next/agents')}
            variant="secondary"
          />
          
          <QuickActionCard
            icon={<BarChart3 className="w-6 h-6" />}
            title="使用分析"
            description="查看对话和使用情况"
            onClick={() => navigate('/next/analytics')}
            variant="accent"
            badge="New"
          />
        </div>

        {/* 主要内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 最近会话 */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">最近会话</h3>
              <button className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center">
                查看全部
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
            
            <div className="space-y-4">
              {sessions.map((session, index) => (
                <div key={session.id} style={{ animationDelay: `${index * 0.1}s` }}>
                  <SessionCard
                    {...session}
                    onClick={() => navigate(`/next/chat/${session.id}`)}
                  />
                </div>
              ))}
            </div>
            
            {sessions.length === 0 && (
              <div className="modern-card p-12 text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">还没有会话</h3>
                <p className="text-gray-600 mb-6">创建您的第一个AI对话会话</p>
                <button 
                  onClick={handleCreateSession}
                  className="modern-btn modern-btn-primary"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新建会话
                </button>
              </div>
            )}
          </div>

          {/* 系统状态侧边栏 */}
          <div className="space-y-6">
            <SystemStatusCard agents={agents} />
            <UsageStatsCard />
            
            {/* 快捷操作 */}
            <div className="modern-card p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <h3 className="font-semibold text-gray-900 mb-4">快捷操作</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="flex items-center">
                    <Command className="w-4 h-4 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-700">命令面板</span>
                  </div>
                  <kbd className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">⌘K</kbd>
                </button>
                
                <button 
                  onClick={() => navigate('/next/settings')}
                  className="w-full flex items-center p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-400 mr-3" />
                  <span className="text-sm text-gray-700">系统设置</span>
                </button>
                
                <button className="w-full flex items-center p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                  <Shield className="w-4 h-4 text-gray-400 mr-3" />
                  <span className="text-sm text-gray-700">安全中心</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 底部状态栏 */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>AI Orchestra v2.0 - 已连接到 {agents.length} 个Agent</p>
        </div>
      </main>
    </div>
  )
}