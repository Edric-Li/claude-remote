import { useState } from 'react'
import { MoreHorizontal, MessageSquare, Edit3, Trash2, Calendar, Database, Zap } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui/alert-dialog'
import type { Assistant } from '../../types/session.types'
import { cn } from '../../lib/utils'

interface AssistantCardProps {
  assistant: Assistant
  selected?: boolean
  onSelect?: (assistant: Assistant) => void
  onEdit?: (assistant: Assistant) => void
  onDelete?: (assistant: Assistant) => void
  onChat?: (assistant: Assistant) => void
  className?: string
}

export function AssistantCard({
  assistant,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  onChat,
  className
}: AssistantCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(assistant)
    }
  }

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onChat) {
      onChat(assistant)
    }
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEdit) {
      onEdit(assistant)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteDialog(true)
  }

  const confirmDelete = () => {
    if (onDelete) {
      onDelete(assistant)
    }
    setShowDeleteDialog(false)
  }

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '从未活动'
    
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (minutes < 1) return '刚刚活动'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    return `${days}天前`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'archived':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '活跃'
      case 'paused':
        return '暂停'
      case 'archived':
        return '已归档'
      default:
        return status
    }
  }

  return (
    <>
      <Card 
        className={cn(
          'cursor-pointer transition-all duration-200 hover:shadow-md',
          selected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:border-gray-300',
          className
        )}
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* 头部 - 名称和操作 */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-lg">{assistant.avatar || '🤖'}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 truncate">{assistant.name}</h3>
                  <p className="text-sm text-gray-500 truncate">
                    {assistant.description || `基于${assistant.aiTool}的AI助手`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Badge className={cn('text-xs', getStatusColor(assistant.status))}>
                  {getStatusText(assistant.status)}
                </Badge>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={handleChatClick}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      开始对话
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleEditClick}>
                      <Edit3 className="mr-2 h-4 w-4" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleDeleteClick}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* 配置信息 */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1 text-gray-600">
                <Database className="w-3 h-3" />
                <span className="truncate">{assistant.repositoryName || '未知仓库'}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Zap className="w-3 h-3" />
                <span className="truncate">{assistant.agentName || '未知Agent'}</span>
              </div>
            </div>

            {/* 统计信息 */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span>{assistant.messageCount || 0} 条消息</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatTimeAgo(assistant.lastActivity)}</span>
              </div>
            </div>

            {/* 快速操作按钮 */}
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 h-8 text-xs"
                onClick={handleChatClick}
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                对话
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 px-2"
                onClick={handleEditClick}
              >
                <Edit3 className="w-3 h-3" />
              </Button>
            </div>

            {/* Agent状态指示器 */}
            {assistant.agentStatus && (
              <div className="flex items-center gap-1 text-xs">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  assistant.agentStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                )} />
                <span className="text-gray-500">
                  Agent {assistant.agentStatus === 'connected' ? '在线' : '离线'}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除助手</AlertDialogTitle>
            <AlertDialogDescription>
              你确定要删除助手 "{assistant.name}" 吗？
              <br />
              <strong>此操作将永久删除所有对话历史，且无法恢复。</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}