/**
 * 对话相关的TypeScript类型定义
 * 定义与对话功能相关的所有类型，确保与后端Session/SessionMessage实体兼容
 */

import type { BaseEntity } from './api.types'

// ================================
// 核心对话会话类型
// ================================

/**
 * 对话会话状态枚举
 */
export type ConversationStatus = 'initializing' | 'active' | 'paused' | 'completed' | 'failed'

/**
 * 支持的AI工具类型
 */
export type AiToolType = 'claude' | 'openai' | 'gemini' | 'ollama' | 'custom'

/**
 * 输入历史记录项
 */
export interface InputHistoryItem {
  /** 输入内容 */
  content: string
  /** 输入时间戳 */
  timestamp: Date
  /** 输入类型 */
  type: 'user_input' | 'template' | 'suggestion'
  /** 额外元数据 */
  metadata?: Record<string, any>
}

/**
 * 对话偏好设置
 */
export interface ConversationPreferences {
  /** 启用代码高亮 */
  enableCodeHighlight?: boolean
  /** 启用自动保存 */
  enableAutoSave?: boolean
  /** 自动保存间隔（秒） */
  autoSaveInterval?: number
  /** 消息显示格式 */
  messageFormat?: 'markdown' | 'plain' | 'rich'
  /** 主题设置 */
  theme?: 'light' | 'dark' | 'system'
  /** 字体大小 */
  fontSize?: 'small' | 'medium' | 'large'
  /** 启用声音通知 */
  enableSoundNotification?: boolean
}

/**
 * 对话状态
 */
export interface ConversationState {
  /** 当前使用的AI工具 */
  aiTool: AiToolType
  /** 工具权限列表 */
  toolPermissions: string[]
  /** 输入历史记录 */
  inputHistory: InputHistoryItem[]
  /** 用户偏好设置 */
  preferences: ConversationPreferences
  /** 当前分支 */
  branch?: string
  /** 工作区状态 */
  workspaceState?: {
    /** 当前工作目录 */
    currentDirectory?: string
    /** 打开的文件 */
    openFiles?: string[]
    /** 环境变量 */
    environment?: Record<string, string>
  }
  /** 上下文信息 */
  context?: {
    /** 项目类型 */
    projectType?: string
    /** 编程语言 */
    language?: string
    /** 框架信息 */
    framework?: string
  }
}

/**
 * 对话会话接口
 * 兼容后端Session实体
 */
export interface ConversationSession extends BaseEntity {
  /** 会话名称 */
  name: string
  /** 关联的Agent ID */
  agentId?: string
  /** 关联的仓库ID */
  repositoryId: string
  /** 仓库名称（冗余字段，用于显示） */
  repositoryName?: string
  /** 会话状态 */
  status: ConversationStatus
  /** 对话状态 */
  conversationState: ConversationState
  /** 最后活动时间 */
  lastActivity: Date
  /** 分配的Worker ID */
  workerId?: string
  /** 消息列表 */
  messages?: ConversationMessage[]
  /** 额外元数据 */
  metadata?: SessionMetadata
}

/**
 * 会话元数据
 */
export interface SessionMetadata {
  /** 分支信息 */
  branch?: string
  /** 最后活动时间 */
  lastActivity?: Date
  /** Token使用量 */
  tokenUsage?: number
  /** Worker状态 */
  workerStatus?: 'idle' | 'busy'
  /** Claude会话ID */
  claudeSessionId?: string
  /** 是否正在处理 */
  isProcessing?: boolean
  /** 会话标签 */
  tags?: string[]
  /** 自定义属性 */
  [key: string]: any
}

// ================================
// 消息相关类型
// ================================

/**
 * 消息类型枚举
 */
export type MessageType = 'user' | 'assistant' | 'system' | 'tool'

/**
 * 消息元数据
 */
