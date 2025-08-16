import { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Settings,
  Code,
  Database,
  Zap,
  Check,
  AlertCircle,
  Loader2,
  FileText,
  Users,
  GitBranch
} from 'lucide-react'
import { AgentSelector } from './AgentSelector'
import { RepositorySelector } from './RepositorySelector'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Switch } from '../ui/switch'
import { Label } from '../ui/label'
import { cn } from '../../lib/utils'
import type { Repository } from '../../types/api.types'
import type { ConversationPreferences, AiToolType, ConversationConfig } from '../../types/conversation.types'

// ================================
// 类型定义
// ================================

interface ConversationCreateProps {
  onCreateConversation: (config: ConversationConfig) => void
  loading?: boolean
  disabled?: boolean
  className?: string
}

interface Agent {
  id: string
  name: string
  connectedAt: Date
  status: 'online' | 'offline'
}

// ================================
// 常量定义
// ================================

const WIZARD_STEPS = [
  { id: 'agent', title: 'Agent 选择', description: '选择要使用的 AI Agent' },
  { id: 'repository', title: '仓库选择', description: '选择代码仓库和分支' },
  { id: 'config', title: '配置设置', description: '配置 AI 工具和权限' },
  { id: 'confirm', title: '确认创建', description: '预览配置并创建对话' }
] as const

const AVAILABLE_TOOLS = [
  { id: 'Read', name: '文件读取', description: '读取代码文件内容', icon: FileText },
  { id: 'Edit', name: '文件编辑', description: '编辑和修改代码文件', icon: Code },
  { id: 'Write', name: '文件写入', description: '创建新文件', icon: Database },
  { id: 'Bash', name: '命令执行', description: '执行系统命令', icon: Zap },
  { id: 'MultiEdit', name: '批量编辑', description: '批量修改多个文件', icon: Settings },
  { id: 'Grep', name: '搜索查找', description: '搜索代码内容', icon: CheckCircle },
  { id: 'Glob', name: '文件匹配', description: '文件路径匹配', icon: GitBranch }
]

const DEFAULT_PREFERENCES: ConversationPreferences = {
  enableCodeHighlight: true,
  enableAutoSave: true,
  autoSaveInterval: 30,
  messageFormat: 'markdown',
  theme: 'system',
  fontSize: 'medium',
  enableSoundNotification: false
}

// ================================
// 主组件
// ================================

