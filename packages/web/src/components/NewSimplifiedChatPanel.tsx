import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Bot, Copy, Check, ChevronDown, ChevronUp, Settings2, Zap, Brain, Target, HelpCircle } from 'lucide-react'
import { ToolUseRenderer } from './ToolUseRenderer'
import { useStore } from '../store'
import { useSessionStore, useSessionStoreBase } from '../store/session.store'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import '../styles/animations.css'

// 代码块组件（带复制功能）
const CodeBlockWithCopy: React.FC<{ code: string; language?: string }> = ({ code, language = 'text' }) => {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }
  
  return (
    <div className="relative group my-3">
      <div className="bg-gray-900 dark:bg-gray-950 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800 dark:bg-gray-900 border-b border-gray-700">
          <span className="text-xs text-gray-400">{language}</span>
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-700 rounded"
            title="复制代码"
          >
            {copied ? (
              <Check size={14} className="text-green-400" />
            ) : (
              <Copy size={14} className="text-gray-400" />
            )}
          </button>
        </div>
        <pre className="p-3 text-sm text-gray-300 font-mono overflow-x-auto">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}

// 斜杠命令定义
const slashCommands = [
  { command: '/clear', description: '清空当前对话' },
  { command: '/reset', description: '重置会话状态' },
  { command: '/help', description: '显示帮助信息' },
  { command: '/model', description: '切换模型' },
  { command: '/mode', description: '切换模式' },
  { command: '/status', description: '显示当前状态' },
  { command: '/export', description: '导出对话历史' },
  { command: '/copy', description: '复制最后的回复' },
]

