import { CrudApi } from './base.api'
import type {
  Session,
  CreateSessionDto,
  UpdateSessionDto,
  SessionMessage,
  CreateMessageDto,
  AssignWorkerDto,
  SessionStats,
  MessageQueryParams,
  Assistant
} from '../types/session.types'

/**
 * Session API客户端
 * 提供会话管理的所有功能，包括助手功能
 */
class SessionsApi extends CrudApi<Session, CreateSessionDto, UpdateSessionDto, SessionStats> {
  constructor() {
    super('/api/sessions')
  }

  /**
   * 获取所有会话（用作助手列表）
   */
  async findAll(): Promise<Session[]> {
    return super.findAll()
  }

  /**
   * 将Session数据转换为Assistant显示格式
   */
  transformToAssistants(sessions: Session[]): Assistant[] {
    return sessions.map(session => ({
      id: session.id,
      name: session.name,
      description: this.generateAssistantDescription(session),
      avatar: this.generateAssistantAvatar(session),
      aiTool: session.aiTool,
      status: session.status,
      lastActivity: session.metadata?.lastActivity,
      messageCount: session.messageCount,
      repositoryName: session.repository?.name,
      agentName: session.agent?.name,
      agentStatus: session.agent?.status,
      session: session
    }))
  }

  /**
   * 获取助手列表（基于Session）
   */
  async getAssistants(): Promise<Assistant[]> {
    const sessions = await this.findAll()
    return this.transformToAssistants(sessions)
  }

  /**
   * 创建新助手（实际创建Session）
   */
  async createAssistant(data: CreateSessionDto): Promise<Assistant> {
    const session = await this.create(data)
    return this.transformToAssistants([session])[0]
  }

  /**
   * 更新助手信息
   */
  async updateAssistant(id: string, data: UpdateSessionDto): Promise<Assistant> {
    const session = await this.update(id, data)
    return this.transformToAssistants([session])[0]
  }

  /**
   * 删除助手（删除Session及所有消息）
   */
  async deleteAssistant(id: string): Promise<void> {
    await this.delete(id)
  }

  /**
   * 分配Worker到会话
   */
  async assignWorker(sessionId: string, data: AssignWorkerDto): Promise<Session> {
    return this.post<Session>(`/${sessionId}/assign-worker`, data)
  }

  /**
   * 添加消息到会话
   */
  async addMessage(sessionId: string, message: CreateMessageDto): Promise<SessionMessage> {
    return this.post<SessionMessage>(`/${sessionId}/messages`, message)
  }

  /**
   * 获取会话消息历史
   */
  async getMessages(sessionId: string, params?: MessageQueryParams): Promise<SessionMessage[]> {
    return this.get<SessionMessage[]>(`/${sessionId}/messages`, params)
  }

  /**
   * 归档会话
   */
  async archive(sessionId: string): Promise<Session> {
    return this.post<Session>(`/${sessionId}/archive`, {})
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStats(): Promise<SessionStats> {
    return this.get<SessionStats>('/stats/overview')
  }

  /**
   * 生成助手描述
   */
  private generateAssistantDescription(session: Session): string {
    const parts: string[] = []
    
    if (session.repository?.name) {
      parts.push(`仓库: ${session.repository.name}`)
    }
    
    if (session.agent?.name) {
      const statusText = session.agent.status === 'connected' ? '在线' : '离线'
      parts.push(`Agent: ${session.agent.name} (${statusText})`)
    }
    
    parts.push(`工具: ${session.aiTool}`)
    
    if (session.messageCount > 0) {
      parts.push(`${session.messageCount} 条消息`)
    }
    
    return parts.join(' • ')
  }

  /**
   * 生成助手头像
   */
  private generateAssistantAvatar(session: Session): string {
    // 根据状态和工具类型生成emoji头像
    if (session.status === 'archived') return '📦'
    if (session.status === 'paused') return '⏸️'
    
    // 根据Agent状态
    if (session.agent?.status === 'connected') return '🟢'
    if (session.agent?.status === 'offline') return '⚪'
    
    // 根据AI工具类型
    switch (session.aiTool.toLowerCase()) {
      case 'claude': return '🤖'
      case 'qwen': return '🧠'
      case 'cursor': return '✨'
      default: return '🔧'
    }
  }
}

// 创建单例实例
export const sessionsApi = new SessionsApi()
export default sessionsApi