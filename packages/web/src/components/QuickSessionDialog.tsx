import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useAuthStore } from '../store/auth.store'
import { API_BASE_URL } from '../config'
import { Loader2, GitBranch, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Repository {
  id: string
  name: string
  url: string
  branch: string
  isPrivate: boolean
}

interface QuickSessionDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: SessionData) => void
}

interface SessionData {
  name: string
  repositoryId: string
  repositoryName?: string
  aiTool: string
  model?: string  // 添加模型字段
  autoAssignWorker: boolean
}

const AI_TOOLS = [
  { 
    id: 'claude', 
    name: 'Claude', 
    icon: '🤖', 
    description: '强大的AI编程助手',
    features: ['代码生成', '重构优化', '错误修复']
  },
  { 
    id: 'qwen', 
    name: 'Qwen (通义千问)', 
    icon: '🎯', 
    description: '阿里云AI编程助手',
    features: ['智能补全', '上下文理解', '快速编辑']
  },
  { 
    id: 'cursor', 
    name: 'Cursor', 
    icon: '🚀', 
    description: '快速代码生成工具',
    features: ['快速生成', '模板支持', '批量处理']
  },
]

export function QuickSessionDialog({ open, onClose, onSubmit }: QuickSessionDialogProps) {
  const { accessToken } = useAuthStore()
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const [selectedRepo, setSelectedRepo] = useState<string>('')
  const [selectedTool, setSelectedTool] = useState<string>('claude')
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4-20250514')
  const [sessionName, setSessionName] = useState('')
  const [autoName, setAutoName] = useState(true)
  
  // 获取仓库列表
  useEffect(() => {
    if (open) {
      fetchRepositories()
    }
  }, [open])
  
  // 自动生成会话名称
  useEffect(() => {
    if (autoName && selectedRepo && selectedTool) {
      const repo = repositories.find(r => r.id === selectedRepo)
      const tool = AI_TOOLS.find(t => t.id === selectedTool)
      if (repo && tool) {
        const date = new Date().toLocaleDateString('zh-CN', { 
          month: 'short', 
          day: 'numeric' 
        })
        setSessionName(`${repo.name}-${tool.name}-${date}`)
      }
    }
  }, [selectedRepo, selectedTool, repositories, autoName])
  
  const fetchRepositories = async () => {
    setLoading(true)
    try {
      let response = await fetch(`${API_BASE_URL}/api/repositories`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      // 如果是401错误，尝试刷新token
      if (response.status === 401) {
        try {
          console.log('Token过期，尝试刷新...')
          const { refreshAccessToken } = useAuthStore.getState()
          await refreshAccessToken()
          
          const { accessToken: newToken } = useAuthStore.getState()
          
          // 使用新token重试请求
          response = await fetch(`${API_BASE_URL}/api/repositories`, {
            headers: {
              'Authorization': `Bearer ${newToken}`
            }
          })
        } catch (refreshError) {
          console.error('Token刷新失败:', refreshError)
          setRepositories([])
          return
        }
      }
      
      if (response.ok) {
        const data = await response.json()
        console.log('获取到仓库数据:', data)
        setRepositories(data)
        if (data.length > 0 && !selectedRepo) {
          setSelectedRepo(data[0].id)
        }
      } else {
        console.error('Failed to fetch repositories:', response.status, response.statusText)
        setRepositories([])
      }
    } catch (error) {
      console.error('Failed to fetch repositories:', error)
      setRepositories([])
    } finally {
      setLoading(false)
    }
  }
  
  const handleSubmit = async () => {
    if (!selectedRepo || !sessionName.trim()) return
    
    console.log('Submitting session with:', {
      name: sessionName,
      repositoryId: selectedRepo,
      aiTool: selectedTool
    })
    
    setSubmitting(true)
    try {
      // 获取选中仓库的完整信息
      const selectedRepoData = repositories.find(r => r.id === selectedRepo)
      
      await onSubmit({
        name: sessionName.trim(),
        repositoryId: selectedRepo,
        repositoryName: selectedRepoData?.name || 'Unknown',
        aiTool: selectedTool,
        model: selectedTool === 'claude' ? selectedModel : undefined,
        autoAssignWorker: true
      })
      
      // 重置表单
      setSessionName('')
      setAutoName(true)
      onClose()
    } catch (error) {
      console.error('Failed to create session:', error)
      alert('创建会话失败：' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setSubmitting(false)
    }
  }
  
  const selectedToolData = AI_TOOLS.find(t => t.id === selectedTool)
  
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            快速创建对话
          </DialogTitle>
          <DialogDescription>
            选择仓库和AI助手，系统将自动分配可用的Worker
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* 仓库选择 */}
          <div className="grid gap-2">
            <Label htmlFor="repository">选择仓库</Label>
            {loading ? (
              <div className="flex items-center justify-center py-3 border rounded-md">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">加载中...</span>
              </div>
            ) : repositories.length === 0 ? (
              <div className="text-center py-3 border rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  {accessToken ? '正在加载仓库列表...' : '请先登录以查看仓库'}
                </p>
              </div>
            ) : (
              <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                <SelectTrigger>
                  <SelectValue placeholder="选择一个仓库" />
                </SelectTrigger>
                <SelectContent>
                  {repositories.map((repo) => (
                    <SelectItem key={repo.id} value={repo.id}>
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3" />
                        <span>{repo.name}</span>
                        {repo.isPrivate && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                            私有
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* AI助手选择 - 卡片式 */}
          <div className="grid gap-2">
            <Label>选择AI助手</Label>
            <div className="grid grid-cols-3 gap-2">
              {AI_TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                    "hover:border-purple-400 hover:bg-purple-50/50",
                    selectedTool === tool.id
                      ? "border-purple-500 bg-purple-50"
                      : "border-border"
                  )}
                >
                  <span className="text-2xl">{tool.icon}</span>
                  <span className="text-xs font-medium">{tool.name}</span>
                </button>
              ))}
            </div>
            
            {selectedToolData && (
              <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-900 mb-2">
                  {selectedToolData.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {selectedToolData.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-white px-2 py-1 rounded-full border border-purple-200"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* 模型选择 - 仅在选择Claude时显示 */}
          {selectedTool === 'claude' && (
            <div className="grid gap-2">
              <Label htmlFor="model">选择Claude模型</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-sonnet-4-20250514">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Claude 4 Sonnet</span>
                      <span className="text-xs text-muted-foreground">(最新，推荐)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="claude-3-5-sonnet-20241022">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Claude 3.5 Sonnet</span>
                      <span className="text-xs text-muted-foreground">(强大)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="claude-3-5-haiku-20241022">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Claude 3.5 Haiku</span>
                      <span className="text-xs text-muted-foreground">(快速)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="claude-3-opus-20240229">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Claude 3 Opus</span>
                      <span className="text-xs text-muted-foreground">(经典)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="claude-3-sonnet-20240229">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Claude 3 Sonnet</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="claude-3-haiku-20240307">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Claude 3 Haiku</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* 会话名称 */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="name">会话名称</Label>
              <button
                onClick={() => setAutoName(!autoName)}
                className="text-xs text-purple-600 hover:text-purple-700"
              >
                {autoName ? '手动命名' : '自动命名'}
              </button>
            </div>
            <Input
              id="name"
              value={sessionName}
              onChange={(e) => {
                setSessionName(e.target.value)
                setAutoName(false)
              }}
              placeholder="例如：重构用户认证模块"
              disabled={autoName}
            />
          </div>
          
          {/* Worker状态提示 */}
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
            <Zap className="h-4 w-4 text-green-600" />
            <div className="flex-1">
              <p className="text-sm text-green-900">系统将自动分配闲置Worker</p>
              <p className="text-xs text-green-700 mt-0.5">
                当前有 3 个可用Worker
              </p>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loading || repositories.length === 0 || !sessionName.trim()}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                立即开始
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}