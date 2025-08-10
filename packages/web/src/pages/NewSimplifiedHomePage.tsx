import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SessionManager } from '../components/SessionManager'
import { NewSimplifiedChatPanel } from '../components/NewSimplifiedChatPanel'
import { QuickSessionDialog } from '../components/QuickSessionDialog'
import { useStore } from '../store'
import { useSessionStore } from '../store/session.store'
import { Server, Copy, CheckCircle, LogOut, Shield, Activity, User, AlertCircle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { SERVER_URL } from '../config'
import { RadixBackground } from '../components/RadixBackground'
import { useAuthStore } from '../store/auth.store'

export function NewSimplifiedHomePage() {
  const navigate = useNavigate()
  const { connect, disconnect, agents, socket } = useStore()
  const { user, logout, isAuthenticated, accessToken } = useAuthStore()
  const { 
    currentSessionId, 
    selectSession: baseSelectSession, 
    createSession,
    loadSessions,
    assignWorker,
    addMessage,
    sessions
  } = useSessionStore()
  
  const [copied, setCopied] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  
  // 检查认证状态
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      navigate('/login')
    }
  }, [isAuthenticated, accessToken, navigate])
  
  // 连接WebSocket并加载会话
  useEffect(() => {
    if (isAuthenticated) {
      connect()
      // 延迟一下确保 token 已设置
      setTimeout(() => {
        loadSessions().catch(err => {
          console.error('Failed to load sessions:', err)
        })
      }, 100)
    }
    
    return () => {
      disconnect()
    }
  }, [isAuthenticated, loadSessions, connect, disconnect])
  
  const copyServerUrl = () => {
    navigator.clipboard.writeText(SERVER_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const handleLogout = () => {
    logout()
    navigate('/login')
  }
  
  // 包装selectSession，在选择会话时检查是否需要启动Worker
  const selectSession = (sessionId: string) => {
    baseSelectSession(sessionId)
    
    // 查找选中的会话
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    
    // 如果会话有claudeSessionId但没有workerId，说明需要恢复Worker
    if (session.metadata?.claudeSessionId && !session.workerId) {
      
      // 检查是否有可用的Agent
      if (agents.length === 0) {
        console.error('没有可用的Agent')
        addMessage(session.id, {
          from: 'system',
          content: '⚠️ 暂无可用的Agent，请等待Agent上线'
        })
        return
      }
      
      // 随机选择一个Agent
      const randomAgent = agents[Math.floor(Math.random() * agents.length)]
      const workerId = `task-${Date.now()}`
      
      // 更新会话，分配Worker和Agent
      assignWorker(session.id, workerId, randomAgent.id)
      
      // 通过WebSocket启动Worker，使用claudeSessionId恢复
      if (socket && socket.connected) {
        socket.emit('worker:start', {
          agentId: randomAgent.id,
          taskId: workerId,
          tool: session.aiTool,
          workingDirectory: `/tmp/repos/${session.repositoryName}`,
          sessionId: session.id,
          claudeSessionId: session.metadata.claudeSessionId,  // 使用存储的Claude会话ID恢复
          repositoryId: session.repositoryId,  // 传递仓库ID
          repositoryName: session.repositoryName,  // 传递仓库名称
          model: 'claude-sonnet-4-20250514'  // 传递默认模型
        })
        
        addMessage(session.id, {
          from: 'system',
          content: `🔄 正在恢复会话...`
        })
      }
    }
  }
  
  // 创建新会话并自动启动Worker
  const handleCreateSession = async (data: any) => {
    try {
      
      // 1. 创建本地会话
      const session = await createSession({
        name: data.name,
        repositoryId: data.repositoryId,
        repositoryName: data.repositoryName,
        aiTool: data.aiTool,
        branch: 'main',
        metadata: {
          model: data.model || 'claude-sonnet-4-20250514'  // 保存选择的模型
        }
      })
      
      
      // 2. 检查是否有可用的Agent
      if (agents.length === 0) {
        console.error('没有可用的Agent')
        addMessage(session.id, {
          from: 'system',
          content: '⚠️ 暂无可用的Agent，请等待Agent上线'
        })
        selectSession(session.id)
        setShowCreateDialog(false)
        return
      }
      
      // 3. 随机选择一个Agent
      const randomAgent = agents[Math.floor(Math.random() * agents.length)]
      const workerId = `task-${Date.now()}`
      
      // 4. 更新会话，分配Worker和Agent
      assignWorker(session.id, workerId, randomAgent.id)
      
      // 5. 选中新创建的会话
      selectSession(session.id)
      
      
      // 6. 通过WebSocket启动Worker
      if (!socket || !socket.connected) {
        console.error('WebSocket未连接')
        addMessage(session.id, {
          from: 'system',
          content: '❌ WebSocket连接失败，请刷新页面重试'
        })
        setShowCreateDialog(false)
        return
      }
      
      // 发送启动Worker命令，包含sessionId用于历史恢复和仓库信息
      socket.emit('worker:start', {
        agentId: randomAgent.id,
        taskId: workerId,
        tool: data.aiTool,
        workingDirectory: `/tmp/repos/${data.repositoryName}`,
        initialPrompt: `你是一个AI编程助手，正在使用 ${data.aiTool} 工具。
当前工作仓库：${data.repositoryName}
请帮助我完成编程任务。`,
        sessionId: session.id,  // 我们的数据库会话ID
        claudeSessionId: session.metadata?.claudeSessionId,  // Claude的真实会话ID（如果有的话）
        repositoryId: data.repositoryId,  // 传递仓库ID
        repositoryName: data.repositoryName,  // 传递仓库名称
        model: data.model || 'claude-sonnet-4-20250514'  // 传递选择的模型或默认模型
      })
      
      // 添加启动消息
      addMessage(session.id, {
        from: 'system',
        content: `🚀 正在启动 ${data.aiTool} Worker...`
      })
      
      // 监听Worker启动状态
      const handleWorkerStatus = (status: any) => {
        
        if (status.taskId !== workerId) return
        
        if (status.status === 'started') {
          // 不再显示就绪消息
        } else if (status.status === 'error') {
          addMessage(session.id, {
            from: 'system',
            content: `❌ 启动失败：${status.error || '未知错误'}`
          })
        }
        
        // 移除监听器
        socket.off('worker:status', handleWorkerStatus)
      }
      
      socket.on('worker:status', handleWorkerStatus)
      
      // 10秒超时
      setTimeout(() => {
        socket.off('worker:status', handleWorkerStatus)
      }, 10000)
      
      // 关闭对话框
      setShowCreateDialog(false)
      
    } catch (error) {
      console.error('创建会话失败:', error)
      alert('创建会话失败：' + (error instanceof Error ? error.message : '未知错误'))
    }
  }
  
  return (
    <div className="h-screen flex flex-col bg-background relative">
      {/* 背景 */}
      <RadixBackground />
      
      {/* Header - 更简洁 */}
      <header className="relative z-10 backdrop-blur-md bg-background/60 border-b border-border/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
              AI Orchestra
            </h1>
            
            {/* Agent状态指示器 */}
            <div className="flex items-center gap-2">
              <Activity className={`h-4 w-4 ${agents.length > 0 ? 'text-green-400' : 'text-gray-400'}`} />
              <span className="text-xs text-muted-foreground">
                {agents.length} Agents 在线
              </span>
            </div>
            
            {/* WebSocket连接状态 */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <span className="text-xs text-muted-foreground">
                {socket?.connected ? 'WebSocket已连接' : 'WebSocket未连接'}
              </span>
            </div>
            
            {/* 服务器地址 */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/5 border border-purple-500/10">
              <Server className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs text-muted-foreground font-mono">{SERVER_URL}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-purple-500/10"
                onClick={copyServerUrl}
              >
                {copied ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-purple-400/60" />
                )}
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 登录状态指示器 */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <User className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-green-600">{user.username}</span>
                  <span className="text-xs text-green-500/70">已登录</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-500">未登录</span>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin')}
              className="hover:bg-purple-500/10 text-sm text-purple-400"
            >
              <Shield className="h-4 w-4 mr-2" />
              管理
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="hover:bg-red-500/10 text-sm text-red-400"
            >
              <LogOut className="h-4 w-4 mr-2" />
              退出
            </Button>
          </div>
        </div>
      </header>
      
      {/* 主布局 - 只有会话管理和聊天 */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* 左侧 - 会话列表 */}
        <aside className="w-80 backdrop-blur-md bg-card/40 border-r border-border/50">
          <SessionManager
            currentSessionId={currentSessionId || undefined}
            onSessionSelect={selectSession}
            onNewSession={() => setShowCreateDialog(true)}
          />
        </aside>
        
        {/* 右侧 - 聊天界面 */}
        <main className="flex-1 backdrop-blur-sm bg-background/30">
          <NewSimplifiedChatPanel />
        </main>
      </div>
      
      {/* 创建会话对话框 */}
      <QuickSessionDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateSession}
      />
    </div>
  )
}