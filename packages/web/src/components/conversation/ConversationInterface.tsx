/**
 * ConversationInterface.tsx - 对话界面主组件
 * 
 * 这是完整对话功能的入口组件，管理整个对话生命周期：
 * 1. 对话创建阶段：使用ConversationCreate组件配置和创建新对话
 * 2. 聊天阶段：使用ChatInterface组件进行实际对话
 * 3. 状态管理：处理对话状态转换和生命周期管理
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  ArrowLeft, 
  MessageCircle, 
  RotateCcw, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  Users,
  GitBranch
} from 'lucide-react'

import { ConversationCreate } from './ConversationCreate'
import ChatInterface from './ChatInterface'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

import { useWebSocketCommunicationStore } from '../../store/websocket-communication.store'
import type { ConversationConfig } from '../../types/conversation.types'

// ================================
// 类型定义
// ================================

interface ConversationInterfaceProps {
  className?: string
  onConversationClose?: (conversationId: string) => void
}

// Agent和Repository类型由store提供，这里只定义组件特有的类型

// 对话阶段枚举
type ConversationPhase = 'creating' | 'chatting' | 'paused' | 'completed' | 'error'

// 对话实例状态
interface ConversationInstance {
  id: string
  agentId: string
  repositoryId: string
  config: ConversationConfig
  phase: ConversationPhase
  createdAt: Date
  lastActivity: Date
  messageCount: number
  error?: string
}

// ================================
// 主组件
// ================================

export function ConversationInterface({
  className,
  onConversationClose
}: ConversationInterfaceProps) {
  // WebSocket store状态
  const {
    connected,
    connecting,
    error: wsError,
    agents,
    createConversation,
    setActiveConversation,
    removeConversation,
    connect,
    refreshAgentList
  } = useWebSocketCommunicationStore()

  // 本地状态
  const [currentConversation, setCurrentConversation] = useState<ConversationInstance | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // 获取当前对话阶段
  const conversationPhase = useMemo(() => {
    if (!currentConversation) return 'creating'
    return currentConversation.phase
  }, [currentConversation])

  // 检查是否可以开始聊天
  const canStartChat = useMemo(() => {
    return currentConversation && 
           conversationPhase === 'chatting' && 
           connected && 
           !wsError
  }, [currentConversation, conversationPhase, connected, wsError])

  // 初始化WebSocket连接
  useEffect(() => {
    if (!connected && !connecting) {
      connect()
    }
  }, [connected, connecting, connect])

  // 处理对话创建
  const handleCreateConversation = useCallback(async (config: ConversationConfig) => {
    setIsCreating(true)
    setCreateError(null)

    try {
      // 验证配置
      if (!config.agentId || !config.repositoryId) {
        throw new Error('Agent和仓库信息不能为空')
      }

      // 检查Agent是否在线 (临时修改：允许离线Agent进行测试)
      const selectedAgent = agents.find(agent => agent.id === config.agentId)
      if (!selectedAgent) {
        throw new Error('找不到指定的Agent')
      }
      
      // 临时注释：允许测试离线Agent
      // if (selectedAgent.status !== 'online') {
      //   throw new Error('选择的Agent不在线，请选择其他Agent或等待Agent上线')
      // }

      // 生成对话ID
      const conversationId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // 创建对话实例
      const newConversation: ConversationInstance = {
        id: conversationId,
        agentId: config.agentId,
        repositoryId: config.repositoryId,
        config,
        phase: 'chatting',
        createdAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0
      }

      // 在WebSocket store中创建对话
      createConversation(config.agentId, config.repositoryId, config)
      setActiveConversation(conversationId)

      // 更新本地状态
      setCurrentConversation(newConversation)
      setRetryCount(0)

      console.log('✅ 对话创建成功:', conversationId)

    } catch (error: any) {
      console.error('❌ 对话创建失败:', error)
      setCreateError(error.message || '创建对话时发生未知错误')
      setCurrentConversation(prev => prev ? {
        ...prev,
        phase: 'error',
        error: error.message
      } : null)
    } finally {
      setIsCreating(false)
    }
  }, [agents, createConversation, setActiveConversation])

  // 处理对话关闭
  const handleCloseConversation = useCallback(() => {
    if (currentConversation) {
      // 清理WebSocket store中的对话
      removeConversation(currentConversation.id)
      setActiveConversation(null)
      
      // 回调通知父组件
      onConversationClose?.(currentConversation.id)
      
      // 重置本地状态
      setCurrentConversation(null)
      setCreateError(null)
      setRetryCount(0)
      
      console.log('🔄 对话已关闭:', currentConversation.id)
    }
  }, [currentConversation, removeConversation, setActiveConversation, onConversationClose])

  // 处理重新开始
  const handleRestart = useCallback(() => {
    setCurrentConversation(null)
    setCreateError(null)
    setRetryCount(0)
  }, [])

  // 处理重试
  const handleRetry = useCallback(() => {
    if (currentConversation?.config) {
      setRetryCount(prev => prev + 1)
      handleCreateConversation(currentConversation.config)
    }
  }, [currentConversation, handleCreateConversation])

  // 处理刷新Agent列表
  const handleRefreshAgents = useCallback(async () => {
    try {
      await refreshAgentList()
    } catch (error) {
      console.error('刷新Agent列表失败:', error)
    }
  }, [refreshAgentList])

  // 渲染连接状态
  const renderConnectionStatus = () => {
    if (connecting) {
      return (
        <Card className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">正在连接...</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">正在建立WebSocket连接</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (wsError) {
      return (
        <Card className="mb-4 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-900 dark:text-red-100">连接错误</p>
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">{wsError}</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => connect()}
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新连接
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (!connected) {
      return (
        <Card className="mb-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">连接断开</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">WebSocket连接未建立</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => connect()}
                  className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  连接
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    return null
  }

  // 渲染对话创建阶段
  const renderCreationPhase = () => (
    <div className="space-y-4">
      {renderConnectionStatus()}
      
      {createError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-900 dark:text-red-100">创建对话失败</p>
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">{createError}</p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleRetry}
                    disabled={isCreating}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    重试 {retryCount > 0 && `(${retryCount})`}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleRefreshAgents}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    刷新Agent
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ConversationCreate
        onCreateConversation={handleCreateConversation}
        loading={isCreating}
        disabled={!connected || !!wsError}
      />
    </div>
  )

  // 渲染聊天阶段
  const renderChatPhase = () => {
    if (!currentConversation) {
      return null
    }

    return (
      <div className="h-full flex flex-col">
        {/* 对话头部信息 */}
        <Card className="mb-4 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">对话已建立</p>
                  <div className="flex items-center gap-4 text-sm text-green-700 dark:text-green-300">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>Agent: {agents.find(a => a.id === currentConversation.agentId)?.name || currentConversation.agentId}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GitBranch className="w-4 h-4" />
                      <span>仓库: {currentConversation.config.repositoryId}</span>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      {currentConversation.config.aiTool}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRestart}
                  className="border-green-300 text-green-700 hover:bg-green-100"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  重新开始
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCloseConversation}
                  className="border-green-300 text-green-700 hover:bg-green-100"
                >
                  <X className="w-4 h-4 mr-2" />
                  关闭
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 聊天界面 */}
        <div className="flex-1 min-h-0">
          {canStartChat ? (
            <ChatInterface
              conversationId={currentConversation.id}
              agentId={currentConversation.agentId}
              repositoryId={currentConversation.repositoryId}
              onClose={handleCloseConversation}
              className="h-full"
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>正在准备聊天环境...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 渲染错误阶段
  const renderErrorPhase = () => {
    if (!currentConversation?.error) {
      return null
    }

    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md w-full border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
              <AlertCircle className="w-5 h-5" />
              对话出现错误
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-700 dark:text-red-300">
              {currentConversation.error}
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={handleRetry}
                disabled={isCreating}
                className="flex-1"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                重试
              </Button>
              <Button 
                variant="outline" 
                onClick={handleRestart}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                重新开始
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 渲染加载状态
  if (connecting && !connected) {
    return (
      <div className={cn("h-full flex items-center justify-center", className)}>
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <h3 className="text-lg font-medium mb-2">初始化对话系统</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              正在连接WebSocket服务器...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 主要渲染逻辑
  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* 头部标题栏 */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                AI 对话助手
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {conversationPhase === 'creating' ? '配置并创建新的对话' : 
                 conversationPhase === 'chatting' ? '与AI助手对话' :
                 conversationPhase === 'error' ? '对话遇到错误' : '对话已完成'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge 
              variant={connected ? 'default' : 'destructive'}
              className="text-xs"
            >
              {connected ? '已连接' : '未连接'}
            </Badge>
            {currentConversation && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCloseConversation}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 min-h-0 p-4">
        {conversationPhase === 'creating' && renderCreationPhase()}
        {conversationPhase === 'chatting' && renderChatPhase()}
        {conversationPhase === 'error' && renderErrorPhase()}
      </div>
    </div>
  )
}

export default ConversationInterface