import { API_BASE_URL } from '../config'
import type {
  Agent,
  AgentFormData,
  AgentFilters,
  PaginationOptions,
  BatchOperation,
  BatchOperationResult,
  ConnectionTestResult,
  AgentStatistics
} from '../types/agent.types'

export class AgentService {
  private getAuthHeaders(accessToken: string) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  }

  /**
   * 获取Agent列表（支持筛选和分页）
   */
  async getAgents(
    accessToken: string,
    filters?: AgentFilters,
    pagination?: PaginationOptions
  ): Promise<{
    agents: Agent[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    const params = new URLSearchParams()
    
    if (filters) {
      if (filters.search) params.append('search', filters.search)
      if (filters.status) params.append('status', filters.status)
      if (filters.platform) params.append('platform', filters.platform)
      if (filters.tags?.length) params.append('tags', filters.tags.join(','))
      if (filters.hasValidationResult !== undefined) {
        params.append('hasValidationResult', filters.hasValidationResult.toString())
      }
      if (filters.monitoringEnabled !== undefined) {
        params.append('monitoringEnabled', filters.monitoringEnabled.toString())
      }
      if (filters.lastSeenAfter) {
        params.append('lastSeenAfter', filters.lastSeenAfter.toISOString())
      }
      if (filters.lastSeenBefore) {
        params.append('lastSeenBefore', filters.lastSeenBefore.toISOString())
      }
    }

    if (pagination) {
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())
      if (pagination.sortBy) params.append('sortBy', pagination.sortBy)
      if (pagination.sortOrder) params.append('sortOrder', pagination.sortOrder)
    }

    const response = await fetch(`${API_BASE_URL}/api/agents/search?${params}`, {
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch agents: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * 获取单个Agent详情
   */
  async getAgent(accessToken: string, id: string): Promise<Agent> {
    const response = await fetch(`${API_BASE_URL}/api/agents/${id}`, {
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch agent: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * 创建Agent
   */
  async createAgent(accessToken: string, data: AgentFormData): Promise<Agent> {
    const response = await fetch(`${API_BASE_URL}/api/agents`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({
        ...data,
        createdBy: 'admin'
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create agent')
    }

    return response.json()
  }

  /**
   * 更新Agent
   */
  async updateAgent(accessToken: string, id: string, data: Partial<AgentFormData>): Promise<Agent> {
    const response = await fetch(`${API_BASE_URL}/api/agents/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update agent')
    }

    return response.json()
  }

  /**
   * 删除Agent
   */
  async deleteAgent(accessToken: string, id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/agents/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to delete agent')
    }
  }

  /**
   * 重置Agent密钥
   */
  async resetAgentKey(accessToken: string, id: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/agents/${id}/reset-key`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to reset agent key')
    }

    const result = await response.json()
    return result.secretKey
  }

  /**
   * 测试Agent连接
   */
  async testConnection(accessToken: string, id: string): Promise<ConnectionTestResult> {
    const response = await fetch(`${API_BASE_URL}/api/agents/${id}/test-connection`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to test connection')
    }

    return response.json()
  }

  /**
   * 获取Agent连接命令
   */
  async getConnectionCommand(
    accessToken: string,
    id: string,
    env: string = 'local'
  ): Promise<{
    command: string
    instructions: string[]
  }> {
    const response = await fetch(`${API_BASE_URL}/api/agents/${id}/connection-command?env=${env}`, {
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get connection command')
    }

    return response.json()
  }

  /**
   * 执行批量操作
   */
  async performBatchOperation(
    accessToken: string,
    operation: BatchOperation
  ): Promise<BatchOperationResult> {
    const response = await fetch(`${API_BASE_URL}/api/agents/batch`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify(operation)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to perform batch operation')
    }

    return response.json()
  }

  /**
   * 获取Agent统计信息
   */
  async getAgentStatistics(accessToken: string): Promise<AgentStatistics> {
    const response = await fetch(`${API_BASE_URL}/api/agents/statistics`, {
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get agent statistics')
    }

    return response.json()
  }

  /**
   * 断开Agent连接
   */
  async disconnectAgent(accessToken: string, id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/agents/${id}/disconnect`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to disconnect agent')
    }
  }

  /**
   * 批量验证Agent连接
   */
  async batchValidateAgents(
    accessToken: string,
    agentIds: string[]
  ): Promise<Array<{ agentId: string; result: ConnectionTestResult }>> {
    const response = await fetch(`${API_BASE_URL}/api/agents/batch-validate`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({ agentIds })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to batch validate agents')
    }

    return response.json()
  }

  /**
   * 更新Agent监控配置
   */
  async updateMonitoringConfig(
    accessToken: string,
    id: string,
    config: any
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/health/${id}/monitoring/config`, {
      method: 'PUT',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify(config)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update monitoring config')
    }
  }

  // ===== 健康监控相关 API =====

  /**
   * 启动Agent监控
   */
  async startMonitoring(accessToken: string, agentId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/health/${agentId}/monitoring/start`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to start monitoring')
    }
  }

  /**
   * 停止Agent监控
   */
  async stopMonitoring(accessToken: string, agentId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/health/${agentId}/monitoring/stop`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to stop monitoring')
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck(accessToken: string, agentId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/health/${agentId}/check`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to perform health check')
    }

    return response.json()
  }

  /**
   * 获取健康历史
   */
  async getHealthHistory(
    accessToken: string,
    agentId: string,
    startTime?: Date,
    endTime?: Date,
    limit?: number
  ): Promise<any[]> {
    const params = new URLSearchParams()
    if (startTime) params.append('startTime', startTime.toISOString())
    if (endTime) params.append('endTime', endTime.toISOString())
    if (limit) params.append('limit', limit.toString())

    const response = await fetch(`${API_BASE_URL}/health/${agentId}/history?${params}`, {
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get health history')
    }

    return response.json()
  }

  /**
   * 获取健康统计
   */
  async getHealthStats(
    accessToken: string,
    agentId: string,
    period: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/health/${agentId}/stats?period=${period}`, {
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get health stats')
    }

    return response.json()
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(
    accessToken: string,
    agentId: string,
    alertId: string,
    userId: string
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/health/${agentId}/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({ userId })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to acknowledge alert')
    }
  }

  /**
   * 获取监控概览
   */
  async getMonitoringOverview(accessToken: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/health/overview`, {
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get monitoring overview')
    }

    return response.json()
  }

  /**
   * 获取实时监控数据
   */
  async getRealtimeData(accessToken: string, agentId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/health/${agentId}/realtime`, {
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get realtime data')
    }

    return response.json()
  }

  // ===== 批量操作相关 API =====

  /**
   * 批量删除Agents
   */
  async batchDeleteAgents(
    accessToken: string,
    agentIds: string[],
    userId: string
  ): Promise<BatchOperationResult> {
    const response = await fetch(`${API_BASE_URL}/api/agents/batch`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({ agentIds, userId })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to batch delete agents')
    }

    return response.json()
  }

  /**
   * 批量更新Agent状态
   */
  async batchUpdateStatus(
    accessToken: string,
    agentIds: string[],
    status: 'pending' | 'connected' | 'offline',
    userId: string
  ): Promise<BatchOperationResult> {
    const response = await fetch(`${API_BASE_URL}/api/agents/batch/status`, {
      method: 'PUT',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({ agentIds, status, userId })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to batch update status')
    }

    return response.json()
  }

  /**
   * 批量更新Agent标签
   */
  async batchUpdateTags(
    accessToken: string,
    agentIds: string[],
    tags: string[],
    mode: 'replace' | 'add' | 'remove',
    userId: string
  ): Promise<BatchOperationResult> {
    const response = await fetch(`${API_BASE_URL}/api/agents/batch/tags`, {
      method: 'PUT',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({ agentIds, tags, mode, userId })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to batch update tags')
    }

    return response.json()
  }

  /**
   * 获取Agent统计信息
   */
  async getStats(accessToken: string): Promise<{
    total: number
    connected: number
    offline: number
    pending: number
    byPlatform: Record<string, number>
    byStatus: Record<string, number>
    avgResponseTime: number
    recentlyCreated: number
  }> {
    const response = await fetch(`${API_BASE_URL}/api/agents/stats`, {
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get agent stats')
    }

    return response.json()
  }

  /**
   * 批量验证Agent配置
   */
  async batchValidateConfig(
    accessToken: string,
    agentIds: string[]
  ): Promise<{
    results: Array<{
      agentId: string
      valid: boolean
      issues?: string[]
    }>
  }> {
    const response = await fetch(`${API_BASE_URL}/api/agents/batch/validate`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({ agentIds })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to batch validate')
    }

    return response.json()
  }

  /**
   * 批量重置Agent密钥
   */
  async batchResetKeys(
    accessToken: string,
    agentIds: string[],
    userId: string
  ): Promise<{
    results: Array<{
      agentId: string
      success: boolean
      secretKey?: string
      error?: string
    }>
  }> {
    const response = await fetch(`${API_BASE_URL}/api/agents/batch/reset-keys`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({ agentIds, userId })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to batch reset keys')
    }

    return response.json()
  }

  // ===== 批量监控操作 =====

  /**
   * 批量启动监控
   */
  async batchStartMonitoring(
    accessToken: string,
    agentIds: string[]
  ): Promise<{
    success: boolean
    results: Array<{
      agentId: string
      success: boolean
      error?: string
    }>
  }> {
    const response = await fetch(`${API_BASE_URL}/health/batch/monitoring/start`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({ agentIds })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to batch start monitoring')
    }

    return response.json()
  }

  /**
   * 批量停止监控
   */
  async batchStopMonitoring(
    accessToken: string,
    agentIds: string[]
  ): Promise<{
    success: boolean
    results: Array<{
      agentId: string
      success: boolean
      error?: string
    }>
  }> {
    const response = await fetch(`${API_BASE_URL}/health/batch/monitoring/stop`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({ agentIds })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to batch stop monitoring')
    }

    return response.json()
  }
}

export const agentService = new AgentService()