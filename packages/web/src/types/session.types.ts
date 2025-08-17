import { BaseEntity } from './api.types'

/**
 * 会话状态类型
 */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'archived'

/**
 * 消息发送者类型
 */
export type MessageFrom = 'user' | 'assistant' | 'system'

/**
 * AI工具类型
 */
export type AiToolType = 'claude' | 'qwen' | 'cursor' | 'codex'

/**
 * 会话元数据
 */
export interface SessionMetadata {
  branch?: string
  lastActivity?: string
  tokenUsage?: number
  workerStatus?: 'idle' | 'busy'
  workerConfig?: any
  conversationState?: {
    aiTool: 'claude' | 'codex'
    toolPermissions: string[]
    inputHistory: Array<{
      timestamp: string
      content: string
      type: 'text' | 'command'
    }>
    preferences: {
      responseFormat?: 'brief' | 'detailed'
      codeStyle?: 'typescript' | 'javascript' | 'python'
      outputLanguage?: 'en' | 'zh'
      autoSave?: boolean
      debugMode?: boolean
      [key: string]: any
    }
  }
}

/**
 * 消息元数据
 */
export interface MessageMetadata {
  tool?: string
  agentId?: string
  workerId?: string
  usage?: {
    input_tokens: number
    output_tokens: number
  }
  error?: string
  toolCall?: {
    toolName: string
    toolInput: any
    toolOutput: any
    isToolUse: boolean
    toolId: string
    executionTime: number
  }
}

/**
 * 会话消息
 */
export interface SessionMessage extends BaseEntity {
  sessionId: string
  from: MessageFrom
  content: string
  metadata?: MessageMetadata
}

/**
 * 会话实体
 */
export interface Session extends BaseEntity {
  name: string
  aiTool: string
  status: SessionStatus
  userId: string
  repositoryId: string
  workerId?: string
  agentId?: string
  claudeSessionId?: string
  metadata?: SessionMetadata
  messageCount: number
  totalTokens: number
  totalCost: number
  messages?: SessionMessage[]
  // 关联数据
  repository?: {
    id: string
    name: string
    url: string
    type: string
  }
  agent?: {
    id: string
    name: string
    status: string
  }
}

/**
 * 创建会话DTO
 */
export interface CreateSessionDto {
  name: string
  repositoryId: string
  aiTool: string
  agentId?: string
  metadata?: SessionMetadata
}

/**
 * 更新会话DTO
 */
export interface UpdateSessionDto {
  name?: string
  status?: SessionStatus
  metadata?: SessionMetadata
}

/**
 * 分配Worker DTO
 */
export interface AssignWorkerDto {
  workerId: string
  agentId: string
}

/**
 * 创建消息DTO
 */
export interface CreateMessageDto {
  from: MessageFrom
  content: string
  metadata?: MessageMetadata
}

/**
 * 会话统计信息
 */
export interface SessionStats {
  total: number
  byStatus: Record<SessionStatus, number>
  totalMessages: number
  totalTokens: number
  totalCost: number
  activeSessionsToday: number
  averageMessagesPerSession: number
}

/**
 * 消息查询参数
 */
export interface MessageQueryParams {
  limit?: number
  offset?: number
  from?: MessageFrom
  startDate?: string
  endDate?: string
}

/**
 * 助手 - 基于Session的前端表示
 * 这是用户看到的"助手"概念，实际上是Session + 关联信息
 */
export interface Assistant {
  id: string // session.id
  name: string // session.name
  description?: string // 基于repository和agent信息生成
  avatar?: string // 基于状态生成
  aiTool: string // session.aiTool
  status: SessionStatus // session.status
  lastActivity?: string // session.metadata.lastActivity
  messageCount: number // session.messageCount
  repositoryName?: string // session.repository.name
  agentName?: string // session.agent.name
  agentStatus?: string // session.agent.status
  session: Session // 完整的session数据
}