export function ConversationCreate({
  onCreateConversation,
  loading = false,
  disabled = false,
  className
}: ConversationCreateProps) {
  // 状态管理
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; agent: Agent } | null>(null)
  const [selectedRepository, setSelectedRepository] = useState<{ id: string; repository: Repository } | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [aiTool, setAiTool] = useState<AiToolType>('claude')
  const [toolPermissions, setToolPermissions] = useState<string[]>(['Read', 'Edit', 'Bash'])
  const [preferences, setPreferences] = useState<ConversationPreferences>(DEFAULT_PREFERENCES)
  const [conversationName, setConversationName] = useState('')

  // 计算步骤完成状态
  const stepCompleted = useMemo(() => ({
    agent: !!selectedAgent,
    repository: !!selectedRepository,
    config: aiTool && toolPermissions.length > 0,
    confirm: conversationName.trim().length > 0
  }), [selectedAgent, selectedRepository, aiTool, toolPermissions, conversationName])

  // 计算可以进入下一步
  const canProceed = useMemo(() => {
    const stepIds = WIZARD_STEPS.map(s => s.id)
    const currentStepId = stepIds[currentStep]
    return stepCompleted[currentStepId as keyof typeof stepCompleted]
  }, [currentStep, stepCompleted])

  // 自动生成对话名称
  const generateConversationName = () => {
    if (selectedAgent && selectedRepository) {
      const timestamp = new Date().toLocaleString('zh-CN', { 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      return `${selectedAgent.agent.name} × ${selectedRepository.repository.name} (${timestamp})`
    }
    return ''
  }

  // 处理工具权限变更
  const handleToolPermissionChange = (toolId: string, enabled: boolean) => {
    setToolPermissions(prev => 
      enabled 
        ? [...prev, toolId]
        : prev.filter(id => id !== toolId)
    )
  }

  // 处理步骤导航
  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1 && canProceed) {
      setCurrentStep(prev => prev + 1)
      
      // 自动生成对话名称
      if (currentStep === 1 && !conversationName) {
        const generatedName = generateConversationName()
        if (generatedName) {
          setConversationName(generatedName)
        }
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  // 处理创建对话
  const handleCreateConversation = () => {
    if (!selectedAgent || !selectedRepository) return

    const config: ConversationConfig = {
      agentId: selectedAgent.id,
      repositoryId: selectedRepository.id,
      branch: selectedBranch || selectedRepository.repository.branch,
      aiTool,
      toolPermissions,
      preferences
    }

    onCreateConversation(config)
  }

  // 渲染步骤指示器
  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8">
      {WIZARD_STEPS.map((step, index) => (
        <div key={step.id} className="flex items-center flex-1">
          <div className="flex items-center">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
              index < currentStep || stepCompleted[step.id as keyof typeof stepCompleted]
                ? 'bg-blue-500 text-white'
                : index === currentStep
                ? 'bg-blue-100 text-blue-600 border-2 border-blue-500'
                : 'bg-gray-100 text-gray-400'
            )}>
              {index < currentStep || stepCompleted[step.id as keyof typeof stepCompleted] ? (
                <Check className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            <div className="ml-3 hidden sm:block">
              <div className="text-sm font-medium text-gray-900">{step.title}</div>
              <div className="text-xs text-gray-500">{step.description}</div>
            </div>
          </div>
          {index < WIZARD_STEPS.length - 1 && (
            <div className={cn(
              'flex-1 h-px mx-4 transition-colors',
              index < currentStep ? 'bg-blue-500' : 'bg-gray-200'
            )} />
          )}
        </div>
      ))}
    </div>
  )

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Agent 选择
        return (
          <AgentSelector
            selectedAgentId={selectedAgent?.id}
            onSelect={(agentId, agent) => setSelectedAgent({ id: agentId, agent })}
            disabled={disabled}
          />
        )

      case 1: // Repository 选择
        return (
          <div className="space-y-4">
            <RepositorySelector
              selectedRepositoryId={selectedRepository?.id}
              onSelect={(repositoryId, repository) => {
                setSelectedRepository({ id: repositoryId, repository })
                setSelectedBranch(repository.branch || '')
              }}
              disabled={disabled}
            />
            
            {/* 分支选择 */}
            {selectedRepository?.repository.metadata?.lastTestResult?.details?.branches && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">分支选择</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="branch-select">选择分支</Label>
                    <select
                      id="branch-select"
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {selectedRepository.repository.metadata.lastTestResult.details.branches.map((branch: string) => (
                        <option key={branch} value={branch}>{branch}</option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )

      case 2: // 配置设置
        return (
          <div className="space-y-6">
            {/* AI 工具选择 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI 工具</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={aiTool} onValueChange={(value) => setAiTool(value as AiToolType)}>
                  <TabsList className="grid w-full grid-cols-1">
                    <TabsTrigger value="claude">Claude</TabsTrigger>
                  </TabsList>
                  <TabsContent value="claude" className="mt-4">
                    <div className="text-sm text-gray-600">
                      使用 Anthropic Claude AI 模型进行代码分析和生成
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* 工具权限配置 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">工具权限</CardTitle>
                <p className="text-sm text-gray-600">选择 AI 可以使用的工具</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {AVAILABLE_TOOLS.map(tool => {
                    const IconComponent = tool.icon
                    const isEnabled = toolPermissions.includes(tool.id)
                    
                    return (
                      <div
                        key={tool.id}
                        className={cn(
                          'p-3 border rounded-lg transition-colors cursor-pointer',
                          isEnabled
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                        onClick={() => handleToolPermissionChange(tool.id, !isEnabled)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <IconComponent className={cn(
                              'w-5 h-5',
                              isEnabled ? 'text-blue-600' : 'text-gray-500'
                            )} />
                            <div>
                              <div className="font-medium text-sm">{tool.name}</div>
                              <div className="text-xs text-gray-500">{tool.description}</div>
                            </div>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => handleToolPermissionChange(tool.id, checked)}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 对话偏好设置 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">对话偏好</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="code-highlight">代码高亮</Label>
                  <Switch
                    id="code-highlight"
                    checked={preferences.enableCodeHighlight}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => ({ ...prev, enableCodeHighlight: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-save">自动保存</Label>
                  <Switch
                    id="auto-save"
                    checked={preferences.enableAutoSave}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => ({ ...prev, enableAutoSave: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="sound-notification">声音通知</Label>
                  <Switch
                    id="sound-notification"
                    checked={preferences.enableSoundNotification}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => ({ ...prev, enableSoundNotification: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 3: // 确认创建
        return (
          <div className="space-y-6">
            {/* 对话名称 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">对话名称</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={conversationName}
                  onChange={(e) => setConversationName(e.target.value)}
                  placeholder="输入对话名称..."
                  className="w-full"
                />
              </CardContent>
            </Card>

            {/* 配置预览 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">配置预览</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">Agent</span>
                    </div>
                    <div className="pl-6 text-gray-600">
                      {selectedAgent?.agent.name || '未选择'}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <GitBranch className="w-4 h-4 text-green-500" />
                      <span className="font-medium">仓库</span>
                    </div>
                    <div className="pl-6 text-gray-600">
                      {selectedRepository?.repository.name || '未选择'}
                      {selectedBranch && ` (${selectedBranch})`}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Code className="w-4 h-4 text-purple-500" />
                      <span className="font-medium">AI 工具</span>
                    </div>
                    <div className="pl-6 text-gray-600">{aiTool}</div>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="w-4 h-4 text-orange-500" />
                      <span className="font-medium">工具权限</span>
                    </div>
                    <div className="pl-6 text-gray-600">
                      {toolPermissions.length} 个工具
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="text-sm text-gray-600">
                    <div className="font-medium mb-2">已启用的工具:</div>
                    <div className="flex flex-wrap gap-2">
                      {toolPermissions.map(toolId => (
                        <span
                          key={toolId}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                        >
                          {AVAILABLE_TOOLS.find(t => t.id === toolId)?.name || toolId}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className={cn('w-full max-w-4xl mx-auto', className)}>
      <CardHeader>
        <CardTitle className="text-xl">创建新对话</CardTitle>
        <p className="text-sm text-gray-600">通过向导配置 AI 对话环境</p>
      </CardHeader>
      
      <CardContent>
        {/* 步骤指示器 */}
        {renderStepIndicator()}
        
        {/* 步骤内容 */}
        <div className="min-h-96">
          {renderStepContent()}
        </div>
        
        {/* 导航按钮 */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0 || disabled}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            上一步
          </Button>
          
          <div className="flex items-center gap-2">
            {currentStep === WIZARD_STEPS.length - 1 ? (
              <Button
                onClick={handleCreateConversation}
                disabled={!canProceed || loading || disabled}
                loading={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                创建对话
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed || disabled}
                className="flex items-center gap-2"
              >
                下一步
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* 状态提示 */}
        {!canProceed && currentStep < WIZARD_STEPS.length - 1 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">
                请完成当前步骤的配置后继续
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}