export interface MessageMetadata {
  /** 工具调用信息 */
  toolCall?: ToolCallMetadata
  /** 使用情况统计 */
  usage?: {
    /** 输入token数 */
    inputTokens?: number
    /** 输出token数 */
    outputTokens?: number
    /** 总token数 */
    totalTokens?: number
  }
  /** Agent信息 */
  agentId?: string
  /** Worker信息 */
  workerId?: string
  /** 消息来源 */
  source?: string
  /** 是否为流式响应 */
  isStreaming?: boolean
  /** 响应时间（毫秒） */
  responseTime?: number
  /** 自定义属性 */
  [key: string]: any
}

/**
 * 工具调用元数据
 */
export interface ToolCallMetadata {
  /** 工具名称 */
  toolName: string
  /** 工具输入参数 */
  toolInput: any
  /** 工具输出结果 */
  toolOutput: any
  /** 是否为工具使用 */
  isToolUse: boolean
  /** 工具调用ID */
  toolId: string
  /** 执行时间（毫秒） */
  executionTime: number
  /** 调用状态 */
  status?: 'pending' | 'running' | 'completed' | 'failed'
  /** 错误信息 */
  error?: string
}

/**
 * 对话消息接口
 * 兼容后端SessionMessage实体
 */
export interface ConversationMessage extends BaseEntity {
  /** 关联的会话ID */
  sessionId: string
  /** 消息类型 */
  type: MessageType
  /** 消息内容 */
  content: string
  /** 消息元数据 */
  metadata?: MessageMetadata
  /** 消息时间戳 */
  timestamp: Date
  /** 消息发送者（兼容字段） */
  from?: 'user' | 'assistant' | 'system'
}

// ================================
// 事件和请求类型
// ================================

/**
 * 对话状态更新请求
 */
export interface ConversationStateUpdateRequest {
  /** 会话ID */
  sessionId: string
  /** 要更新的对话状态（部分更新） */
  conversationState: Partial<ConversationState>
}

/**
 * 对话事件类型
 */
export type ConversationEventType = 
  | 'session_created'
  | 'session_updated'
  | 'session_deleted'
  | 'message_added'
  | 'message_updated'
  | 'worker_assigned'
  | 'worker_status_changed'
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'processing_status_changed'

/**
 * 对话事件
 */
export interface ConversationEvent {
  /** 事件类型 */
  type: ConversationEventType
  /** 关联的会话ID */
  sessionId: string
  /** 事件数据 */
  data: any
  /** 事件时间戳 */
  timestamp: Date
  /** 事件ID */
  eventId?: string
  /** 事件来源 */
  source?: string
}

// ================================
// 对话配置类型
// ================================

/**
 * 对话创建配置
 */
export interface ConversationConfig {
  /** Agent ID */
  agentId: string
  /** 仓库 ID */
  repositoryId: string
  /** 分支名称 */
  branch?: string
  /** AI 工具类型 */
  aiTool: AiToolType
  /** 工具权限列表 */
  toolPermissions: string[]
  /** 对话偏好设置 */
  preferences: ConversationPreferences
}

// ================================
// API请求和响应类型
// ================================

/**
 * 创建会话请求
 */
export interface CreateConversationSessionRequest {
  /** 会话名称 */
  name: string
  /** 仓库ID */
  repositoryId: string
  /** AI工具类型 */
  aiTool: AiToolType
  /** 初始对话状态 */
  conversationState?: Partial<ConversationState>
  /** 元数据 */
  metadata?: Partial<SessionMetadata>
}

/**
 * 更新会话请求
 */
export interface UpdateConversationSessionRequest {
  /** 会话名称 */
  name?: string
  /** 会话状态 */
  status?: ConversationStatus
  /** 对话状态 */
  conversationState?: Partial<ConversationState>
  /** 元数据 */
  metadata?: Partial<SessionMetadata>
}

/**
 * 创建消息请求
 */
export interface CreateMessageRequest {
  /** 消息类型 */
  type: MessageType
  /** 消息内容 */
  content: string
  /** 消息元数据 */
  metadata?: MessageMetadata
  /** 消息发送者（向后兼容） */
  from?: 'user' | 'assistant' | 'system'
}

/**
 * 分配Worker请求
 */
export interface AssignWorkerRequest {
  /** Worker ID */
  workerId: string
  /** Agent ID */
  agentId: string
}

