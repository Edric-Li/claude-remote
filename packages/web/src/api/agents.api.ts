import { CrudApi } from './base.api'

/**
 * Agent状态类型
 */
export type AgentStatus = 'pending' | 'connected' | 'offline'

/**
 * Agent实体
 */
export interface Agent {
  id: string
  name: string
  description?: string
  secretKey: string
  maxWorkers: number
  status: AgentStatus
  hostname?: string
  platform?: string
  ipAddress?: string
  resources?: {
    cpuCores: number
    memory: number
    diskSpace: number
  }
  tags?: string[]
  workerStrategy?: {
    mode: 'auto' | 'manual' | 'dynamic'
    config: Record<string, any>
  }
  allowedTools?: string[]
  metadata?: {
    lastValidationResult?: {
      success: boolean
      timestamp: string
      responseTime?: number
      errorMessage?: string
      warnings?: string[]
      metrics?: {
        connectivity: boolean
        authentication: boolean
        resourceAvailability: boolean
      }
    }
    monitoringConfig?: {
      enabled: boolean
      heartbeatInterval: number
      alertThresholds: {
        cpuUsage: number
        memoryUsage: number
        diskUsage: number
        responseTime: number
      }
      notificationChannels: string[]
    }
    alertRules?: Array<{
      id: string
      name: string
      condition: string
      threshold: number
      severity: 'low' | 'medium' | 'high' | 'critical'
      enabled: boolean
    }>
    permissions?: {
      allowedOperations: string[]
      accessLevel: 'read' | 'write' | 'admin'
      restrictions: string[]
    }
  }
  lastSeenAt?: string
  lastValidatedAt?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

/**
 * 创建Agent DTO
 */
export interface CreateAgentDto {
  name: string
  description?: string
  maxWorkers?: number
  resources?: {
    cpuCores: number
    memory: number
    diskSpace: number
  }
  tags?: string[]
  workerStrategy?: {
    mode: 'auto' | 'manual' | 'dynamic'
    config: Record<string, any>
  }
  allowedTools?: string[]
}

/**
 * 更新Agent DTO
 */
export interface UpdateAgentDto {
  name?: string
  description?: string
  maxWorkers?: number
  resources?: {
    cpuCores: number
    memory: number
    diskSpace: number
  }
  tags?: string[]
  workerStrategy?: {
    mode: 'auto' | 'manual' | 'dynamic'
    config: Record<string, any>
  }
  allowedTools?: string[]
  metadata?: Agent['metadata']
}

/**
 * Agent统计信息
 */
export interface AgentStats {
  total: number
  connected: number
  offline: number
  pending: number
  byPlatform: Record<string, number>
  byStatus: Record<string, number>
  avgResponseTime: number
  recentlyCreated: number
}

/**
 * Agent搜索参数
 */
export interface AgentSearchParams {
  search?: string
  status?: AgentStatus
  tags?: string
  platform?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

/**
 * Agent搜索结果
 */
export interface AgentSearchResult {
  items: Agent[]
  totalCount: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Agent API客户端
 */
class AgentsApi extends CrudApi<Agent, CreateAgentDto, UpdateAgentDto, AgentStats> {
  constructor() {
    super('/api/agents')
  }

  /**
   * 获取已连接的Agent列表
   */
  async getConnected(): Promise<Agent[]> {
    return this.get<Agent[]>('/connected')
  }

  /**
   * 高级搜索Agent
   */
  async search(params: AgentSearchParams): Promise<AgentSearchResult> {
    return this.get<AgentSearchResult>('/search', params)
  }

  /**
   * 重置Agent密钥
   */
  async resetKey(id: string): Promise<{ secretKey: string }> {
    return this.post<{ secretKey: string }>(`/${id}/reset-key`, {})
  }

  /**
   * 断开Agent连接
   */
  async disconnect(id: string): Promise<void> {
    await this.post<void>(`/${id}/disconnect`, {})
  }

  /**
   * 获取Agent连接命令
   */
  async getConnectionCommand(
    id: string,
    env?: 'local' | 'development' | 'production'
  ): Promise<{
    command: string
    env: string
    instructions: string[]
  }> {
    return this.get<{
      command: string
      env: string
      instructions: string[]
    }>(`/${id}/connection-command`, { env })
  }

  /**
   * 测试Agent连接
   */
  async testConnection(id: string): Promise<{
    success: boolean
    responseTime?: number
    error?: string
    timestamp: string
  }> {
    return this.post<{
      success: boolean
      responseTime?: number
      error?: string
      timestamp: string
    }>(`/${id}/test-connection`, {})
  }
}

// 创建单例实例
export const agentsApi = new AgentsApi()
export default agentsApi