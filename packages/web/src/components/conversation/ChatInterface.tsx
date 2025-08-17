/*
 * ChatInterface.tsx - Chat Component with Session Protection Integration
 * 
 * SESSION PROTECTION INTEGRATION:
 * ===============================
 * 
 * This component integrates with the Session Protection System to prevent project updates
 * from interrupting active conversations:
 * 
 * Key Integration Points:
 * 1. handleSubmit() - Marks session as active when user sends message (including temp ID for new sessions)
 * 2. session-created handler - Replaces temporary session ID with real WebSocket session ID  
 * 3. claude-complete handler - Marks session as inactive when conversation finishes
 * 4. session-aborted handler - Marks session as inactive when conversation is aborted
 * 
 * This ensures uninterrupted chat experience by coordinating with App.jsx to pause sidebar updates.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  Settings,
  ChevronDown,
  Check,
  X,
  Send,
  Image as ImageIcon,
  AlertTriangle,
  ArrowDown,
  FileText,
  Edit3,
  XCircle,
  Clock,
  Mic,
  Eye,
  Download
} from 'lucide-react'

import type {
  MessageType
} from '@/types/conversation.types'
import { useWebSocketCommunicationStore } from '@/store/websocket-communication.store'
import { webSocketClient } from '@/lib/websocket-client'
import { useConversation } from '@/hooks/useConversation'

// Safe localStorage utility to handle quota exceeded errors
const safeLocalStorage = {
  setItem: (key: string, value: string) => {
    try {
      // For chat messages, implement compression and size limits
      if (key.startsWith('chat_messages_') && typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          // Limit to last 50 messages to prevent storage bloat
          if (Array.isArray(parsed) && parsed.length > 50) {
            console.warn(`Truncating chat history for ${key} from ${parsed.length} to 50 messages`)
            const truncated = parsed.slice(-50)
            value = JSON.stringify(truncated)
          }
        } catch (parseError) {
          console.warn('Could not parse chat messages for truncation:', parseError)
        }
      }
      
      localStorage.setItem(key, value)
    } catch (error: any) {
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old data')
        // Clear old chat messages to free up space
        const keys = Object.keys(localStorage)
        const chatKeys = keys.filter(k => k.startsWith('chat_messages_')).sort()
        
        // Remove oldest chat data first, keeping only the 3 most recent projects
        if (chatKeys.length > 3) {
          chatKeys.slice(0, chatKeys.length - 3).forEach(k => {
            localStorage.removeItem(k)
            console.log(`Removed old chat data: ${k}`)
          })
        }
        
        // If still failing, clear draft inputs too
        const draftKeys = keys.filter(k => k.startsWith('draft_input_'))
        draftKeys.forEach(k => {
          localStorage.removeItem(k)
        })
        
        // Try again with reduced data
        try {
          localStorage.setItem(key, value)
        } catch (retryError) {
          console.error('Failed to save to localStorage even after cleanup:', retryError)
          // Last resort: Try to save just the last 10 messages
          if (key.startsWith('chat_messages_') && typeof value === 'string') {
            try {
              const parsed = JSON.parse(value)
              if (Array.isArray(parsed) && parsed.length > 10) {
                const minimal = parsed.slice(-10)
                localStorage.setItem(key, JSON.stringify(minimal))
                console.warn('Saved only last 10 messages due to quota constraints')
              }
            } catch (finalError) {
              console.error('Final save attempt failed:', finalError)
            }
          }
        }
      } else {
        console.error('localStorage error:', error)
      }
    }
  },
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.error('localStorage getItem error:', error)
      return null
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error('localStorage removeItem error:', error)
    }
  }
}

// Enhanced message interface for chat display
interface ChatMessage {
  type: MessageType | 'error'
  content: string
  timestamp: Date
  isToolUse?: boolean
  toolName?: string
  toolInput?: string
  toolId?: string
  toolResult?: {
    content: string
    isError: boolean
    timestamp: Date
  }
  isInteractivePrompt?: boolean
  images?: Array<{
    name: string
    data: string
  }>
}

// Project interface is not used in this component

// File reference interface
interface FileReference {
  name: string
  path: string
  relativePath: string
}

// Image attachment component props
interface ImageAttachmentProps {
  file: File
  onRemove: () => void
  uploadProgress?: number
  error?: string
}

// Main component props
interface ChatInterfaceProps {
  conversationId: string
  agentId: string
  repositoryId: string
  onClose?: () => void
  className?: string
}

// Claude Logo component placeholder
const ClaudeLogo: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("w-6 h-6 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center", className)}>
    <span className="text-white text-xs font-bold">C</span>
  </div>
)

// Claude Status component placeholder
const ClaudeStatus: React.FC<{
  status: { text: string; tokens: number; can_interrupt: boolean } | null
  isLoading: boolean
  onAbort: () => void
}> = ({ status, isLoading, onAbort }) => {
  if (!status || !isLoading) return null

  return (
    <Card className="mb-3 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm text-blue-700 dark:text-blue-300">{status.text}</span>
            {status.tokens > 0 && (
              <Badge variant="outline" className="text-xs">
                {status.tokens} tokens
              </Badge>
            )}
          </div>
          {status.can_interrupt && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAbort}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <X className="w-3 h-3 mr-1" />
              Stop
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// TodoList component placeholder
const TodoList: React.FC<{
  todos: Array<{ id: string; content: string; status: 'pending' | 'in_progress' | 'completed' }>
  isResult?: boolean
}> = ({ todos }) => (
  <div className="space-y-2">
    {todos.map((todo) => (
      <div key={todo.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
        <div className={cn(
          "w-4 h-4 rounded border-2 flex items-center justify-center",
          todo.status === 'completed' && "bg-green-500 border-green-500",
          todo.status === 'in_progress' && "bg-yellow-500 border-yellow-500",
          todo.status === 'pending' && "border-gray-300"
        )}>
          {todo.status === 'completed' && <Check className="w-2 h-2 text-white" />}
          {todo.status === 'in_progress' && <Clock className="w-2 h-2 text-white" />}
        </div>
        <span className="text-sm">{todo.content}</span>
      </div>
    ))}
  </div>
)

// MicButton component placeholder
const MicButton: React.FC<{
  onTranscript: (text: string) => void
  className?: string
}> = ({ onTranscript, className }) => (
  <Button
    variant="outline"
    size="icon"
    className={className}
    onClick={() => onTranscript("Voice input not implemented")}
  >
    <Mic className="w-4 h-4" />
  </Button>
)

// ImageAttachment component for displaying image previews
const ImageAttachment: React.FC<ImageAttachmentProps> = ({ file, onRemove, uploadProgress, error }) => {
  const [preview, setPreview] = useState<string | null>(null)
  
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  
  return (
    <div className="relative group">
      {preview && (
        <img src={preview} alt={file.name} className="w-20 h-20 object-cover rounded" />
      )}
      {uploadProgress !== undefined && uploadProgress < 100 && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="text-white text-xs">{uploadProgress}%</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
          <XCircle className="w-6 h-6 text-white" />
        </div>
      )}
      <Button
        variant="destructive"
        size="icon"
        onClick={onRemove}
        className="absolute -top-2 -right-2 w-6 h-6 opacity-0 group-hover:opacity-100"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  )
}

// Memoized message component to prevent unnecessary re-renders
const MessageComponent = memo<{
  message: ChatMessage
  index: number
  prevMessage: ChatMessage | null
  createDiff: (oldStr: string, newStr: string) => Array<{ type: 'added' | 'removed'; content: string; lineNum: number }>
  autoExpandTools?: boolean
  showRawParameters?: boolean
}>(({ message, prevMessage, createDiff, autoExpandTools, showRawParameters }) => {
  const isGrouped = prevMessage && prevMessage.type === message.type && 
                   prevMessage.type === 'assistant' && 
                   !prevMessage.isToolUse && !message.isToolUse
  const messageRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (!autoExpandTools || !messageRef.current || !message.isToolUse) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isExpanded) {
            setIsExpanded(true)
            // Find all details elements and open them
            const details = messageRef.current?.querySelectorAll('details')
            details?.forEach(detail => {
              detail.open = true
            })
          }
        })
      },
      { threshold: 0.1 }
    )
    
    observer.observe(messageRef.current)
    
    return () => {
      if (messageRef.current) {
        observer.unobserve(messageRef.current)
      }
    }
  }, [autoExpandTools, isExpanded, message.isToolUse])

  return (
    <div
      ref={messageRef}
      className={cn(
        "chat-message",
        message.type,
        isGrouped ? 'grouped' : '',
        message.type === 'user' ? 'flex justify-end px-3 sm:px-0' : 'px-3 sm:px-0'
      )}
    >
      {message.type === 'user' ? (
        /* User message bubble on the right */
        <div className="flex items-end space-x-0 sm:space-x-3 w-full sm:w-auto sm:max-w-[85%] md:max-w-md lg:max-w-lg xl:max-w-xl">
          <Card className="bg-blue-600 text-white border-none shadow-sm flex-1 sm:flex-initial">
            <CardContent className="px-3 sm:px-4 py-2">
              <div className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </div>
              {message.images && message.images.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {message.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img.data}
                      alt={img.name}
                      className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(img.data, '_blank')}
                    />
                  ))}
                </div>
              )}
              <div className="text-xs text-blue-100 mt-1 text-right">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </CardContent>
          </Card>
          {!isGrouped && (
            <div className="hidden sm:flex w-8 h-8 bg-blue-600 rounded-full items-center justify-center text-white text-sm flex-shrink-0">
              U
            </div>
          )}
        </div>
      ) : (
        /* Claude/Error messages on the left */
        <div className="w-full">
          {!isGrouped && (
            <div className="flex items-center space-x-3 mb-2">
              {message.type === 'error' ? (
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0 p-1">
                  <ClaudeLogo className="w-full h-full" />
                </div>
              )}
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {message.type === 'error' ? 'Error' : 'Claude'}
              </div>
            </div>
          )}
          
          <div className="w-full">
            {message.isToolUse && !['Read', 'TodoWrite', 'TodoRead'].includes(message.toolName || '') ? (
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-2">
                <CardContent className="p-2 sm:p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                        <Settings className="w-3 h-3 text-white" />
                      </div>
                      <span className="font-medium text-blue-900 dark:text-blue-100">
                        Using {message.toolName}
                      </span>
                      <Badge variant="outline" className="text-xs font-mono text-blue-600 dark:text-blue-400">
                        {message.toolId}
                      </Badge>
                    </div>
                  </div>

                  {/* Tool-specific displays would go here */}
                  {message.toolInput && message.toolName === 'Edit' && (() => {
                    try {
                      const input = JSON.parse(message.toolInput)
                      if (input.file_path && input.old_string && input.new_string) {
                        return (
                          <details className="mt-2" open={autoExpandTools}>
                            <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
                              <ChevronDown className="w-4 h-4 transition-transform details-chevron" />
                              📝 View edit diff for 
                              <span className="font-mono text-blue-600 dark:text-blue-400">
                                {input.file_path.split('/').pop()}
                              </span>
                            </summary>
                            <div className="mt-3">
                              <Card className="overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b">
                                  <span className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate">
                                    {input.file_path}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    Diff
                                  </Badge>
                                </div>
                                <div className="text-xs font-mono">
                                  {createDiff(input.old_string, input.new_string).map((diffLine, i) => (
                                    <div key={i} className="flex">
                                      <span className={cn(
                                        "w-8 text-center border-r",
                                        diffLine.type === 'removed' 
                                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                                          : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                                      )}>
                                        {diffLine.type === 'removed' ? '-' : '+'}
                                      </span>
                                      <span className={cn(
                                        "px-2 py-0.5 flex-1 whitespace-pre-wrap",
                                        diffLine.type === 'removed'
                                          ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                                          : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                                      )}>
                                        {diffLine.content}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </Card>
                              {showRawParameters && (
                                <details className="mt-2" open={autoExpandTools}>
                                  <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300">
                                    View raw parameters
                                  </summary>
                                  <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap break-words overflow-hidden text-blue-900 dark:text-blue-100">
                                    {message.toolInput}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </details>
                        )
                      }
                    } catch (e) {
                      // Fall back to raw display if parsing fails
                    }
                    return (
                      <details className="mt-2" open={autoExpandTools}>
                        <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200">
                          View input parameters
                        </summary>
                        <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap break-words overflow-hidden text-blue-900 dark:text-blue-100">
                          {message.toolInput}
                        </pre>
                      </details>
                    )
                  })()}

                  {/* Tool Result Section */}
                  {message.toolResult && (
                    <div className="mt-3 border-t border-blue-200 dark:border-blue-700 pt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn(
                          "w-4 h-4 rounded flex items-center justify-center",
                          message.toolResult.isError ? 'bg-red-500' : 'bg-green-500'
                        )}>
                          {message.toolResult.isError ? (
                            <X className="w-3 h-3 text-white" />
                          ) : (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className={cn(
                          "text-sm font-medium",
                          message.toolResult.isError 
                            ? 'text-red-700 dark:text-red-300' 
                            : 'text-green-700 dark:text-green-300'
                        )}>
                          {message.toolResult.isError ? 'Tool Error' : 'Tool Result'}
                        </span>
                      </div>
                      
                      <div className={cn(
                        "text-sm prose prose-sm max-w-none",
                        message.toolResult.isError 
                          ? 'text-red-800 dark:text-red-200' 
                          : 'text-green-800 dark:text-green-200'
                      )}>
                        <ReactMarkdown>{String(message.toolResult.content || '')}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : message.isInteractivePrompt ? (
              // Special handling for interactive prompts
              <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-base mb-3">
                        Interactive Prompt
                      </h4>
                      <div className="prose prose-sm max-w-none text-amber-800 dark:text-amber-200">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                      <Card className="bg-amber-100 dark:bg-amber-800/30 mt-3">
                        <CardContent className="p-3">
                          <p className="text-amber-900 dark:text-amber-100 text-sm font-medium mb-1">
                            ⏳ Waiting for your response in the CLI
                          </p>
                          <p className="text-amber-800 dark:text-amber-200 text-xs">
                            Please select an option in your terminal where Claude is running.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : message.isToolUse && message.toolName === 'Read' ? (
              // Simple Read tool indicator
              (() => {
                try {
                  const input = JSON.parse(message.toolInput || '{}')
                  if (input.file_path) {
                    const filename = input.file_path.split('/').pop()
                    return (
                      <Card className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-300 dark:border-blue-600 mb-2">
                        <CardContent className="pl-3 py-1">
                          <div className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Read{' '}
                            <span className="text-blue-600 dark:text-blue-400 font-mono">
                              {filename}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  }
                } catch (e) {
                  return (
                    <Card className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-300 dark:border-blue-600 mb-2">
                      <CardContent className="pl-3 py-1">
                        <div className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Read file
                        </div>
                      </CardContent>
                    </Card>
                  )
                }
                return null
              })()
            ) : message.isToolUse && message.toolName === 'TodoWrite' ? (
              // Simple TodoWrite tool indicator with tasks
              (() => {
                try {
                  const input = JSON.parse(message.toolInput || '{}')
                  if (input.todos && Array.isArray(input.todos)) {
                    return (
                      <Card className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-300 dark:border-blue-600 mb-2">
                        <CardContent className="pl-3 py-1">
                          <div className="text-sm text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                            <Edit3 className="w-4 h-4" />
                            Update todo list
                          </div>
                          <TodoList todos={input.todos} />
                        </CardContent>
                      </Card>
                    )
                  }
                } catch (e) {
                  return (
                    <Card className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-300 dark:border-blue-600 mb-2">
                      <CardContent className="pl-3 py-1">
                        <div className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                          <Edit3 className="w-4 h-4" />
                          Update todo list
                        </div>
                      </CardContent>
                    </Card>
                  )
                }
                return null
              })()
            ) : message.isToolUse && message.toolName === 'TodoRead' ? (
              // Simple TodoRead tool indicator
              <Card className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-300 dark:border-blue-600 mb-2">
                <CardContent className="pl-3 py-1">
                  <div className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Read todo list
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {message.type === 'assistant' ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-gray">
                    <ReactMarkdown
                      components={{
                        code: ({node, className, children, ...props}) => {
                          const isInline = !className || !className.includes('language-')
                          return isInline ? (
                            <code className="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded text-sm" {...props}>
                              {children}
                            </code>
                          ) : (
                            <Card className="bg-gray-100 dark:bg-gray-800 my-2">
                              <CardContent className="p-3">
                                <code className="text-gray-800 dark:text-gray-200 text-sm font-mono block whitespace-pre-wrap break-words" {...props}>
                                  {children}
                                </code>
                              </CardContent>
                            </Card>
                          )
                        },
                        blockquote: ({children}) => (
                          <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-2">
                            {children}
                          </blockquote>
                        ),
                        a: ({href, children}) => (
                          <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                            {children}
                          </a>
                        ),
                        p: ({children}) => (
                          <div className="mb-2 last:mb-0">
                            {children}
                          </div>
                        )
                      }}
                    >
                      {String(message.content || '')}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">
                    {message.content}
                  </div>
                )}
              </div>
            )}
            
            <div className={cn(
              "text-xs text-gray-500 dark:text-gray-400 mt-1",
              isGrouped ? 'opacity-0 group-hover:opacity-100' : ''
            )}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

MessageComponent.displayName = 'MessageComponent'

// Main ChatInterface component
function ChatInterface({
  conversationId,
  agentId,
  repositoryId,
  onClose,
  className
}: ChatInterfaceProps) {
  // Use conversation hook for WebSocket communication
  const {
    loading: conversationLoading,
    error: conversationError,
    connected,
    sendMessage: sendConversationMessage,
    stopConversation
  } = useConversation({
    conversationId,
    agentId,
    repositoryId,
    autoCreate: true
  })

  // WebSocket communication store for connection state
  const {
    connecting,
    error: wsError,
    updateConversationState
  } = useWebSocketCommunicationStore()
  
  // UI settings - could be moved to props or settings store
  const autoExpandTools = false
  const showRawParameters = false
  const sendByCtrlEnter = false
  const [input, setInput] = useState(() => {
    if (typeof window !== 'undefined' && repositoryId) {
      return safeLocalStorage.getItem(`draft_input_${repositoryId}`) || ''
    }
    return ''
  })

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined' && repositoryId) {
      const saved = safeLocalStorage.getItem(`chat_messages_${repositoryId}`)
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  const [isLoading, setIsLoading] = useState(false)
  const [currentSessionId] = useState(conversationId)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isLoadingSessionMessages, setIsLoadingSessionMessages] = useState(false)
  const [permissionMode, setPermissionMode] = useState<'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'>('default')
  const [attachedImages, setAttachedImages] = useState<File[]>([])
  const [uploadingImages, setUploadingImages] = useState(new Map<string, number>())
  const [imageErrors, setImageErrors] = useState(new Map<string, string>())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showFileDropdown, setShowFileDropdown] = useState(false)
  const [filteredFiles] = useState<FileReference[]>([])
  const [selectedFileIndex, setSelectedFileIndex] = useState(-1)
  const [atSymbolPosition, setAtSymbolPosition] = useState(-1)
  const [canAbortSession, setCanAbortSession] = useState(false)
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)
  const [isTextareaExpanded, setIsTextareaExpanded] = useState(false)
  const [visibleMessageCount, setVisibleMessageCount] = useState(100)
  const [claudeStatus, setClaudeStatus] = useState<{ text: string; tokens: number; can_interrupt: boolean } | null>(null)

  // WebSocket event handlers
  useEffect(() => {
    if (!connected) return

    // Handle Claude responses (new approach)
    const handleClaudeResponse = (data: any) => {
      console.log('收到Claude响应:', data)
      
      // Handle wrapped WebSocket event format: {type: 'claude-response', data: actualData}
      const actualData = data.data || data
      
      // Handle different Claude response types
      if (actualData.type === 'assistant' && actualData.message?.content) {
        // Claude assistant message
        const content = actualData.message.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('')
        
        setChatMessages(prev => [...prev, {
          type: 'assistant',
          content: content,
          timestamp: new Date()
        }])
        
        setIsLoading(false)
        setCanAbortSession(false)
        setClaudeStatus(null)
      } else if (actualData.type === 'tool_use' && actualData.toolName) {
        // Tool use message
        setChatMessages(prev => [...prev, {
          type: 'assistant',
          content: '',
          timestamp: new Date(),
          isToolUse: true,
          toolName: actualData.toolName,
          toolInput: JSON.stringify(actualData.input || {}),
          toolId: actualData.toolId || '',
        }])
      } else if (actualData.type === 'tool_result' && actualData.toolId) {
        // Tool result - update the corresponding tool use message
        setChatMessages(prev => prev.map(msg => 
          msg.isToolUse && msg.toolId === actualData.toolId 
            ? {
                ...msg,
                toolResult: {
                  content: actualData.content || '',
                  isError: actualData.isError || false,
                  timestamp: new Date()
                }
              }
            : msg
        ))
      } else if (actualData.type === 'claude-error') {
        // Claude error
        setChatMessages(prev => [...prev, {
          type: 'error',
          content: `Claude Error: ${actualData.error}`,
          timestamp: new Date()
        }])
        
        setIsLoading(false)
        setCanAbortSession(false)
        setClaudeStatus(null)
      } else if (actualData.type === 'session-aborted') {
        // Session aborted
        setIsLoading(false)
        setCanAbortSession(false)
        setClaudeStatus(null)
      }
    }

    // Handle worker messages (fallback for old worker approach)
    const handleWorkerMessage = (data: any) => {
      console.log('收到Worker消息:', data)
      
      if (data.conversationId === conversationId || data.taskId === conversationId) {
        if (data.type === 'output') {
          // Add Claude's response to chat messages
          setChatMessages(prev => [...prev, {
            type: 'assistant',
            content: data.content || data.output,
            timestamp: new Date(data.timestamp || Date.now())
          }])
        } else if (data.type === 'status') {
          // Update Claude status
          if (data.status === 'completed' || data.status === 'stopped' || data.status === 'error') {
            setIsLoading(false)
            setCanAbortSession(false)
            setClaudeStatus(null)
          } else if (data.status === 'running') {
            setClaudeStatus({
              text: data.message || 'Processing...',
              tokens: data.tokens || 0,
              can_interrupt: true
            })
          }
        } else if (data.type === 'tool_use') {
          // Handle tool usage
          setChatMessages(prev => [...prev, {
            type: 'assistant',
            content: data.content || '',
            timestamp: new Date(data.timestamp || Date.now()),
            isToolUse: true,
            toolName: data.toolName,
            toolInput: JSON.stringify(data.toolInput || {}),
            toolId: data.toolId,
            toolResult: data.toolResult ? {
              content: data.toolResult.content || '',
              isError: data.toolResult.isError || false,
              timestamp: new Date(data.toolResult.timestamp || Date.now())
            } : undefined
          }])
        }
      }
    }

    // Handle conversation state updates
    const handleConversationStateUpdated = (data: any) => {
      console.log('对话状态更新:', data)
      if (data.sessionId === conversationId) {
        // Update conversation state in store
        updateConversationState(conversationId, {
          status: data.status || 'active',
          messageCount: (data.messageCount || 0) + 1
        })
        
        // Save messages to localStorage
        if (repositoryId) {
          safeLocalStorage.setItem(`chat_messages_${repositoryId}`, JSON.stringify(chatMessages))
        }
      }
    }

    // Handle conversation update failures
    const handleConversationUpdateFailed = (error: string) => {
      console.error('对话状态更新失败:', error)
      setChatMessages(prev => [...prev, {
        type: 'error',
        content: `Conversation update failed: ${error}`,
        timestamp: new Date()
      }])
    }

    // Register event listeners
    webSocketClient.on('claude:response', handleClaudeResponse)
    webSocketClient.on('worker:message', handleWorkerMessage)
    webSocketClient.on('worker:output', handleWorkerMessage)
    webSocketClient.on('worker:status', handleWorkerMessage)
    webSocketClient.on('conversation_state_updated', handleConversationStateUpdated)
    webSocketClient.on('conversation_update_failed', handleConversationUpdateFailed)

    // Cleanup event listeners
    return () => {
      webSocketClient.off('claude:response', handleClaudeResponse)
      webSocketClient.off('worker:message', handleWorkerMessage)
      webSocketClient.off('worker:output', handleWorkerMessage)
      webSocketClient.off('worker:status', handleWorkerMessage)
      webSocketClient.off('conversation_state_updated', handleConversationStateUpdated)
      webSocketClient.off('conversation_update_failed', handleConversationUpdateFailed)
    }
  }, [connected, conversationId, repositoryId, chatMessages])

  // Memoized diff calculation to prevent recalculating on every render
  const createDiff = useMemo(() => {
    const cache = new Map<string, Array<{ type: 'added' | 'removed'; content: string; lineNum: number }>>()
    return (oldStr: string, newStr: string) => {
      const key = `${oldStr.length}-${newStr.length}-${oldStr.slice(0, 50)}`
      if (cache.has(key)) {
        return cache.get(key)!
      }
      
      const result = calculateDiff(oldStr, newStr)
      cache.set(key, result)
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value
        if (firstKey) {
          cache.delete(firstKey)
        }
      }
      return result
    }
  }, [])

  // Actual diff calculation function
  const calculateDiff = (oldStr: string, newStr: string) => {
    const oldLines = oldStr.split('\n')
    const newLines = newStr.split('\n')
    
    // Simple diff algorithm - find common lines and differences
    const diffLines: Array<{ type: 'added' | 'removed'; content: string; lineNum: number }> = []
    let oldIndex = 0
    let newIndex = 0
    
    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      const oldLine = oldLines[oldIndex]
      const newLine = newLines[newIndex]
      
      if (oldIndex >= oldLines.length) {
        // Only new lines remaining
        diffLines.push({ type: 'added', content: newLine, lineNum: newIndex + 1 })
        newIndex++
      } else if (newIndex >= newLines.length) {
        // Only old lines remaining
        diffLines.push({ type: 'removed', content: oldLine, lineNum: oldIndex + 1 })
        oldIndex++
      } else if (oldLine === newLine) {
        // Lines are the same - skip in diff view (or show as context)
        oldIndex++
        newIndex++
      } else {
        // Lines are different
        diffLines.push({ type: 'removed', content: oldLine, lineNum: oldIndex + 1 })
        diffLines.push({ type: 'added', content: newLine, lineNum: newIndex + 1 })
        oldIndex++
        newIndex++
      }
    }
    
    return diffLines
  }

  // Define scroll functions early to avoid hoisting issues in useEffect dependencies
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
      setIsUserScrolledUp(false)
    }
  }, [])

  // Check if user is near the bottom of the scroll container
  const isNearBottom = useCallback(() => {
    if (!scrollContainerRef.current) return false
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    // Consider "near bottom" if within 50px of the bottom
    return scrollHeight - scrollTop - clientHeight < 50
  }, [])

  // Handle scroll events to detect when user manually scrolls up
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const nearBottom = isNearBottom()
      setIsUserScrolledUp(!nearBottom)
    }
  }, [isNearBottom])

  // Handle image files from drag & drop or file picker
  const handleImageFiles = useCallback((files: File[]) => {
    const validFiles = files.filter(file => {
      try {
        // Validate file object and properties
        if (!file || typeof file !== 'object') {
          console.warn('Invalid file object:', file)
          return false
        }

        if (!file.type || !file.type.startsWith('image/')) {
          return false
        }

        if (!file.size || file.size > 5 * 1024 * 1024) {
          // Safely get file name with fallback
          const fileName = file.name || 'Unknown file'
          setImageErrors(prev => {
            const newMap = new Map(prev)
            newMap.set(fileName, 'File too large (max 5MB)')
            return newMap
          })
          return false
        }

        return true
      } catch (error) {
        console.error('Error validating file:', error, file)
        return false
      }
    })

    if (validFiles.length > 0) {
      setAttachedImages(prev => [...prev, ...validFiles].slice(0, 5)) // Max 5 images
    }
  }, [])

  // Handle clipboard paste for images
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          handleImageFiles([file])
        }
      }
    }
    
    // Fallback for some browsers/platforms
    if (items.length === 0 && e.clipboardData.files.length > 0) {
      const files = Array.from(e.clipboardData.files)
      const imageFiles = files.filter(f => f.type.startsWith('image/'))
      if (imageFiles.length > 0) {
        handleImageFiles(imageFiles)
      }
    }
  }, [handleImageFiles])

  // Setup native drag and drop
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
    
    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (imageFiles.length > 0) {
      handleImageFiles(imageFiles)
    }
  }, [handleImageFiles])

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (imageFiles.length > 0) {
      handleImageFiles(imageFiles)
    }
    // Reset the input value so the same file can be selected again
    e.target.value = ''
  }, [handleImageFiles])

  const handleTranscript = useCallback((text: string) => {
    if (text.trim()) {
      setInput(prevInput => {
        const newInput = prevInput.trim() ? `${prevInput} ${text}` : text
        
        // Update textarea height after setting new content
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
            
            // Check if expanded after transcript
            const lineHeight = parseInt(window.getComputedStyle(textareaRef.current).lineHeight)
            const isExpanded = textareaRef.current.scrollHeight > lineHeight * 2
            setIsTextareaExpanded(isExpanded)
          }
        }, 0)
        
        return newInput
      })
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !agentId) return

    // Check connection status
    if (!connected) {
      setChatMessages(prev => [...prev, {
        type: 'error',
        content: 'WebSocket connection not established. Please wait for connection.',
        timestamp: new Date()
      }])
      return
    }


    // Upload images first if any
    let uploadedImages: Array<{ name: string; data: string }> = []
    if (attachedImages.length > 0) {
      const formData = new FormData()
      attachedImages.forEach(file => {
        formData.append('images', file)
      })
      
      try {
        const token = safeLocalStorage.getItem('auth-token')
        const headers: Record<string, string> = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        const response = await fetch(`/api/repositories/${repositoryId}/upload-images`, {
          method: 'POST',
          headers: headers,
          body: formData
        })
        
        if (!response.ok) {
          throw new Error('Failed to upload images')
        }
        
        const result = await response.json()
        uploadedImages = result.images
      } catch (error: any) {
        console.error('Image upload failed:', error)
        setChatMessages(prev => [...prev, {
          type: 'error',
          content: `Failed to upload images: ${error.message}`,
          timestamp: new Date()
        }])
        return
      }
    }

    const userMessage: ChatMessage = {
      type: 'user',
      content: input,
      images: uploadedImages,
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setCanAbortSession(true)
    // Set a default status when starting
    setClaudeStatus({
      text: 'Processing',
      tokens: 0,
      can_interrupt: true
    })
    
    // Always scroll to bottom when user sends a message and reset scroll state
    setIsUserScrolledUp(false) // Reset scroll state so auto-scroll works for Claude's response
    setTimeout(() => scrollToBottom(), 100) // Longer delay to ensure message is rendered


    // Get tools settings from localStorage
    const getToolsSettings = () => {
      try {
        const savedSettings = safeLocalStorage.getItem('claude-tools-settings')
        if (savedSettings) {
          return JSON.parse(savedSettings)
        }
      } catch (error) {
        console.error('Error loading tools settings:', error)
      }
      return {
        allowedTools: [],
        disallowedTools: [],
        skipPermissions: false
      }
    }

    const toolsSettings = getToolsSettings()

    try {
      // Send message via conversation hook
      await sendConversationMessage(input, {
        type: 'claude',
        toolSettings: toolsSettings
      })
      
    } catch (error: any) {
      console.error('Failed to send message via WebSocket:', error)
      setChatMessages(prev => [...prev, {
        type: 'error',
        content: `Failed to send message: ${error.message}`,
        timestamp: new Date()
      }])
      setIsLoading(false)
      setCanAbortSession(false)
      setClaudeStatus(null)
      return
    }

    setInput('')
    setAttachedImages([])
    setUploadingImages(new Map())
    setImageErrors(new Map())
    setIsTextareaExpanded(false)
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    
    // Clear the saved draft since message was sent
    if (repositoryId) {
      safeLocalStorage.removeItem(`draft_input_${repositoryId}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle file dropdown navigation
    if (showFileDropdown && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedFileIndex(prev => 
          prev < filteredFiles.length - 1 ? prev + 1 : 0
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedFileIndex(prev => 
          prev > 0 ? prev - 1 : filteredFiles.length - 1
        )
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        if (selectedFileIndex >= 0) {
          selectFile(filteredFiles[selectedFileIndex])
        } else if (filteredFiles.length > 0) {
          selectFile(filteredFiles[0])
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowFileDropdown(false)
        return
      }
    }
    
    // Handle Tab key for mode switching (only when file dropdown is not showing)
    if (e.key === 'Tab' && !showFileDropdown) {
      e.preventDefault()
      const modes: Array<'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'> = ['default', 'acceptEdits', 'bypassPermissions', 'plan']
      const currentIndex = modes.indexOf(permissionMode)
      const nextIndex = (currentIndex + 1) % modes.length
      setPermissionMode(modes[nextIndex])
      return
    }
    
    // Handle Enter key: Ctrl+Enter (Cmd+Enter on Mac) sends, Shift+Enter creates new line
    if (e.key === 'Enter') {
      // If we're in composition, don't send message
      if ((e.nativeEvent as any).isComposing) {
        return // Let IME handle the Enter key
      }
      
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        // Ctrl+Enter or Cmd+Enter: Send message
        e.preventDefault()
        handleSubmit(e)
      } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Plain Enter: Send message only if not in IME composition
        if (!sendByCtrlEnter) {
          e.preventDefault()
          handleSubmit(e)
        }
      }
      // Shift+Enter: Allow default behavior (new line)
    }
  }

  const selectFile = (file: FileReference) => {
    const textBeforeAt = input.slice(0, atSymbolPosition)
    const textAfterAtQuery = input.slice(atSymbolPosition)
    const spaceIndex = textAfterAtQuery.indexOf(' ')
    const textAfterQuery = spaceIndex !== -1 ? textAfterAtQuery.slice(spaceIndex) : ''
    
    const newInput = textBeforeAt + '@' + file.path + ' ' + textAfterQuery
    
    // Update input and hide dropdown
    setInput(newInput)
    setShowFileDropdown(false)
    setAtSymbolPosition(-1)
    
    // Maintain focus
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setInput(newValue)
    
    // Save draft to localStorage
    if (repositoryId) {
      safeLocalStorage.setItem(`draft_input_${repositoryId}`, newValue)
    }
    
    // Handle height reset when input becomes empty
    if (!newValue.trim()) {
      e.target.style.height = 'auto'
      setIsTextareaExpanded(false)
    }
  }

  const handleTextareaClick = () => {
    // Handler for textarea click events
  }

  const handleAbortSession = async () => {
    if (currentSessionId && canAbortSession) {
      try {
        await stopConversation()
        setIsLoading(false)
        setCanAbortSession(false)
        setClaudeStatus(null)
      } catch (error: any) {
        console.error('Failed to abort session:', error)
      }
    }
  }

  const handleModeSwitch = () => {
    const modes: Array<'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'> = ['default', 'acceptEdits', 'bypassPermissions', 'plan']
    const currentIndex = modes.indexOf(permissionMode)
    const nextIndex = (currentIndex + 1) % modes.length
    setPermissionMode(modes[nextIndex])
  }

  // Don't render if required props are missing
  if (!conversationId || !agentId || !repositoryId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>Invalid conversation configuration</p>
        </div>
      </div>
    )
  }

  // Show connection status
  if (!connected && !connecting && !conversationLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>WebSocket not connected</p>
          {onClose && (
            <button 
              onClick={onClose} 
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Close
            </button>
          )}
        </div>
      </div>
    )
  }

  if (connecting || conversationLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
          <p>{connecting ? 'Connecting to WebSocket...' : 'Setting up conversation...'}</p>
        </div>
      </div>
    )
  }

  if (wsError || conversationError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-500">
          <p>Error: {wsError || conversationError}</p>
          {onClose && (
            <button 
              onClick={onClose} 
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Close
            </button>
          )}
        </div>
      </div>
    )
  }

  // Show only recent messages for better performance
  const visibleMessages = useMemo(() => {
    if (chatMessages.length <= visibleMessageCount) {
      return chatMessages
    }
    return chatMessages.slice(-visibleMessageCount)
  }, [chatMessages, visibleMessageCount])

  // Function to merge messages from different sources
  const mergeMessages = useCallback((apiMessages: any[], cachedMessages: ChatMessage[]): ChatMessage[] => {
    const allMessages = [...apiMessages, ...cachedMessages]
    const messageMap = new Map<string, ChatMessage>()
    
    // Convert API messages to ChatMessage format and deduplicate
    allMessages.forEach(msg => {
      let chatMessage: ChatMessage
      
      if (msg.id && msg.from && msg.content && msg.createdAt) {
        // API message format
        chatMessage = {
          type: msg.from === 'user' ? 'user' : msg.from === 'assistant' ? 'assistant' : 'error',
          content: msg.content,
          timestamp: new Date(msg.createdAt),
          isToolUse: msg.metadata?.isToolUse || false,
          toolName: msg.metadata?.toolName,
          toolInput: msg.metadata?.toolInput,
          toolId: msg.metadata?.toolId,
          toolResult: msg.metadata?.toolResult
        }
      } else if (msg.type && msg.content && msg.timestamp) {
        // ChatMessage format (from localStorage)
        chatMessage = msg
      } else {
        return // Skip invalid messages
      }
      
      // Create unique key for deduplication
      const key = `${chatMessage.timestamp.getTime()}-${chatMessage.content.slice(0, 50)}-${chatMessage.type}`
      
      // Keep the most recent version of duplicate messages
      if (!messageMap.has(key) || messageMap.get(key)!.timestamp < chatMessage.timestamp) {
        messageMap.set(key, chatMessage)
      }
    })
    
    // Sort by timestamp
    return Array.from(messageMap.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }, [])

  // Load conversation history on mount or when conversation changes
  useEffect(() => {
    const loadConversationHistory = async () => {
      if (!conversationId || !repositoryId || isLoadingSessionMessages) {
        return
      }
      
      console.log('Loading conversation history for:', conversationId)
      setIsLoadingSessionMessages(true)
      
      try {
        // Load from API
        const response = await fetch(`/api/sessions/${conversationId}/messages`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth-token') || 'dev-token'}`,
            'Content-Type': 'application/json'
          }
        })
        
        let apiMessages: any[] = []
        if (response.ok) {
          apiMessages = await response.json()
          console.log('Loaded API messages:', apiMessages.length)
        } else {
          console.warn('Failed to load API messages:', response.status)
        }
        
        // Load from localStorage cache
        const cachedMessages: ChatMessage[] = JSON.parse(
          safeLocalStorage.getItem(`chat_messages_${repositoryId}`) || '[]'
        )
        console.log('Loaded cached messages:', cachedMessages.length)
        
        // Merge and deduplicate messages
        const mergedMessages = mergeMessages(apiMessages, cachedMessages)
        console.log('Merged messages:', mergedMessages.length)
        
        // Only update if we have messages or if it's a fresh load
        if (mergedMessages.length > 0 || chatMessages.length === 0) {
          setChatMessages(mergedMessages)
        }
        
      } catch (error) {
        console.error('Failed to load conversation history:', error)
        
        // Fallback to localStorage only
        const cachedMessages: ChatMessage[] = JSON.parse(
          safeLocalStorage.getItem(`chat_messages_${repositoryId}`) || '[]'
        )
        if (cachedMessages.length > 0) {
          setChatMessages(cachedMessages)
          console.log('Loaded cached messages as fallback:', cachedMessages.length)
        }
      } finally {
        setIsLoadingSessionMessages(false)
      }
    }
    
    loadConversationHistory()
  }, [conversationId, repositoryId, mergeMessages]) // Remove chatMessages from dependencies to avoid loops

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!isUserScrolledUp && chatMessages.length > 0) {
      setTimeout(() => scrollToBottom(), 100)
    }
  }, [chatMessages, isUserScrolledUp, scrollToBottom])

  // Save messages to localStorage when they change
  useEffect(() => {
    if (repositoryId && chatMessages.length > 0) {
      safeLocalStorage.setItem(`chat_messages_${repositoryId}`, JSON.stringify(chatMessages))
    }
  }, [chatMessages, repositoryId])

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Messages Area - Scrollable Middle Section */}
      <ScrollArea 
        ref={scrollContainerRef}
        className="flex-1 px-0 py-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
        onScroll={handleScroll}
      >
        {isLoadingSessionMessages && chatMessages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
              <p>Loading session messages...</p>
            </div>
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 dark:text-gray-400 px-6 sm:px-4">
              <p className="font-bold text-lg sm:text-xl mb-3">Start a conversation with Claude</p>
              <p className="text-sm sm:text-base leading-relaxed">
                Ask questions about your code, request changes, or get help with development tasks
              </p>
            </div>
          </div>
        ) : (
          <>
            {chatMessages.length > visibleMessageCount && (
              <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-2 border-b border-gray-200 dark:border-gray-700">
                Showing last {visibleMessageCount} messages ({chatMessages.length} total) • 
                <Button 
                  variant="link"
                  className="ml-1 p-0 h-auto text-blue-600 hover:text-blue-700 underline"
                  onClick={() => setVisibleMessageCount(prev => prev + 100)}
                >
                  Load earlier messages
                </Button>
              </div>
            )}
            
            {visibleMessages.map((message, index) => {
              const prevMessage = index > 0 ? visibleMessages[index - 1] : null
              
              return (
                <MessageComponent
                  key={index}
                  message={message}
                  index={index}
                  prevMessage={prevMessage}
                  createDiff={createDiff}
                  autoExpandTools={autoExpandTools}
                  showRawParameters={showRawParameters}
                />
              )
            })}
          </>
        )}
        
        {isLoading && (
          <div className="chat-message assistant">
            <div className="w-full">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0">
                  <ClaudeLogo />
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Claude</div>
              </div>
              <div className="w-full text-sm text-gray-500 dark:text-gray-400 pl-3 sm:pl-0">
                <div className="flex items-center space-x-1">
                  <div className="animate-pulse">●</div>
                  <div className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</div>
                  <div className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</div>
                  <span className="ml-2">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input Area - Fixed Bottom */}
      <div className={cn(
        "p-2 sm:p-4 md:p-6 flex-shrink-0",
        isInputFocused ? 'pb-2 sm:pb-4 md:pb-6' : 'pb-16 sm:pb-4 md:pb-6'
      )}>
        {/* Claude Working Status - positioned above the input form */}
        <ClaudeStatus 
          status={claudeStatus}
          isLoading={isLoading}
          onAbort={handleAbortSession}
        />
        
        {/* Permission Mode Selector with scroll to bottom button - Above input, clickable for mobile */}
        <div className="max-w-4xl mx-auto mb-3">
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={handleModeSwitch}
              className={cn(
                "transition-all duration-200",
                permissionMode === 'default' && "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
                permissionMode === 'acceptEdits' && "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600",
                permissionMode === 'bypassPermissions' && "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-600",
                permissionMode === 'plan' && "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600"
              )}
              title="Click to change permission mode (or press Tab in input)"
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  permissionMode === 'default' && 'bg-gray-500',
                  permissionMode === 'acceptEdits' && 'bg-green-500',
                  permissionMode === 'bypassPermissions' && 'bg-orange-500',
                  permissionMode === 'plan' && 'bg-blue-500'
                )} />
                <span>
                  {permissionMode === 'default' && 'Default Mode'}
                  {permissionMode === 'acceptEdits' && 'Accept Edits'}
                  {permissionMode === 'bypassPermissions' && 'Bypass Permissions'}
                  {permissionMode === 'plan' && 'Plan Mode'}
                </span>
              </div>
            </Button>
            
            {/* Scroll to bottom button - positioned next to mode indicator */}
            {isUserScrolledUp && chatMessages.length > 0 && (
              <Button
                variant="default"
                size="icon"
                onClick={scrollToBottom}
                className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-105"
                title="Scroll to bottom"
              >
                <ArrowDown className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          {/* Drag overlay */}
          {isDragActive && (
            <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-50">
              <Card className="shadow-lg">
                <CardContent className="p-4 text-center">
                  <Download className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">Drop images here</p>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Image attachments preview */}
          {attachedImages.length > 0 && (
            <Card className="mb-2 bg-gray-50 dark:bg-gray-800">
              <CardContent className="p-2">
                <div className="flex flex-wrap gap-2">
                  {attachedImages.map((file, index) => (
                    <ImageAttachment
                      key={index}
                      file={file}
                      onRemove={() => {
                        setAttachedImages(prev => prev.filter((_, i) => i !== index))
                      }}
                      uploadProgress={uploadingImages.get(file.name)}
                      error={imageErrors.get(file.name)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* File dropdown - positioned outside dropzone to avoid conflicts */}
          {showFileDropdown && filteredFiles.length > 0 && (
            <Card className="absolute bottom-full left-0 right-0 mb-2 shadow-lg max-h-48 z-50">
              <ScrollArea className="max-h-48">
                {filteredFiles.map((file, index) => (
                  <div
                    key={file.path}
                    className={cn(
                      "px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0",
                      index === selectedFileIndex
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    )}
                    onMouseDown={(e) => {
                      // Prevent textarea from losing focus on mobile
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      selectFile(file)
                    }}
                  >
                    <div className="font-medium text-sm">{file.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {file.path}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </Card>
          )}
          
          <div 
            className={cn(
              "relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200",
              isTextareaExpanded && 'chat-input-expanded'
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onClick={handleTextareaClick}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder="Ask Claude to help with your code... (@ to reference files)"
              disabled={isLoading}
              rows={1}
              className="w-full pl-12 pr-28 sm:pr-40 py-3 sm:py-4 bg-transparent rounded-2xl focus:outline-none resize-none min-h-[40px] sm:min-h-[56px] max-h-[40vh] sm:max-h-[300px] text-sm sm:text-base transition-all duration-200 border-0 focus-visible:ring-0"
              style={{ height: 'auto' }}
              onInput={(e) => {
                // Immediate resize on input for better UX
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = target.scrollHeight + 'px'
                
                // Check if textarea is expanded (more than 2 lines worth of height)
                const lineHeight = parseInt(window.getComputedStyle(target).lineHeight)
                const isExpanded = target.scrollHeight > lineHeight * 2
                setIsTextareaExpanded(isExpanded)
              }}
            />
            
            {/* Clear button - shown when there's text */}
            {input.trim() && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setInput('')
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto'
                    textareaRef.current.focus()
                  }
                  setIsTextareaExpanded(false)
                }}
                className="absolute -left-0.5 -top-3 sm:right-28 sm:left-auto sm:top-1/2 sm:-translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 border shadow-sm z-10"
                title="Clear input"
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            )}
            
            {/* Image upload button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={openFileDialog}
              className="absolute left-2 bottom-4 p-2 rounded-lg"
              title="Attach images"
            >
              <ImageIcon className="w-5 h-5 text-gray-500" />
            </Button>
            
            {/* Mic button - HIDDEN */}
            <div className="absolute right-16 sm:right-16 top-1/2 transform -translate-y-1/2" style={{ display: 'none' }}>
              <MicButton 
                onTranscript={handleTranscript}
                className="w-10 h-10 sm:w-10 sm:h-10"
              />
            </div>
            
            {/* Send button */}
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              size="icon"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 w-12 h-12 sm:w-12 sm:h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-full"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSubmit(e)
              }}
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </Button>
          </div>
          
          {/* Hint text */}
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2 hidden sm:block">
            {sendByCtrlEnter 
              ? "Ctrl+Enter to send (IME safe) • Shift+Enter for new line • Tab to change modes • @ to reference files" 
              : "Press Enter to send • Shift+Enter for new line • Tab to change modes • @ to reference files"}
          </div>
          <div className={cn(
            "text-xs text-gray-500 dark:text-gray-400 text-center mt-2 sm:hidden transition-opacity duration-200",
            isInputFocused ? 'opacity-100' : 'opacity-0'
          )}>
            {sendByCtrlEnter 
              ? "Ctrl+Enter to send (IME safe) • Tab for modes • @ for files" 
              : "Enter to send • Tab for modes • @ for files"}
          </div>
        </form>
      </div>
    </div>
  )
}

export default memo(ChatInterface)