/**
 * 获取会话历史请求
 */
export interface GetSessionHistoryRequest {
  /** Worker ID */
  workerId: string
  /** Agent ID */
  agentId: string
  /** 限制条数 */
  limit?: number
  /** 偏移量 */
  offset?: number
}

// ================================
// UI相关类型
// ================================

/**
 * 会话列表过滤器
 */
export interface ConversationSessionFilters {
  /** 按状态过滤 */
  status?: ConversationStatus[]
  /** 按仓库过滤 */
  repositoryId?: string
  /** 按Agent过滤 */
  agentId?: string
  /** 按AI工具过滤 */
  aiTool?: AiToolType[]
  /** 搜索关键词 */
  search?: string
  /** 时间范围 */
  dateRange?: {
    start: Date
    end: Date
  }
  /** 是否有消息 */
  hasMessages?: boolean
}

/**
 * 消息显示选项
 */
export interface MessageDisplayOptions {
  /** 显示时间戳 */
  showTimestamp?: boolean
  /** 显示元数据 */
  showMetadata?: boolean
  /** 高亮代码 */
  highlightCode?: boolean
  /** 渲染模式 */
  renderMode?: 'markdown' | 'plain' | 'rich'
  /** 最大长度（截断） */
  maxLength?: number
}

/**
 * 对话界面状态
 */
export interface ConversationUIState {
  /** 是否显示侧边栏 */
  showSidebar: boolean
  /** 当前选中的会话ID */
  selectedSessionId: string | null
  /** 消息输入框内容 */
  messageInput: string
  /** 是否正在发送消息 */
  isSending: boolean
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 过滤器状态 */
  filters: ConversationSessionFilters
  /** 消息显示选项 */
  messageDisplayOptions: MessageDisplayOptions
}

// ================================
// WebSocket相关类型
// ================================

/**
 * WebSocket消息类型
 */
export type WebSocketMessageType = 
  | 'conversation_event'
  | 'message_stream'
  | 'tool_call_update'
  | 'worker_status'
  | 'error'

/**
 * WebSocket消息
 */
export interface WebSocketMessage {
  /** 消息类型 */
  type: WebSocketMessageType
  /** 消息数据 */
  data: any
  /** 消息ID */
  messageId?: string
  /** 时间戳 */
  timestamp: Date
}

/**
 * 流式消息数据
 */
export interface StreamMessageData {
  /** 会话ID */
  sessionId: string
  /** 消息ID */
  messageId: string
  /** 增量内容 */
  delta: string
  /** 是否完成 */
  isComplete: boolean
  /** 完整内容（完成时） */
  fullContent?: string
}

// ================================
// 错误类型
// ================================

/**
 * 对话错误类型
 */
export type ConversationErrorType = 
  | 'session_not_found'
  | 'worker_not_available'
  | 'tool_call_failed'
  | 'authentication_failed'
  | 'rate_limit_exceeded'
  | 'invalid_request'
  | 'internal_error'

/**
 * 对话错误
 */
export interface ConversationError {
  /** 错误类型 */
  type: ConversationErrorType
  /** 错误消息 */
  message: string
  /** 错误代码 */
  code?: string
  /** 详细信息 */
  details?: any
  /** 时间戳 */
  timestamp: Date
  /** 会话ID（如果相关） */
  sessionId?: string
}

// ================================
// 导出兼容性类型（向后兼容）
// ================================

/**
 * Session类型别名（向后兼容session.store.ts）
 */
export type Session = ConversationSession

/**
 * Message类型别名（向后兼容session.store.ts）
 */
export type Message = ConversationMessage

/**
 * 兼容的消息from字段映射
 */
export const MESSAGE_FROM_TO_TYPE_MAP: Record<string, MessageType> = {
  'user': 'user',
  'assistant': 'assistant',
  'system': 'system'
} as const

/**
 * 兼容的消息类型到from字段映射
 */
export const MESSAGE_TYPE_TO_FROM_MAP: Record<MessageType, string> = {
  'user': 'user',
  'assistant': 'assistant',
  'system': 'system',
  'tool': 'system'
} as const