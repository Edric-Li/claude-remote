import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, MessageSquare, Users, User, Bot } from 'lucide-react'
import { useStore } from '../store/index.ts'
import dayjs from 'dayjs'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card.tsx'
import { Button } from './ui/button.tsx'
import { Input } from './ui/input.tsx'
import { ScrollArea } from './ui/scroll-area.tsx'
import { cn } from '@/lib/utils.ts'

interface ChatPanelProps {
  selectedTool?: 'claude' | 'qwcoder' | null
}

export function ChatPanel({ selectedTool }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  
  const { messages, selectedAgentId, agents, sendMessage, connected, connectionInitialized } = useStore()
  
  const selectedAgent = agents.find(a => a.id === selectedAgentId)
  
  const filteredMessages = selectedAgentId 
    ? messages.filter(m => {
        // Show messages that:
        // 1. Are from this specific agent
        // 2. Are from web TO this specific agent
        // 3. Are from web to ALL (no agentId)
        if (m.from === 'agent') {
          return m.agentId === selectedAgentId
        } else {
          return !m.agentId || m.agentId === selectedAgentId
        }
      })
    : messages
  
  const handleSend = (): void => {
    if (inputValue.trim()) {
      sendMessage(inputValue, selectedTool || undefined)
      setInputValue('')
    }
  }
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filteredMessages])
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          {selectedTool ? (
            <>
              <Bot className="h-5 w-5" />
              {selectedTool === 'claude' ? 'Claude 对话' : 'QwCoder 对话'}
              {selectedAgent && <span className="text-sm text-muted-foreground ml-2">({selectedAgent.name})</span>}
            </>
          ) : selectedAgent ? (
            <>
              <MessageSquare className="h-5 w-5" />
              Chat with {selectedAgent.name}
            </>
          ) : (
            <>
              <Users className="h-5 w-5" />
              Chat with All Agents
            </>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4 p-0 px-6 min-h-0">
        <ScrollArea className="flex-1 pr-4 min-h-0" ref={scrollAreaRef}>
          <div className="space-y-4 pb-4">
            {filteredMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No messages yet</p>
                <p className="text-sm">Start a conversation!</p>
              </div>
            ) : (
              filteredMessages.map((message) => {
                const agent = agents.find(a => a.id === message.agentId)
                const isFromWeb = message.from === 'web'
                
                return (
                  <div 
                    key={message.id} 
                    className={cn(
                      'flex gap-3',
                      isFromWeb && 'justify-end'
                    )}
                  >
                    {!isFromWeb && (
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'px-4 py-3 rounded-lg max-w-[70%] space-y-2',
                        isFromWeb 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-sm">
                          {isFromWeb ? 'You' : agent?.name || 'Agent'}
                        </span>
                        <span className={cn(
                          "text-xs",
                          isFromWeb ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {dayjs(message.timestamp).format('HH:mm:ss')}
                        </span>
                      </div>
                      <div className="break-words">
                        <div className={cn(
                          "prose prose-sm max-w-none",
                          isFromWeb ? "prose-invert" : "dark:prose-invert",
                          "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                        )}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                    {isFromWeb && (
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
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
              !connectionInitialized ? "Connecting..." :
              !connected ? "Not connected to server" :
              "Type a message..."
            }
            disabled={!connected || !connectionInitialized}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!connected || !inputValue.trim() || !connectionInitialized}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {connectionInitialized && !connected && (
          <div className="text-sm text-destructive mb-4">
            Not connected to server. Please check the connection.
          </div>
        )}
      </CardContent>
    </Card>
  )
}