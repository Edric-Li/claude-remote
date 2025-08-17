import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '../ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'
import { Loader2, Bot, Database, Zap, CheckCircle, AlertCircle, Plus } from 'lucide-react'
import { useAssistantStore, useAssistantOptions } from '../../store/assistant.store'
import type { CreateSessionDto } from '../../types/session.types'
import { cn } from '../../lib/utils'

// 表单验证schema
const createAssistantSchema = z.object({
  name: z.string()
    .min(1, '助手名称不能为空')
    .max(100, '助手名称不能超过100个字符')
    .regex(/^[a-zA-Z0-9\u4e00-\u9fa5\s\-_]+$/, '助手名称只能包含字母、数字、中文、空格、连字符和下划线'),
  description: z.string()
    .max(500, '描述不能超过500个字符')
    .optional(),
  repositoryId: z.string()
    .min(1, '请选择一个仓库'),
  agentId: z.string()
    .min(1, '请选择一个Agent'),
  aiTool: z.string()
    .min(1, '请选择AI工具')
})

type CreateAssistantForm = z.infer<typeof createAssistantSchema>

interface CreateAssistantDialogProps {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: (assistant: any) => void
}

export function CreateAssistantDialog({
  children,
  open,
  onOpenChange,
  onSuccess
}: CreateAssistantDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { agents, repositories, loadAgents, loadRepositories } = useAssistantOptions()
  const { createAssistant, isCreatingAssistant, error, clearError } = useAssistantStore()

  const form = useForm<CreateAssistantForm>({
    resolver: zodResolver(createAssistantSchema),
    defaultValues: {
      name: '',
      description: '',
      repositoryId: '',
      agentId: '',
      aiTool: 'claude' // 默认选择Claude
    }
  })

  // 受控组件支持
  const dialogOpen = open !== undefined ? open : isOpen
  const setDialogOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open)
    } else {
      setIsOpen(open)
    }
  }

  // 加载选项数据
  useEffect(() => {
    if (dialogOpen) {
      loadAgents()
      loadRepositories()
      clearError()
    }
  }, [dialogOpen]) // 移除函数依赖，避免无限重渲染

  // 重置表单when dialog closes
  useEffect(() => {
    if (!dialogOpen) {
      form.reset()
      clearError()
    }
  }, [dialogOpen]) // 移除函数依赖，避免无限重渲染

  const onSubmit = async (data: CreateAssistantForm) => {
    try {
      const createData: CreateSessionDto = {
        name: data.name,
        repositoryId: data.repositoryId,
        aiTool: data.aiTool,
        agentId: data.agentId,
        metadata: {
          outputLanguage: 'zh'
        }
      }
      
      const assistant = await createAssistant(createData)
      
      // 创建成功后的处理
      setDialogOpen(false)
      form.reset()
      
      if (onSuccess) {
        onSuccess(assistant)
      }
    } catch (error) {
      // 错误已经在store中处理了
      console.error('Create assistant failed:', error)
    }
  }

  const selectedAgent = agents.find(agent => agent.id === form.watch('agentId'))
  const selectedRepository = repositories.find(repo => repo.id === form.watch('repositoryId'))

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            创建新助手
          </DialogTitle>
          <DialogDescription>
            助手是Agent、仓库和AI工具的组合，提供持久的对话记忆和上下文。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">基本信息</h3>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>助手名称 *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="输入助手名称，如：前端开发助手"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      给你的助手起一个容易识别的名称
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述（可选）</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="描述这个助手的用途和特点..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      简要说明这个助手的功能和使用场景
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Agent选择 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                选择Agent
              </h3>

              <FormField
                control={form.control}
                name="agentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择一个可用的Agent" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agents.length === 0 ? (
                          <div className="p-2 text-center text-gray-500">
                            <AlertCircle className="w-4 h-4 mx-auto mb-1" />
                            没有可用的Agent
                          </div>
                        ) : (
                          agents.map(agent => (
                            <SelectItem key={agent.id} value={agent.id}>
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  agent.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                                )} />
                                <span>{agent.name}</span>
                                <Badge variant={agent.status === 'connected' ? 'default' : 'secondary'}>
                                  {agent.status === 'connected' ? '在线' : '离线'}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Agent负责执行AI任务和工具调用
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedAgent && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{selectedAgent.name}</p>
                        <p className="text-sm text-gray-500">{selectedAgent.description || 'Agent负责执行AI任务'}</p>
                      </div>
                      <Badge variant={selectedAgent.status === 'connected' ? 'default' : 'secondary'}>
                        {selectedAgent.status === 'connected' ? '在线' : '离线'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Repository选择 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Database className="w-4 h-4" />
                选择仓库
              </h3>

              <FormField
                control={form.control}
                name="repositoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>仓库 *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择一个仓库" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {repositories.length === 0 ? (
                          <div className="p-2 text-center text-gray-500">
                            <AlertCircle className="w-4 h-4 mx-auto mb-1" />
                            没有可用的仓库
                          </div>
                        ) : (
                          repositories.map(repo => (
                            <SelectItem key={repo.id} value={repo.id}>
                              <div className="flex items-center gap-2">
                                <span>{repo.name}</span>
                                <Badge variant="outline">{repo.type}</Badge>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      助手将在此仓库的上下文中工作
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedRepository && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{selectedRepository.name}</p>
                        <Badge variant="outline">{selectedRepository.type}</Badge>
                      </div>
                      <p className="text-sm text-gray-500">{selectedRepository.description || '代码仓库'}</p>
                      <p className="text-xs text-gray-400 truncate">{selectedRepository.url}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* AI工具选择 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Bot className="w-4 h-4" />
                AI工具
              </h3>

              <FormField
                control={form.control}
                name="aiTool"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI工具 *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择AI工具" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="claude">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span>Claude Code</span>
                            <Badge>推荐</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="qwen" disabled>
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-gray-400" />
                            <span>Qwen（即将支持）</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="cursor" disabled>
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-gray-400" />
                            <span>Cursor（即将支持）</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      目前只支持Claude Code，其他AI工具即将推出
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 错误显示 */}
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isCreatingAssistant}
              >
                取消
              </Button>
              <Button 
                type="submit" 
                disabled={isCreatingAssistant || !form.formState.isValid}
              >
                {isCreatingAssistant ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    创建助手
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}