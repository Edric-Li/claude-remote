import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Play, Square, Send, User, Bot, Wrench, CheckCircle, BarChart, Globe } from 'lucide-react'
import { useStore } from '../store/index.ts'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card.tsx'
import { Button } from './ui/button.tsx'
import { Input } from './ui/input.tsx'
import { ScrollArea } from './ui/scroll-area.tsx'
import { Badge } from './ui/badge.tsx'
import { cn } from '@/lib/utils.ts'

export function ClaudePanel() {
  const [input, setInput] = useState('')
  const [initialPrompt, setInitialPrompt] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  
  const { 
    agents, 
    selectedAgentId, 
    claudeOutput, 
    currentTaskId,
    startClaude, 
    sendClaudeInput,
    stopClaude 
  } = useStore()
  
  // const selectedAgent = agents.find(a => a.id === selectedAgentId)
  
  const handleStart = (): void => {
    if (!selectedAgentId) {
      alert('Please select an agent first')
      return
    }
    
    startClaude(selectedAgentId, undefined, initialPrompt || undefined)
    setIsRunning(true)
    setInitialPrompt('')
  }
  
  const handleStop = (): void => {
    if (currentTaskId) {
      stopClaude(selectedAgentId!, currentTaskId)
      setIsRunning(false)
    }
  }
  
  const handleSendInput = (): void => {
    if (input.trim() && currentTaskId) {
      useStore.setState((state) => ({
        claudeOutput: [...state.claudeOutput, {
          type: 'user' as const,
          content: input,
          timestamp: new Date()
        }]
      }))
      
      sendClaudeInput(selectedAgentId!, currentTaskId, input)
      setInput('')
    }
  }
  
  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [claudeOutput])
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle>Claude Code Control</CardTitle>
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              className="flex h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedAgentId || ''}
              onChange={(e) => useStore.setState({ selectedAgentId: e.target.value || null })}
            >
              <option value="">Select an agent</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            
            {!isRunning ? (
              <Button
                onClick={handleStart}
                disabled={!selectedAgentId}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Start Claude
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleStop}
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                Stop Claude
              </Button>
            )}
          </div>
          
          {!isRunning && (
            <Input
              placeholder="Initial prompt (leave empty for default greeting)"
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleStart()}
              disabled={!selectedAgentId}
            />
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4 p-0 px-6 min-h-0">
        <ScrollArea className="flex-1 pr-4 min-h-0" ref={scrollAreaRef}>
          <div className="space-y-4 pb-4">
            {claudeOutput.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                Claude output will appear here...
              </div>
            ) : (
              claudeOutput.map((item, index) => {
                if (typeof item === 'string') {
                  return (
                    <MessageBubble key={index} type="assistant">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{item}</ReactMarkdown>
                    </MessageBubble>
                  )
                }
                
                const { type, content, details, stats, usage } = item
                
                if (type === 'user') {
                  return (
                    <MessageBubble key={index} type="user">
                      {content}
                    </MessageBubble>
                  )
                } else if (type === 'assistant') {
                  return (
                    <MessageBubble key={index} type="assistant">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {content}
                        </ReactMarkdown>
                      </div>
                      {usage && (
                        <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">
                            {usage.input_tokens} in
                          </Badge>
                          <Badge variant="secondary">
                            {usage.output_tokens} out
                          </Badge>
                        </div>
                      )}
                    </MessageBubble>
                  )
                } else if (type === 'tool') {
                  return (
                    <ToolMessage key={index} icon={<Wrench />} title={content}>
                      {details && (
                        <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                          {JSON.stringify(details, null, 2).substring(0, 200)}...
                        </pre>
                      )}
                    </ToolMessage>
                  )
                } else if (type === 'tool-result') {
                  return (
                    <ToolMessage key={index} icon={<CheckCircle />} title="Tool Result">
                      <div className="text-sm text-muted-foreground">{content}</div>
                    </ToolMessage>
                  )
                } else if (type === 'result') {
                  return (
                    <ResultMessage key={index} content={content} stats={stats} />
                  )
                } else if (type === 'system') {
                  return (
                    <SystemMessage key={index} content={content} />
                  )
                }
                
                return null
              })
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        
        <div className="flex gap-2 pb-6">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendInput()
              }
            }}
            placeholder="Type input for Claude..."
            disabled={!isRunning}
            className="flex-1"
          />
          <Button
            onClick={handleSendInput}
            disabled={!isRunning || !input.trim()}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Message components
function MessageBubble({ 
  children, 
  type 
}: { 
  children: React.ReactNode
  type: 'user' | 'assistant' 
}) {
  const isUser = type === 'user'
  
  return (
    <div className={cn('flex gap-3', isUser && 'justify-end')}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'px-4 py-3 rounded-lg max-w-[80%]',
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted'
        )}
      >
        {children}
      </div>
      {isUser && (
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  )
}

function ToolMessage({ 
  icon, 
  title, 
  children 
}: { 
  icon: React.ReactNode
  title: string
  children?: React.ReactNode 
}) {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-medium text-sm">{title}</div>
        {children}
      </div>
    </div>
  )
}

function ResultMessage({ 
  content, 
  stats 
}: { 
  content: string
  stats?: any 
}) {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
        <BarChart className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="font-medium text-sm">{content}</div>
        {stats && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Turns: {stats.turns}</span>
            <span>Tokens: {stats.totalTokens}</span>
            <span>Cost: ${stats.cost.toFixed(6)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function SystemMessage({ content }: { content: string }) {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-border flex items-center justify-center flex-shrink-0">
        <Globe className="h-4 w-4" />
      </div>
      <div className="text-sm text-muted-foreground">{content}</div>
    </div>
  )
}