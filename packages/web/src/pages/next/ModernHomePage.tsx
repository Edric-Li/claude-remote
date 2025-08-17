import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  MessageSquare,
  Bot,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Trash2,
  Edit3,
  Wifi,
  WifiOff,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useWebSocketCommunicationStore } from '../../store/websocket-communication.store'
import { useAssistants, useCurrentAssistant } from '../../store/assistant.store'
import { CreateAssistantDialog } from '../../components/assistant/CreateAssistantDialog'
import { AssistantCard } from '../../components/assistant/AssistantCard'
import ChatInterface from '../../components/conversation/ChatInterface'
import type { Assistant } from '../../types/session.types'

interface Conversation {
  id: string
  title: string
  lastMessage: string
  timestamp: Date
}

export function ModernHomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const {
    agents,
    connect,
    connected,
    connecting,
    error,
    isOnline,
    lastSyncTime,
    refreshAgentList,
    clearError
  } = useWebSocketCommunicationStore()
  
  // 助手相关状态
  const { assistants, isLoading: isLoadingAssistants, loadAssistants, deleteAssistant } = useAssistants()
  const { currentAssistant, selectAssistant, clearCurrentAssistant } = useCurrentAssistant()

  const [activeTab, setActiveTab] = useState<'conversations' | 'assistants'>('conversations')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [showCreateAssistant, setShowCreateAssistant] = useState(false)
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null)
  const [chatAssistant, setChatAssistant] = useState<Assistant | null>(null)

  // 模拟对话数据 - 这些将来会从API获取
  const [conversations] = useState<Conversation[]>([
    {
      id: '1',
      title: 'React性能优化',
      lastMessage: '如何优化React应用的渲染性能？',
      timestamp: new Date(Date.now() - 1000 * 60 * 30)
    },
    {
      id: '2',
      title: '系统架构设计',
      lastMessage: '微服务架构的最佳实践讨论',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2)
    },
    {
      id: '3',
      title: 'AI模型对比',
      lastMessage: '不同AI模型在代码生成方面的对比',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24)
    }
  ])

  // 已移除这个转换，现在使用真实的Assistant数据

  useEffect(() => {
    // 初始化WebSocket通信
    if (!connected && !connecting) {
      connect()
    }
  }, [connected, connecting]) // 移除函数依赖，避免无限重渲染

  useEffect(() => {
    // 加载助手列表
    loadAssistants()
  }, []) // 只在组件挂载时加载一次

  const handleLogout = async () => {
    await logout()
    navigate('/next/login')
  }

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

  const handleNewConversation = () => {
    navigate('/next/chat/new')
  }

  const handleConversationClick = (id: string) => {
    setSelectedConversation(id)
    navigate(`/next/chat/${id}`)
  }

  const handleRetryConnection = () => {
    clearError()
    connect()
  }

  // 助手相关处理函数
  const handleCreateAssistant = () => {
    setShowCreateAssistant(true)
  }

  const handleAssistantCreated = (assistant: Assistant) => {
    setShowCreateAssistant(false)
    // 自动选择新创建的助手
    handleAssistantSelect(assistant)
  }

  const handleAssistantSelect = (assistant: Assistant) => {
    setSelectedAssistant(assistant)
    selectAssistant(assistant)
  }

  const handleAssistantChat = (assistant: Assistant) => {
    handleAssistantSelect(assistant)
    setChatAssistant(assistant)
  }

  const handleCloseChatInterface = () => {
    setChatAssistant(null)
  }

  const handleAssistantEdit = (assistant: Assistant) => {
    // TODO: 实现编辑助手功能
    console.log('Edit assistant:', assistant)
  }

  const handleAssistantDelete = async (assistant: Assistant) => {
    try {
      await deleteAssistant(assistant.id)
      // 如果删除的是当前选中的助手，清除选择
      if (selectedAssistant?.id === assistant.id) {
        setSelectedAssistant(null)
        clearCurrentAssistant()
      }
    } catch (error) {
      console.error('Failed to delete assistant:', error)
    }
  }

  const renderConnectionStatus = () => {
    if (connecting) {
      return (
        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
          <RefreshCw className="w-3 h-3 animate-spin" />
          连接中...
        </div>
      )
    }

    if (!connected) {
      return (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
          <WifiOff className="w-3 h-3" />
          未连接
        </div>
      )
    }

    if (!isOnline) {
      return (
        <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
          <WifiOff className="w-3 h-3" />
          离线
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
        <Wifi className="w-3 h-3" />
        已连接
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-white">
      {/* 左侧边栏 */}
      <div
        className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-200 border-r border-gray-200 flex flex-col overflow-hidden`}
      >
        {/* 侧边栏头部 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-900">AI Orchestra</h1>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 连接状态 */}
          <div className="flex items-center justify-between mb-4">
            {renderConnectionStatus()}
            {connected && agents.length > 0 && (
              <span className="text-xs text-gray-500">
                {agents.filter(a => a.status === 'online').length} 个Agent在线
              </span>
            )}
          </div>

          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            disabled={!connected || agents.length === 0}
          >
            <Plus className="w-4 h-4" />
            新建对话
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={handleRetryConnection}
                  className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                >
                  重试连接
                </button>
              </div>
              <button onClick={clearError} className="text-red-400 hover:text-red-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* 标签切换 */}
        <div className="flex p-2 bg-gray-50">
          <button
            onClick={() => setActiveTab('conversations')}
            className={`flex-1 py-2 px-3 text-sm rounded transition-colors ${
              activeTab === 'conversations'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            对话
          </button>
          <button
            onClick={() => setActiveTab('assistants')}
            className={`flex-1 py-2 px-3 text-sm rounded transition-colors ${
              activeTab === 'assistants'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            助手 {assistants.length > 0 && `(${assistants.length})`}
          </button>
        </div>

        {/* 列表内容 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'conversations' ? (
            <div className="p-2">
              {conversations.map(conversation => (
                <div
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation.id)}
                  className={`group p-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                    selectedConversation === conversation.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-gray-900 text-sm truncate flex-1">
                      {conversation.title}
                    </h3>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                      <button className="p-1 hover:bg-gray-200 rounded">
                        <Edit3 className="w-3 h-3 text-gray-500" />
                      </button>
                      <button className="p-1 hover:bg-gray-200 rounded">
                        <Trash2 className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 truncate mb-2">{conversation.lastMessage}</p>
                  <span className="text-xs text-gray-400">
                    {formatTime(conversation.timestamp)}
                  </span>
                </div>
              ))}

              {conversations.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">还没有对话</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2">
              {/* 新建助手按钮 */}
              <div className="mb-3">
                <button
                  onClick={handleCreateAssistant}
                  className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-2 text-gray-600 group-hover:text-blue-600">
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">新建助手</span>
                  </div>
                </button>
              </div>
              
              {/* 助手列表 */}
              {isLoadingAssistants ? (
                <div className="p-8 text-center text-gray-500">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-500" />
                  <p className="text-sm">加载助手中...</p>
                </div>
              ) : assistants.length > 0 ? (
                <div className="space-y-2">
                  {assistants.map(assistant => (
                    <AssistantCard
                      key={assistant.id}
                      assistant={assistant}
                      selected={selectedAssistant?.id === assistant.id}
                      onSelect={handleAssistantSelect}
                      onChat={handleAssistantChat}
                      onEdit={handleAssistantEdit}
                      onDelete={handleAssistantDelete}
                      className="cursor-pointer"
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Bot className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm mb-2">还没有助手</p>
                  <p className="text-xs text-gray-400 mb-3">创建你的第一个AI助手开始对话</p>
                  <button
                    onClick={handleCreateAssistant}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    立即创建
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部用户区域 */}
        <div className="p-3 border-t border-gray-200">
          {/* 同步状态 */}
          {lastSyncTime && (
            <div className="text-xs text-gray-400 mb-2 flex items-center justify-between">
              <span>最后同步: {formatTime(lastSyncTime)}</span>
              <button
                onClick={refreshAgentList}
                className="p-1 hover:bg-gray-100 rounded"
                disabled={connecting}
              >
                <RefreshCw className={`w-3 h-3 ${connecting ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center text-white text-xs font-medium">
                {user?.nickname?.[0] || user?.username?.[0] || 'U'}
              </div>
              <span className="text-sm text-gray-700 truncate">
                {user?.nickname || user?.username}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate('/settings')}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部工具栏 */}
        <div className="h-12 border-b border-gray-200 flex items-center px-4">
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1 hover:bg-gray-100 rounded mr-3"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索对话..."
                className="w-full pl-10 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>

          {/* 网络状态指示器 */}
          <div className="ml-4">{renderConnectionStatus()}</div>
        </div>

        {/* 主要内容 */}
        <div className="flex-1 flex overflow-hidden">
          {chatAssistant ? (
            // 聊天界面
            <ChatInterface
              conversationId={chatAssistant.id}
              agentId={chatAssistant.session?.agentId || ''}
              repositoryId={chatAssistant.session?.repositoryId || ''}
              onClose={handleCloseChatInterface}
              className="w-full h-full"
            />
          ) : (
            // 默认欢迎界面
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-medium text-gray-900 mb-2">AI Orchestra</h2>
                <p className="text-gray-600 mb-6 max-w-md">
                  基于现代HTTP协议的AI助手平台，使用Server-Sent Events实现实时通信
                </p>
                <div className="space-y-2">
                  <button
                    onClick={handleNewConversation}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    disabled={!connected || agents.length === 0}
                  >
                    <Plus className="w-4 h-4" />
                    开始新对话
                  </button>
                  {(!connected || agents.length === 0) && (
                    <div className="text-sm text-gray-500">
                      {!connected ? '等待连接到服务器...' : '没有可用的AI助手'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 创建助手对话框 */}
      <CreateAssistantDialog
        open={showCreateAssistant}
        onOpenChange={setShowCreateAssistant}
        onSuccess={handleAssistantCreated}
      />
    </div>
  )
}
