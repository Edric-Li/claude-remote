import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgentList } from '../components/AgentList'
import { ChatPanel } from '../components/ChatPanel'
import { WorkerPanel } from '../components/WorkerPanel'
import { useStore } from '../store'
import { MessageCircle, Bot, Shield, Server, Copy, CheckCircle, LogOut, Sparkles, Code2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { SERVER_URL } from '../config'
import { RadixBackground } from '../components/RadixBackground'
import { useAuthStore } from '../store/auth.store'
import { Card, CardContent } from '../components/ui/card'

export function HomePage() {
  const navigate = useNavigate()
  const connect = useStore((state) => state.connect)
  const disconnect = useStore((state) => state.disconnect)
  const selectRandomWorker = useStore((state) => state.selectRandomWorker)
  const agents = useStore((state) => state.agents)
  const { user, logout } = useAuthStore()
  const [showChat, setShowChat] = useState(false)
  const [selectedTool, setSelectedTool] = useState<'claude' | 'qwcoder' | null>(null)
  const [showToolSelection, setShowToolSelection] = useState(false)
  
  useEffect(() => {
    connect()
    
    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [connect, disconnect])
  
  const [copied, setCopied] = useState(false)
  
  const copyServerUrl = () => {
    navigator.clipboard.writeText(SERVER_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleStartChat = () => {
    setShowToolSelection(true)
  }

  const handleSelectTool = (tool: 'claude' | 'qwcoder') => {
    // 检查是否有可用的 agent
    if (agents.length === 0) {
      alert('暂无可用的 Agent，请等待 Agent 连接')
      return
    }
    
    // 随机选择一个 worker
    const workerId = selectRandomWorker(tool)
    if (workerId) {
      setSelectedTool(tool)
      setShowToolSelection(false)
      setShowChat(true)
    }
  }
  
  return (
    <div className="h-screen flex flex-col bg-background relative">
      {/* 背景 */}
      <RadixBackground />
      
      {/* Header */}
      <header className="relative z-10 backdrop-blur-md bg-background/60 border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
              AI Orchestra
            </h1>
            
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/5 border border-purple-500/10">
              <Server className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs text-muted-foreground font-mono">{SERVER_URL}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-purple-500/10 transition-all"
                onClick={copyServerUrl}
              >
                {copied ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-purple-400/60 hover:text-purple-400" />
                )}
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-400 to-purple-600 flex items-center justify-center">
                  <span className="text-xs text-white font-semibold">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-purple-400">{user.username}</span>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin')}
              className="hover:bg-purple-500/10 transition-all text-sm text-purple-400"
            >
              <Shield className="h-4 w-4 mr-2" />
              管理后台
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="hover:bg-red-500/10 transition-all text-sm text-red-400"
            >
              <LogOut className="h-4 w-4 mr-2" />
              退出
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Sidebar - Agent List */}
        <aside className="w-80 backdrop-blur-md bg-card/40 border-r border-border/50">
          <AgentList />
        </aside>
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col backdrop-blur-sm bg-background/30">
          {!showChat && !showToolSelection ? (
            // 初始欢迎界面
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-r from-purple-500/20 to-purple-600/20 flex items-center justify-center">
                  <MessageCircle className="h-10 w-10 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent mb-3">
                  欢迎使用 AI Orchestra
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  选择您的 AI 助手，开始智能对话体验
                </p>
                <Button 
                  onClick={handleStartChat}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/25"
                  size="lg"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  开始对话
                </Button>
              </div>
            </div>
          ) : showToolSelection ? (
            // 工具选择界面
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-4xl w-full">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent mb-3">
                    选择您的 AI 助手
                  </h2>
                  <p className="text-muted-foreground">
                    选择一个 AI 工具开始对话
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Claude Card */}
                  <Card 
                    className="backdrop-blur-md bg-card/60 border-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer hover:shadow-lg hover:shadow-purple-500/10"
                    onClick={() => handleSelectTool('claude')}
                  >
                    <CardContent className="p-8 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center">
                        <Bot className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Claude</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Anthropic 的 Claude AI 助手，擅长编程、写作和分析
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs">
                          编程助手
                        </span>
                        <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs">
                          智能对话
                        </span>
                        <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs">
                          代码分析
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* QwCoder Card */}
                  <Card 
                    className="backdrop-blur-md bg-card/60 border-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer hover:shadow-lg hover:shadow-purple-500/10"
                    onClick={() => handleSelectTool('qwcoder')}
                  >
                    <CardContent className="p-8 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                        <Code2 className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">QwCoder</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        专业的代码生成和优化工具，支持多种编程语言
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                          代码生成
                        </span>
                        <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                          代码优化
                        </span>
                        <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                          多语言支持
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="text-center mt-6">
                  <Button 
                    variant="ghost"
                    onClick={() => setShowToolSelection(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    返回
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // 对话界面
            <Tabs defaultValue="chat" className="flex-1 flex flex-col">
              {/* Tab Navigation */}
              <div className="border-b border-border/50 backdrop-blur-md bg-background/40">
                <TabsList className="h-auto p-0 bg-transparent rounded-none">
                  <TabsTrigger 
                    value="chat" 
                    className="px-6 py-3 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-purple-500 data-[state=active]:text-purple-400 transition-all text-sm"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    {selectedTool === 'claude' ? 'Claude 对话' : 'QwCoder 对话'}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="worker"
                    className="px-6 py-3 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-purple-500 data-[state=active]:text-purple-400 transition-all text-sm"
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Worker 控制
                  </TabsTrigger>
                </TabsList>
              </div>
              
              {/* Tab Content */}
              <div className="flex-1 overflow-hidden">
                <TabsContent value="chat" className="h-full m-0">
                  <ChatPanel selectedTool={selectedTool} />
                </TabsContent>
                <TabsContent value="worker" className="h-full m-0">
                  <WorkerPanel />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </main>
      </div>
    </div>
  )
}