export function NewSimplifiedChatPanel() {
  const [inputValue, setInputValue] = useState('')
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [agentLatency, setAgentLatency] = useState<number | null>(null)
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet')
  const [selectedMode, setSelectedMode] = useState<'ask' | 'auto' | 'yolo' | 'plan'>('auto')
  const [showSlashCommands, setShowSlashCommands] = useState(false)
  const [filteredCommands, setFilteredCommands] = useState(slashCommands)
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { socket, connected } = useStore()
  const { currentSession, addMessage, updateSession, setProcessingStatus } = useSessionStore()
  
  // 从session的metadata中获取isProcessing状态
  const isProcessing = currentSession?.metadata?.isProcessing || false
  
  // 当会话变化时，加入/离开Socket.io房间
  useEffect(() => {
    if (!socket || !currentSession) return
    
    // 加入新会话的房间
    socket.emit('session:join', { sessionId: currentSession.id })
    console.log(`Joined session room: ${currentSession.id}`)
    
    // 如果有 workerId 且消息为空，尝试加载历史
    if (currentSession.workerId && currentSession.messages.length === 0) {
      // 使用 setTimeout 确保 WebSocket 已连接
      setTimeout(() => {
        useSessionStoreBase.getState().loadMessages(currentSession.id)
      }, 500)
    }
    
    // 清理函数：离开之前的会话房间
    return () => {
      socket.emit('session:leave', { sessionId: currentSession.id })
      console.log(`Left session room: ${currentSession.id}`)
    }
  }, [currentSession?.id, socket])
  
  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages])
  
  // Worker消息监听器
  const processedMessages = useRef(new Set<string>())
  const processedInitMessages = useRef(new Set<string>())
  
  // 监听Agent延迟更新
  useEffect(() => {
    if (!socket) return
    
    const handleLatencyUpdate = (data: { agentId: string; latency: number }) => {
      // 如果是当前会话的Agent，更新延迟
      if (currentSession && data.agentId === currentSession.agentId) {
        setAgentLatency(data.latency)
      }
    }
    
    socket.on('agent:latency_update', handleLatencyUpdate)
    
    return () => {
      socket.off('agent:latency_update', handleLatencyUpdate)
    }
  }, [socket, currentSession?.agentId])
  
  useEffect(() => {
    if (!socket || !currentSession) return
    
    // 监听Worker消息
    const handleWorkerMessage = (data: any) => {
      // 由于服务器现在只发送给正确的会话房间，我们不再需要在客户端过滤
      // 但保留agentId检查作为额外保障
      if (data.agentId && data.agentId !== currentSession.agentId) return
      
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
            if (currentSession) {
              setProcessingStatus(currentSession.id, false)
            }
          } else {
          }
        }
      } else if (message.type === 'system') {
        // 处理系统消息
        if (message.subtype === 'init') {
          // 防止重复显示初始化消息
          const initKey = `${currentSession.id}-${message.model}-${message.tools?.length || 0}`
          if (!processedInitMessages.current.has(initKey)) {
            processedInitMessages.current.add(initKey)
            
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
        }
      } else if (message.type === 'error') {
        // 处理错误消息
        addMessage(currentSession.id, {
          from: 'system',
          content: `❌ 错误: ${message.error || '未知错误'}`
        })
        if (currentSession) {
          setProcessingStatus(currentSession.id, false)
        }
      }
    }
    
    // 监听Worker状态
    const handleWorkerStatus = (data: any) => {
      // 由于服务器现在只发送给正确的会话房间，我们不再需要在客户端过滤
      // 但保留agentId检查作为额外保障
      if (data.agentId && data.agentId !== currentSession.agentId) return
      
      if (data.status === 'started') {
        if (currentSession) {
          setProcessingStatus(currentSession.id, true)
        }
        setCurrentTool(null)
      } else if (data.status === 'stopped' || data.status === 'completed' || data.status === 'error') {
        if (currentSession) {
          setProcessingStatus(currentSession.id, false)
        }
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
      // 由于服务器现在只发送给正确的会话房间，我们不再需要在客户端过滤
      // 但保留agentId检查作为额外保障
      if (data.agentId && data.agentId !== currentSession.agentId) return
      
      const { toolUse } = data
      setCurrentTool(toolUse.name)
      
      // 添加工具调用到消息列表（可选，用于显示详细信息）
      addMessage(currentSession.id, {
        from: 'system',
        content: `🔧 使用工具: ${toolUse.name}`,
        metadata: {
          type: 'tool_use',
          tool: toolUse.name,
          input: toolUse.input
        } as any
      })
    }
    
    // 工具结果不再单独处理，会通过助手消息格式化显示
    
    // 监听思考过程
    const handleThinking = (data: any) => {
      if (data.agentId && data.agentId !== currentSession.agentId) return
      
      const { thinking } = data
      // 添加思考过程到消息列表
      addMessage(currentSession.id, {
        from: 'system',
        content: thinking.content,
        metadata: {
          type: 'thinking',
          timestamp: thinking.timestamp
        } as any
      })
    }
    
    // 监听系统信息（token使用等）
    const handleSystemInfo = (data: any) => {
      // 由于服务器现在只发送给正确的会话房间，我们不再需要在客户端过滤
      // 但保留agentId检查作为额外保障
      if (data.agentId && data.agentId !== currentSession.agentId) return
      
      // 系统信息不需要特别处理
    }
    
    // 监听处理进度
    const handleProgress = (data: any) => {
      // 由于服务器现在只发送给正确的会话房间，我们不再需要在客户端过滤
      // 但保留agentId检查作为额外保障
      if (data.agentId && data.agentId !== currentSession.agentId) return
      
      const { progress } = data
      
      // 处理特定进度类型
      if (progress.type === 'init') {
        // Worker初始化进度
        const messageKey = `init-${progress.step}`
        if (!processedInitMessages.current.has(messageKey)) {
          processedInitMessages.current.add(messageKey)
          
          // 添加初始化进度消息
          addMessage(currentSession.id, {
            from: 'system',
            content: `${progress.message} (${progress.percentage}%)`,
            metadata: {
              type: 'init_progress',
              step: progress.step,
              percentage: progress.percentage
            } as any
          })
        }
      } else if (progress.type === 'tool_start') {
        setCurrentTool(progress.tool)
      } else if (progress.type === 'response_complete') {
        setCurrentTool(null)
      }
    }
    
    // 确保每次只绑定一次事件监听器
    socket.off('worker:message', handleWorkerMessage)
    socket.off('worker:status', handleWorkerStatus)
    socket.off('worker:tool-use', handleToolUse)
    socket.off('worker:thinking', handleThinking)
    socket.off('worker:system-info', handleSystemInfo)
    socket.off('worker:progress', handleProgress)
    
    socket.on('worker:message', handleWorkerMessage)
    socket.on('worker:status', handleWorkerStatus)
    socket.on('worker:tool-use', handleToolUse)
    socket.on('worker:thinking', handleThinking)
    socket.on('worker:system-info', handleSystemInfo)
    socket.on('worker:progress', handleProgress)
    
    return () => {
      socket.off('worker:message', handleWorkerMessage)
      socket.off('worker:status', handleWorkerStatus)
      socket.off('worker:tool-use', handleToolUse)
      socket.off('worker:thinking', handleThinking)
      socket.off('worker:system-info', handleSystemInfo)
      socket.off('worker:progress', handleProgress)
    }
  }, [socket, currentSession?.id, currentSession?.agentId, addMessage])
  
  // 当会话改变时，清空去重集合和状态
  useEffect(() => {
    processedMessages.current.clear()
    processedInitMessages.current.clear()
    setCurrentTool(null)
  }, [currentSession?.id])
  
  // 处理输入变化，检测斜杠命令
  const handleInputChange = (value: string) => {
    setInputValue(value)
    
    if (value.startsWith('/')) {
      const searchTerm = value.toLowerCase()
      const filtered = slashCommands.filter(cmd => 
        cmd.command.toLowerCase().startsWith(searchTerm)
      )
      setFilteredCommands(filtered)
      setShowSlashCommands(filtered.length > 0)
      setSelectedCommandIndex(0) // 重置选中索引
    } else {
      setShowSlashCommands(false)
      setSelectedCommandIndex(0)
    }
  }
  
  // 处理键盘导航
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSlashCommands && filteredCommands.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedCommandIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        )
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedCommandIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        )
      } else if (e.key === 'Tab' || (e.key === 'Enter' && showSlashCommands)) {
        e.preventDefault()
        const selectedCommand = filteredCommands[selectedCommandIndex]
        if (selectedCommand) {
          setInputValue(selectedCommand.command)
          setShowSlashCommands(false)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowSlashCommands(false)
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 执行斜杠命令
  const executeSlashCommand = (command: string) => {
    switch (command) {
      case '/clear':
        if (currentSession) {
          // 清空所有消息
          updateSession(currentSession.id, { messages: [] })
          // 不需要添加系统消息，因为消息已被清空
          // 用户会看到欢迎界面
        }
        break
        
      case '/reset':
        if (currentSession) {
          setProcessingStatus(currentSession.id, false)
          addMessage(currentSession.id, {
            from: 'system',
            content: '✅ 会话已重置'
          })
        }
        break
        
      case '/help':
        addMessage(currentSession!.id, {
          from: 'system',
          content: `📚 可用命令：\n${slashCommands.map(cmd => `${cmd.command} - ${cmd.description}`).join('\n')}`
        })
        break
        
      case '/status':
        addMessage(currentSession!.id, {
          from: 'system',
          content: `📊 当前状态：\n模型: ${selectedModel}\n模式: ${selectedMode}\n连接: ${connected ? '已连接' : '未连接'}\nWorker: ${currentSession?.workerId ? '已分配' : '未分配'}`
        })
        break
        
      case '/copy':
        const lastAssistantMessage = currentSession?.messages
          .filter(m => m.from === 'assistant')
          .pop()
        if (lastAssistantMessage) {
          navigator.clipboard.writeText(lastAssistantMessage.content)
          addMessage(currentSession!.id, {
            from: 'system',
            content: '✅ 已复制最后的回复到剪贴板'
          })
        } else {
          addMessage(currentSession!.id, {
            from: 'system',
            content: '❌ 没有找到助手回复'
          })
        }
        break
        
      case '/export':
        const messages = currentSession?.messages || []
        const exportData = JSON.stringify(messages, null, 2)
        const blob = new Blob([exportData], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `chat-export-${new Date().toISOString()}.json`
        a.click()
        URL.revokeObjectURL(url)
        addMessage(currentSession!.id, {
          from: 'system',
          content: '✅ 对话历史已导出'
        })
        break
        
      case '/model':
        // 如果只输入 /model，显示可用模型列表
        addMessage(currentSession!.id, {
          from: 'system',
          content: `📋 可用模型：\n• claude-3-5-sonnet (当前: ${selectedModel === 'claude-3-5-sonnet' ? '✓' : ''})\n• claude-3-opus\n• claude-3-haiku\n• claude-2\n\n使用方式: /model <模型名>`
        })
        break
        
      case '/mode':
        // 如果只输入 /mode，显示可用模式列表
        addMessage(currentSession!.id, {
          from: 'system',
          content: `📋 可用模式：\n• ask - 每个操作前都会询问确认 ${selectedMode === 'ask' ? '(当前)' : ''}\n• auto - 自动执行但会等待确认关键操作 ${selectedMode === 'auto' ? '(当前)' : ''}\n• yolo - 完全自动执行，无需确认 ${selectedMode === 'yolo' ? '(当前)' : ''}\n• plan - 先制定计划，确认后执行 ${selectedMode === 'plan' ? '(当前)' : ''}\n\n使用方式: /mode <模式名>`
        })
        break
        
      default:
        if (command.startsWith('/model ')) {
          const model = command.replace('/model ', '').trim()
          const validModels = ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku', 'claude-2']
          if (validModels.includes(model)) {
            setSelectedModel(model)
            addMessage(currentSession!.id, {
              from: 'system',
              content: `✅ 模型已切换为: ${model}`
            })
          } else {
            addMessage(currentSession!.id, {
              from: 'system',
              content: `❌ 无效的模型: ${model}\n可用模型: ${validModels.join(', ')}`
            })
          }
        } else if (command.startsWith('/mode ')) {
          const mode = command.replace('/mode ', '').trim() as any
          if (['ask', 'auto', 'yolo', 'plan'].includes(mode)) {
            setSelectedMode(mode)
            addMessage(currentSession!.id, {
              from: 'system',
              content: `✅ 模式已切换为: ${mode}`
            })
          } else {
            addMessage(currentSession!.id, {
              from: 'system',
              content: `❌ 无效的模式: ${mode}\n可用模式: ask, auto, yolo, plan`
            })
          }
        } else {
          // 未知命令
          addMessage(currentSession!.id, {
            from: 'system',
            content: `❌ 未知命令: ${command}\n输入 /help 查看可用命令`
          })
        }
    }
    
    setInputValue('')
    setShowSlashCommands(false)
  }

  const handleSend = () => {
    if (!inputValue.trim() || !currentSession || !socket || !connected) return
    
    // 检查是否是斜杠命令
    if (inputValue.startsWith('/')) {
      const command = inputValue.split(' ')[0]
      if (slashCommands.some(cmd => cmd.command === command || inputValue.startsWith(command + ' '))) {
        executeSlashCommand(inputValue)
        return
      }
    }
    
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
    
    // 发送消息到Worker，包含会话ID、模型和模式信息
    const messageData = {
      agentId: currentSession.agentId,
      taskId: currentSession.workerId,
      input: inputValue,
      sessionId: currentSession.id,  // 添加会话ID以支持对话历史
      model: selectedModel,  // 添加选中的模型
      mode: selectedMode  // 添加选中的模式
    }
    
    socket.emit('worker:input', messageData)
    
    setInputValue('')
    setProcessingStatus(currentSession.id, true)
    
    // 30秒超时
    setTimeout(() => {
      const session = useSessionStoreBase.getState().sessions.find((s: any) => s.id === currentSession.id)
      if (session?.metadata?.isProcessing) {
        addMessage(currentSession.id, {
          from: 'system',
          content: '⚠️ 响应超时，请检查Worker状态'
        })
        setProcessingStatus(currentSession.id, false)
      }
    }, 30000)
  }
  
  if (!currentSession) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-center">
          <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">选择或创建一个会话开始</p>
        </div>
      </div>
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
    <div className="h-full flex flex-col bg-white dark:bg-gray-950">
      {/* 极简的顶部信息条 */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="text-lg">{toolInfo.icon}</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{currentSession.name}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">{toolInfo.name}</span>
            {currentSession.repositoryName && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500">📦 {currentSession.repositoryName}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs">
            {/* 模型选择 */}
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[140px] h-7 text-xs">
                <Brain className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                <SelectItem value="claude-2">Claude 2</SelectItem>
              </SelectContent>
            </Select>
            
            {/* 模式选择 */}
            <Select value={selectedMode} onValueChange={(value: any) => setSelectedMode(value)}>
              <SelectTrigger className="w-[100px] h-7 text-xs">
                {selectedMode === 'ask' && <HelpCircle className="h-3 w-3 mr-1" />}
                {selectedMode === 'auto' && <Settings2 className="h-3 w-3 mr-1" />}
                {selectedMode === 'yolo' && <Zap className="h-3 w-3 mr-1" />}
                {selectedMode === 'plan' && <Target className="h-3 w-3 mr-1" />}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ask">
                  <div className="flex items-center">
                    <HelpCircle className="h-3 w-3 mr-1" />
                    Ask模式
                  </div>
                </SelectItem>
                <SelectItem value="auto">
                  <div className="flex items-center">
                    <Settings2 className="h-3 w-3 mr-1" />
                    Auto模式
                  </div>
                </SelectItem>
                <SelectItem value="yolo">
                  <div className="flex items-center">
                    <Zap className="h-3 w-3 mr-1" />
                    Yolo模式
                  </div>
                </SelectItem>
                <SelectItem value="plan">
                  <div className="flex items-center">
                    <Target className="h-3 w-3 mr-1" />
                    Plan模式
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            {agentLatency !== null && (
              <span className={`text-gray-500 ${
                agentLatency < 50 ? 'text-green-500' : 
                agentLatency < 150 ? 'text-yellow-500' : 
                'text-red-500'
              }`}>
                延迟: {agentLatency}ms
              </span>
            )}
            {!hasWorker ? (
              <span className="text-yellow-600">未初始化</span>
            ) : isProcessing ? (
              <div className="flex items-center gap-1 text-blue-600">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></div>
                <span>{currentTool ? `${currentTool}...` : '处理中'}</span>
              </div>
            ) : connected ? (
              <span className="text-green-600">已连接</span>
            ) : (
              <span className="text-red-600">未连接</span>
            )}
          </div>
        </div>
      </div>
      
      {/* CUI风格的消息区域 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto px-6 py-6">
          {currentSession.messages.length === 0 ? (
            <div className="text-center py-20">
              <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              {hasWorker ? (
                <>
                  <p className="text-gray-600 dark:text-gray-400">准备就绪！</p>
                  <p className="text-sm text-gray-500 mt-2">
                    输入你的第一个问题，让 {toolInfo.name} 帮助你
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-600 dark:text-gray-400">会话初始化中...</p>
                  <p className="text-sm text-gray-500 mt-2">
                    请稍等片刻
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {currentSession.messages.map((message, index) => {
                const isUser = message.from === 'user'
                const isSystem = message.from === 'system'
                const isAssistant = message.from === 'assistant'
                
                // 用户消息 - 右对齐简单样式
                if (isUser) {
                  const lines = message.content.split('\n')
                  const shouldShowExpandButton = lines.length > 8
                  const isExpanded = expandedMessages.has(message.id)
                  const displayLines = isExpanded ? lines : lines.slice(0, 8)
                  const hiddenLinesCount = lines.length - 8
                  const displayContent = displayLines.join('\n')
                  
                  return (
                    <div key={message.id} className="flex justify-end mb-6 message-fade-in">
                      <div className="max-w-[80%] bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 relative smooth-transition hover:shadow-md">
                        {shouldShowExpandButton && (
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedMessages)
                              if (isExpanded) {
                                newExpanded.delete(message.id)
                              } else {
                                newExpanded.add(message.id)
                              }
                              setExpandedMessages(newExpanded)
                            }}
                            className="absolute top-2 right-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                            title={isExpanded ? "收起" : "展开"}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                        <div className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                          {displayContent}
                          {!isExpanded && shouldShowExpandButton && (
                            <span className="text-gray-500 dark:text-gray-400 italic">
                              {'\n'}... +{hiddenLinesCount} 行
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }

                // 助手消息 - 左对齐
                if (isAssistant) {
                  const isLastAssistantMessage = index === currentSession.messages.length - 1 || 
                    (index < currentSession.messages.length - 1 && currentSession.messages[index + 1].from !== 'assistant')
                  
                  return (
                    <div key={message.id} className="mb-6 relative message-fade-in">
                      {!isLastAssistantMessage && (
                        <div className="absolute left-2 top-8 bottom-0 w-px bg-gray-200 dark:bg-gray-700 smooth-transition" />
                      )}
                      <div className="flex gap-3">
                        <div className="w-4 h-5 flex-shrink-0 flex items-center justify-center relative mt-3.5">
                          <div className="w-2 h-2 bg-gray-700 dark:bg-gray-300 rounded-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ node, inline, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || '')
                                  const language = match ? match[1] : 'text'
                                  
                                  if (!inline && match) {
                                    return <CodeBlockWithCopy code={String(children).replace(/\n$/, '')} language={language} />
                                  }
                                  
                                  return (
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  )
                                }
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
                
                // 系统消息处理
                if (isSystem) {
                  const isThinking = (message.metadata as any)?.type === 'thinking'
                  const isToolUse = (message.metadata as any)?.type === 'tool_use'
                  const isInitProgress = (message.metadata as any)?.type === 'init_progress'
                  
                  if (isThinking) {
                    return (
                      <div key={message.id} className="mb-3">
                        <div className="flex gap-3">
                          <div className="w-4 h-5 flex-shrink-0 flex items-center justify-center relative mt-2">
                            <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full" style={{ opacity: 0.6 }} />
                          </div>
                          <div className="flex-1 text-sm text-gray-500 dark:text-gray-400 italic leading-relaxed pt-1">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    )
                  }
                  
                  if (isToolUse) {
                    const toolName = message.metadata?.tool || message.content.replace('🔧 使用工具: ', '')
                    const toolInput = (message.metadata as any)?.input
                    
                    return (
                      <div key={message.id} className="mb-3">
                        <div className="flex gap-3">
                          <div className="w-4 h-5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <ToolUseRenderer
                              toolName={toolName}
                              toolInput={toolInput}
                              isLoading={isProcessing && index === currentSession.messages.length - 1}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  }
                  
                  // Worker初始化进度消息
                  if (isInitProgress) {
                    const percentage = (message.metadata as any)?.percentage || 0
                    const step = (message.metadata as any)?.step
                    
                    return (
                      <div key={message.id} className="text-center py-2 mb-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-xs">
                          {percentage < 100 ? (
                            <>
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span>{message.content}</span>
                            </>
                          ) : (
                            <span>{message.content}</span>
                          )}
                        </div>
                      </div>
                    )
                  }
                  
                  // 默认系统消息
                  return (
                    <div key={message.id} className="text-center py-2 mb-3">
                      <div className="text-xs text-gray-400">
                        {message.content}
                      </div>
                    </div>
                  )
                }

                return null
              })}
                
              {/* 实时进度显示 - CUI风格 */}
              {isProcessing && (
                <div className="mb-6 message-fade-in">
                  <div className="flex gap-3">
                    <div className="w-4 h-5 flex-shrink-0 flex items-center justify-center relative">
                      <div className="flex gap-1">
                        <span className="loading-dot" />
                        <span className="loading-dot" />
                        <span className="loading-dot" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-600 dark:text-gray-400 italic">
                        {currentTool ? `正在使用 ${currentTool}...` : '思考中...'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>
      
      {/* CUI风格的输入区域 */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="max-w-4xl mx-auto px-6 py-4">
          {/* 模式说明 */}
          <div className="mb-2 text-xs text-gray-500">
            {selectedMode === 'ask' && "Ask模式：每个操作前都会询问确认"}
            {selectedMode === 'auto' && "Auto模式：自动执行但会等待确认关键操作"}
            {selectedMode === 'yolo' && "Yolo模式：完全自动执行，无需确认"}
            {selectedMode === 'plan' && "Plan模式：先制定计划，确认后执行"}
          </div>
          <div className="flex gap-3 items-end relative">
            <div className="flex-1 min-w-0">
              {/* 斜杠命令提示 */}
              {showSlashCommands && (
                <div className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2">
                  {filteredCommands.map((cmd, index) => (
                    <button
                      key={cmd.command}
                      className={`w-full text-left px-3 py-2 rounded flex items-center justify-between text-sm transition-colors ${
                        index === selectedCommandIndex 
                          ? 'bg-blue-100 dark:bg-blue-900/30' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => {
                        setInputValue(cmd.command)
                        setShowSlashCommands(false)
                      }}
                      onMouseEnter={() => setSelectedCommandIndex(index)}
                    >
                      <span className="font-mono text-blue-600 dark:text-blue-400">{cmd.command}</span>
                      <span className="text-gray-500 text-xs">{cmd.description}</span>
                    </button>
                  ))}
                </div>
              )}
              <Input
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !connected ? "未连接到服务器" :
                  !hasWorker ? "等待Worker初始化..." :
                  isProcessing ? "等待回复..." :
                  `向 ${toolInfo.name} 提问...`
                }
                disabled={!connected || !hasWorker || isProcessing}
                className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-sm placeholder:text-gray-400 px-0"
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!connected || !inputValue.trim() || !hasWorker || isProcessing}
              variant="ghost"
              size="sm"
              className="p-2 h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
            >
              {isProcessing ? (
                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}