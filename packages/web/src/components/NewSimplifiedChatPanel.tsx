import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Bot, User, Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react'
import { useStore } from '../store'
import { useSessionStore, useSessionStoreBase } from '../store/session.store'
import dayjs from 'dayjs'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { cn } from '@/lib/utils'
import { Badge } from './ui/badge'

export function NewSimplifiedChatPanel() {
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentProgress, setCurrentProgress] = useState<any[]>([])
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { socket, connected } = useStore()
  const { currentSession, addMessage, updateSession } = useSessionStore()
  
  // 当会话变化时，如果有 workerId 且消息为空，尝试加载历史
  useEffect(() => {
    if (currentSession?.workerId && currentSession.messages.length === 0) {
      // 使用 setTimeout 确保 WebSocket 已连接
      setTimeout(() => {
        useSessionStoreBase.getState().loadMessages(currentSession.id)
      }, 500)
    }
  }, [currentSession])
  
  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages])
  
  // Worker消息监听器
  const processedMessages = useRef(new Set<string>())
  
  useEffect(() => {
    if (!socket || !currentSession) return
    
    // 监听Worker消息
    const handleWorkerMessage = (data: any) => {
      
      if (data.agentId !== currentSession.agentId) return
      
      const { message } = data
      
      // 处理不同类型的消息
      if (message.type === 'assistant' && message.message?.content) {
        // 处理助手消息 - 合并所有文本内容为一条消息
        const textContents = []
        for (const contentItem of message.message.content) {
          if (contentItem.type === 'text' && contentItem.text?.trim()) {
            textContents.push(contentItem.text)
          }
        }
        
        if (textContents.length > 0) {
          const messageContent = textContents.join('')
          // 创建消息哈希用于去重
          const messageHash = btoa(encodeURIComponent(messageContent)).substring(0, 32)
          
          if (!processedMessages.current.has(messageHash)) {
            processedMessages.current.add(messageHash)
            
            addMessage(currentSession.id, {
              from: 'assistant',
              content: messageContent,
              metadata: {
                tool: currentSession.aiTool,
                workerId: currentSession.workerId,
                usage: message.message.usage
              }
            })
            setIsProcessing(false)
          } else {
          }
        }
      } else if (message.type === 'system') {
        // 处理系统消息
        if (message.subtype === 'init') {
          // 保存 Claude 的真实 sessionId 到元数据中
          if (message.sessionId && message.sessionId !== currentSession.id) {
            // 更新会话的 metadata，存储 Claude sessionId
            updateSession(currentSession.id, {
              metadata: {
                ...currentSession.metadata,
                claudeSessionId: message.sessionId
              }
            })
          }
          
          addMessage(currentSession.id, {
            from: 'system',
            content: `系统初始化完成 | 模型: ${message.model} | ${message.tools?.length || 0} 个工具可用`
          })
        }
      } else if (message.type === 'error') {
        // 处理错误消息
        addMessage(currentSession.id, {
          from: 'system',
          content: `❌ 错误: ${message.error || '未知错误'}`
        })
        setIsProcessing(false)
      }
    }
    
    // 监听Worker状态
    const handleWorkerStatus = (data: any) => {
      
      if (data.agentId !== currentSession.agentId) return
      
      if (data.status === 'started') {
        setIsProcessing(true)
        setCurrentProgress([])
        setCurrentTool(null)
      } else if (data.status === 'stopped' || data.status === 'completed' || data.status === 'error') {
        setIsProcessing(false)
        setCurrentProgress([])
        setCurrentTool(null)
        if (data.status === 'error') {
          addMessage(currentSession.id, {
            from: 'system',
            content: `❌ Worker错误: ${data.error || '未知错误'}`
          })
        }
      }
    }
    
    // 监听工具调用
    const handleToolUse = (data: any) => {
      
      if (data.agentId !== currentSession.agentId) return
      
      const { toolUse } = data
      setCurrentTool(toolUse.name)
      setCurrentProgress(prev => [...prev, {
        type: 'tool',
        tool: toolUse.name,
        input: toolUse.input,
        timestamp: new Date()
      }])
    }
    
    // 监听系统信息（token使用等）
    const handleSystemInfo = (data: any) => {
      
      if (data.agentId !== currentSession.agentId) return
      
      const { info } = data
      
      setCurrentProgress(prev => [...prev, {
        type: 'system',
        info,
        timestamp: new Date()
      }])
    }
    
    // 监听处理进度
    const handleProgress = (data: any) => {
      
      if (data.agentId !== currentSession.agentId) return
      
      const { progress } = data
      setCurrentProgress(prev => {
        // 限制进度项目数量，避免界面过于拥挤
        const newProgress = [...prev, progress].slice(-10)
        return newProgress
      })
      
      // 处理特定进度类型
      if (progress.type === 'tool_start') {
        setCurrentTool(progress.tool)
      } else if (progress.type === 'response_complete') {
        setCurrentTool(null)
      }
    }
    
    // 确保每次只绑定一次事件监听器
    socket.off('worker:message', handleWorkerMessage)
    socket.off('worker:status', handleWorkerStatus)
    socket.off('worker:tool-use', handleToolUse)
    socket.off('worker:system-info', handleSystemInfo)
    socket.off('worker:progress', handleProgress)
    
    socket.on('worker:message', handleWorkerMessage)
    socket.on('worker:status', handleWorkerStatus)
    socket.on('worker:tool-use', handleToolUse)
    socket.on('worker:system-info', handleSystemInfo)
    socket.on('worker:progress', handleProgress)
    
    return () => {
      socket.off('worker:message', handleWorkerMessage)
      socket.off('worker:status', handleWorkerStatus)
      socket.off('worker:tool-use', handleToolUse)
      socket.off('worker:system-info', handleSystemInfo)
      socket.off('worker:progress', handleProgress)
    }
  }, [socket, currentSession?.id, currentSession?.agentId, addMessage])
  
  // 当会话改变时，清空去重集合和状态
  useEffect(() => {
    processedMessages.current.clear()
    setCurrentProgress([])
    setCurrentTool(null)
  }, [currentSession?.id])
  
  const handleSend = () => {
    if (!inputValue.trim() || !currentSession || !socket || !connected) return
    
    // 检查Worker是否已分配
    if (!currentSession.agentId || !currentSession.workerId) {
      console.error('[ChatPanel] 会话未分配Worker')
      addMessage(currentSession.id, {
        from: 'system',
        content: '❌ 会话未正确初始化，请重新创建会话'
      })
      return
    }
    
    // 添加用户消息
    addMessage(currentSession.id, {
      from: 'user',
      content: inputValue
    })
    
    // 发送消息到Worker，包含会话ID用于对话历史
    const messageData = {
      agentId: currentSession.agentId,
      taskId: currentSession.workerId,
      input: inputValue,
      sessionId: currentSession.id  // 添加会话ID以支持对话历史
    }
    
    socket.emit('worker:input', messageData)
    
    setInputValue('')
    setIsProcessing(true)
    
    // 30秒超时
    setTimeout(() => {
      if (isProcessing) {
        addMessage(currentSession.id, {
          from: 'system',
          content: '⚠️ 响应超时，请检查Worker状态'
        })
        setIsProcessing(false)
      }
    }, 30000)
  }
  
  if (!currentSession) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">选择或创建一个会话开始</p>
        </div>
      </Card>
    )
  }
  
  const getAIToolInfo = (tool: string) => {
    const tools: Record<string, { name: string; icon: string; color: string }> = {
      'claude': { name: 'Claude', icon: '🤖', color: 'purple' },
      'qwen': { name: 'Qwen (通义千问)', icon: '🎯', color: 'blue' },
      'cursor': { name: 'Cursor', icon: '🚀', color: 'green' }
    }
    return tools[tool] || { name: tool, icon: '💬', color: 'gray' }
  }
  
  const toolInfo = getAIToolInfo(currentSession.aiTool)
  const hasWorker = !!(currentSession.agentId && currentSession.workerId)
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <span className="text-2xl">{toolInfo.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base">{currentSession.name}</span>
                <Badge variant="outline" className={cn(
                  "text-xs",
                  toolInfo.color === 'purple' && "border-purple-500 text-purple-600",
                  toolInfo.color === 'blue' && "border-blue-500 text-blue-600",
                  toolInfo.color === 'green' && "border-green-500 text-green-600"
                )}>
                  {toolInfo.name}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {currentSession.repositoryName} • {currentSession.metadata?.branch || 'main'}
              </p>
            </div>
          </CardTitle>
          
          {/* Worker状态 */}
          <div className="flex items-center gap-3">
            {/* 连接状态 */}
            <div className="flex items-center gap-2">
              {!hasWorker ? (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">未初始化</span>
                </div>
              ) : isProcessing ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">
                    {currentTool ? `使用 ${currentTool}...` : '处理中'}
                  </span>
                </div>
              ) : connected ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">已连接</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">未连接</span>
                </div>
              )}
            </div>

            
            {/* Worker ID */}
            {hasWorker && (
              <div className="text-xs text-muted-foreground">
                Worker: {currentSession.workerId?.substring(0, 8)}...
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4 p-0 px-6 min-h-0">
        <ScrollArea className="flex-1 pr-4 min-h-0">
          <div className="space-y-4 py-4">
            {currentSession.messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                {hasWorker ? (
                  <>
                    <p>准备就绪！</p>
                    <p className="text-sm mt-2">
                      输入你的第一个问题，让 {toolInfo.name} 帮助你
                    </p>
                  </>
                ) : (
                  <>
                    <p>会话初始化中...</p>
                    <p className="text-sm mt-2">
                      请稍等片刻
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                {currentSession.messages.map((message) => {
                  const isUser = message.from === 'user'
                  const isSystem = message.from === 'system'
                  
                  if (isSystem) {
                    return (
                      <div key={message.id} className="flex justify-center">
                        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                          {message.content}
                        </div>
                      </div>
                    )
                  }
                
                  return (
                    <div 
                      key={message.id} 
                      className={cn(
                        'flex gap-3',
                        isUser && 'justify-end'
                      )}
                    >
                      {!isUser && (
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'px-4 py-3 rounded-lg max-w-[70%] space-y-2',
                          isUser 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-sm">
                            {isUser ? '你' : toolInfo.name}
                          </span>
                          <span className={cn(
                            "text-xs",
                            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            {dayjs(message.timestamp).format('HH:mm:ss')}
                          </span>
                        </div>
                        <div className="break-words">
                          <div className={cn(
                            "prose prose-sm max-w-none",
                            isUser ? "prose-invert" : "dark:prose-invert",
                            "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                          )}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                      {isUser && (
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                  )
                })}
                
                {/* 实时进度显示 */}
                {isProcessing && currentProgress.length > 0 && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    </div>
                    <div className="bg-muted/50 px-4 py-3 rounded-lg max-w-[80%] space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-sm text-blue-600">
                          {currentTool ? `正在使用 ${currentTool}...` : '处理中...'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {dayjs().format('HH:mm:ss')}
                        </span>
                      </div>
                      
                      
                      {/* 最近处理步骤 */}
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        <div className="text-xs font-medium text-muted-foreground">最近活动:</div>
                        {currentProgress.slice(-5).map((progress, index) => (
                          <div key={index} className="text-xs border-l-2 border-gray-200 pl-2 py-1">
                            {progress.type === 'tool' && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 font-medium text-purple-700">
                                  <Zap className="h-3 w-3" />
                                  <span>工具调用: {progress.tool}</span>
                                </div>
                                {progress.input && (
                                  <div className="text-muted-foreground pl-4">
                                    参数: {JSON.stringify(progress.input, null, 0).substring(0, 100)}
                                    {JSON.stringify(progress.input).length > 100 && '...'}
                                  </div>
                                )}
                              </div>
                            )}
                            {progress.type === 'tool_start' && (
                              <div className="flex items-center gap-1 text-orange-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>启动 {progress.tool}</span>
                              </div>
                            )}
                            {progress.type === 'tool_result' && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-green-600 font-medium">
                                  <CheckCircle className="h-3 w-3" />
                                  <span>完成 {progress.tool || progress.name}</span>
                                </div>
                                {progress.result && (
                                  <div className="text-muted-foreground pl-4 bg-green-50 px-2 py-1 rounded text-xs">
                                    结果: {typeof progress.result === 'string' ? 
                                      progress.result.substring(0, 150) :
                                      JSON.stringify(progress.result).substring(0, 150)
                                    }
                                    {(typeof progress.result === 'string' ? progress.result : JSON.stringify(progress.result)).length > 150 && '...'}
                                  </div>
                                )}
                              </div>
                            )}
                            {progress.type === 'text_chunk' && (
                              <div className="flex items-center gap-1 text-gray-600">
                                <span>💭 生成回复中...</span>
                              </div>
                            )}
                            {progress.type === 'error' && (
                              <div className="flex items-center gap-1 text-red-600">
                                <AlertCircle className="h-3 w-3" />
                                <span>错误: {progress.error}</span>
                              </div>
                            )}
                            {progress.type === 'unknown' && progress.data && (
                              <div className="text-gray-500">
                                <span>其他: {progress.data.type || 'unknown'}</span>
                                {progress.data.message && (
                                  <div className="pl-4 text-xs">{progress.data.message}</div>
                                )}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 pl-4">
                              {dayjs(progress.timestamp).format('HH:mm:ss.SSS')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        {/* 输入区域 */}
        <div className="flex gap-2 pb-6">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={
              !connected ? "未连接到服务器" :
              !hasWorker ? "等待Worker初始化..." :
              isProcessing ? "等待回复..." :
              `向 ${toolInfo.name} 提问...`
            }
            disabled={!connected || !hasWorker || isProcessing}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!connected || !inputValue.trim() || !hasWorker || isProcessing}
            size="icon"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}