import { useState } from 'react'
import { Plus, MessageSquare, Clock, Search, MoreVertical, Edit2 } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { cn } from '@/lib/utils'
import { useSessionStore } from '../store/session.store'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface Session {
  id: string
  name: string
  repositoryName: string
  aiTool: string
  status: 'active' | 'paused' | 'completed' | 'archived'
  lastMessage?: string
  lastActivity: Date
  messageCount: number
}

interface SessionManagerProps {
  currentSessionId?: string
  onSessionSelect: (sessionId: string) => void
  onNewSession: () => void
}

export function SessionManager({ 
  currentSessionId, 
  onSessionSelect, 
  onNewSession 
}: SessionManagerProps) {
  const { sessions, deleteSession, renameSession } = useSessionStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null)
  const [newSessionName, setNewSessionName] = useState('')
  
  // 转换会话数据格式
  const formattedSessions = sessions.map(s => ({
    id: s.id,
    name: s.name,
    repositoryName: s.repositoryName,
    aiTool: s.aiTool,
    status: s.status,
    lastMessage: s.messages.length > 0 
      ? s.messages[s.messages.length - 1].content.substring(0, 50) + '...'
      : '暂无消息',
    lastActivity: s.metadata?.lastActivity || s.updatedAt,
    messageCount: s.messages.length
  }))
  
  const filteredSessions = formattedSessions.filter(session =>
    session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.repositoryName.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  // 按仓库分组会话
  const groupedSessions = filteredSessions.reduce((groups, session) => {
    const key = session.repositoryName || '未分组'
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(session)
    return groups
  }, {} as Record<string, Session[]>)
  
  // 按状态分类（保留原有逻辑作为备选视图）
  const activeSessions = filteredSessions.filter(s => s.status === 'active')
  const historySessions = filteredSessions.filter(s => s.status !== 'active')
  
  // 使用分组视图还是状态视图
  const [viewMode, setViewMode] = useState<'grouped' | 'status'>('grouped')
  
  const getAIToolIcon = (tool: string) => {
    const icons: Record<string, string> = {
      'claude-code': '🤖',
      'cursor': '🎯',
      'qucoder': '🚀'
    }
    return icons[tool] || '💬'
  }
  
  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'paused': return 'bg-yellow-500'
      case 'completed': return 'bg-gray-400'
      case 'archived': return 'bg-gray-600'
    }
  }
  
  const SessionItem = ({ session }: { session: Session }) => (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all",
        "hover:bg-accent/50",
        currentSessionId === session.id && "bg-accent"
      )}
      onClick={() => onSessionSelect(session.id)}
    >
      <div className="flex-shrink-0">
        <div className="text-xl">{getAIToolIcon(session.aiTool)}</div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {session.name}
          </span>
          <div className={cn("w-2 h-2 rounded-full", getStatusColor(session.status))} />
        </div>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{session.repositoryName}</span>
          <span>•</span>
          <span>{session.messageCount} 消息</span>
        </div>
        
        {session.lastMessage && (
          <p className="text-xs text-muted-foreground truncate mt-1">
            {session.lastMessage}
          </p>
        )}
        
        <div className="text-xs text-muted-foreground mt-1">
          {dayjs(session.lastActivity).fromNow()}
        </div>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setRenameSessionId(session.id)
              setNewSessionName(session.name)
              setRenameDialogOpen(true)
            }}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            重命名
          </DropdownMenuItem>
          <DropdownMenuItem>复制会话</DropdownMenuItem>
          <DropdownMenuItem>导出历史</DropdownMenuItem>
          <DropdownMenuItem 
            className="text-red-600"
            onClick={() => {
              if (confirm(`确定要删除会话 "${session.name}" 吗？`)) {
                deleteSession(session.id)
              }
            }}
          >删除</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
  
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            会话管理
          </h2>
          <Button
            size="sm"
            onClick={onNewSession}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            新建对话
          </Button>
        </div>
        
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索会话..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>
      
      {/* 视图切换按钮 */}
      <div className="px-4 pb-2">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <Button
            variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setViewMode('grouped')}
          >
            按仓库分组
          </Button>
          <Button
            variant={viewMode === 'status' ? 'secondary' : 'ghost'}
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setViewMode('status')}
          >
            按状态分类
          </Button>
        </div>
      </div>
      
      {/* 会话列表 */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {viewMode === 'grouped' ? (
            /* 按仓库分组视图 */
            Object.keys(groupedSessions).length > 0 ? (
              Object.entries(groupedSessions)
                .sort(([a], [b]) => {
                  // 未分组的放在最后
                  if (a === '未分组') return 1
                  if (b === '未分组') return -1
                  return a.localeCompare(b)
                })
                .map(([repositoryName, sessions]) => (
                  <div key={repositoryName}>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <span className="text-lg">📦</span>
                      {repositoryName} ({sessions.length})
                    </h3>
                    <div className="space-y-1 ml-6">
                      {sessions
                        .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
                        .map(session => (
                          <SessionItem key={session.id} session={session} />
                        ))}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? '没有找到匹配的会话' : '暂无会话'}
                </p>
                {!searchQuery && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={onNewSession}
                    className="mt-2"
                  >
                    创建第一个对话
                  </Button>
                )}
              </div>
            )
          ) : (
            /* 按状态分类视图（原有逻辑） */
            <>
              {/* 活跃会话 */}
              {activeSessions.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    活跃会话 ({activeSessions.length})
                  </h3>
                  <div className="space-y-1">
                    {activeSessions.map(session => (
                      <SessionItem key={session.id} session={session} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* 历史会话 */}
              {historySessions.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">
                    历史会话 ({historySessions.length})
                  </h3>
                  <div className="space-y-1">
                    {historySessions.map(session => (
                      <SessionItem key={session.id} session={session} />
                    ))}
                  </div>
                </div>
              )}
              
              {filteredSessions.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? '没有找到匹配的会话' : '暂无会话'}
                  </p>
                  {!searchQuery && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={onNewSession}
                      className="mt-2"
                    >
                      创建第一个对话
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
      
      {/* 重命名对话框 */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名会话</DialogTitle>
            <DialogDescription>
              为会话输入一个新的名称
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="会话名称"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && renameSessionId && newSessionName.trim()) {
                  renameSession(renameSessionId, newSessionName.trim())
                  setRenameDialogOpen(false)
                  setRenameSessionId(null)
                  setNewSessionName('')
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameDialogOpen(false)
                setRenameSessionId(null)
                setNewSessionName('')
              }}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                if (renameSessionId && newSessionName.trim()) {
                  renameSession(renameSessionId, newSessionName.trim())
                  setRenameDialogOpen(false)
                  setRenameSessionId(null)
                  setNewSessionName('')
                }
              }}
              disabled={!newSessionName.trim()}
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}