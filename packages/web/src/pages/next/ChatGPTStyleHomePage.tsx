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
  Edit3
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import {
  useHttpCommunicationStore,
  initializeHttpCommunication
} from '../../store/http-communication.store'

interface Conversation {
  id: string
  title: string
  lastMessage: string
  timestamp: Date
}

interface Assistant {
  id: string
  name: string
  description: string
  avatar: string
}

export function ChatGPTStyleHomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { agents, connect, connected } = useHttpCommunicationStore()

  const [activeTab, setActiveTab] = useState<'conversations' | 'assistants'>('conversations')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)

  // 模拟对话数据
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

  // 模拟助手数据
  const [assistants] = useState<Assistant[]>([
    {
      id: '1',
      name: 'Claude代码助手',
      description: '专业的编程和代码分析助手',
      avatar: '🤖'
    },
    {
      id: '2',
      name: 'GPT-4',
      description: '通用人工智能助手',
      avatar: '🧠'
    },
    {
      id: '3',
      name: '文档助手',
      description: '专门用于文档编写和整理',
      avatar: '📝'
    }
  ])

  useEffect(() => {
    // 初始化HTTP通信
    initializeHttpCommunication()

    if (!connected) {
      connect()
    }
  }, [connected, connect])

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

          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建对话
          </button>
        </div>

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
            助手
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
              {assistants.map(assistant => (
                <div
                  key={assistant.id}
                  className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors mb-1"
                  onClick={() => navigate(`/next/chat/new?assistant=${assistant.id}`)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg">{assistant.avatar}</span>
                    <h3 className="font-medium text-gray-900 text-sm">{assistant.name}</h3>
                  </div>
                  <p className="text-xs text-gray-600">{assistant.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部用户区域 */}
        <div className="p-3 border-t border-gray-200">
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
                onClick={() => navigate('/next/settings')}
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
        </div>

        {/* 主要内容 */}
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-medium text-gray-900 mb-2">AI Orchestra</h2>
            <p className="text-gray-600 mb-6 max-w-md">
              选择一个对话开始聊天，或创建新的对话与AI助手交流
            </p>
            <button
              onClick={handleNewConversation}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              开始新对话
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
