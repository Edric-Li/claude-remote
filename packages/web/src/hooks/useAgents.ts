import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/auth.store'
import { agentService } from '../services/agent.service'
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

export interface UseAgentsState {
  agents: Agent[]
  loading: boolean
  error: string | null
  selectedAgents: string[]
  filters: AgentFilters
  pagination: PaginationOptions
  totalCount: number
  totalPages: number
  statistics: AgentStatistics | null
}

export interface UseAgentsActions {
  loadAgents: () => Promise<void>
  createAgent: (data: AgentFormData) => Promise<Agent>
  updateAgent: (id: string, data: Partial<AgentFormData>) => Promise<Agent>
  deleteAgent: (id: string) => Promise<void>
  resetAgentKey: (id: string) => Promise<string>
  testConnection: (id: string) => Promise<ConnectionTestResult>
  performBatchOperation: (operation: BatchOperation) => Promise<BatchOperationResult>
  setFilters: (filters: Partial<AgentFilters>) => void
  setPagination: (pagination: Partial<PaginationOptions>) => void
  setSelectedAgents: (agentIds: string[]) => void
  toggleAgentSelection: (agentId: string) => void
  selectAllAgents: () => void
  clearSelection: () => void
  refreshAgent: (id: string) => Promise<void>
  loadStatistics: () => Promise<void>
}

export function useAgents(): UseAgentsState & UseAgentsActions {
  const { accessToken } = useAuthStore()
  
  const [state, setState] = useState<UseAgentsState>({
    agents: [],
    loading: false,
    error: null,
    selectedAgents: [],
    filters: {},
    pagination: { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'DESC' },
    totalCount: 0,
    totalPages: 0,
    statistics: null
  })

  const updateState = useCallback((updates: Partial<UseAgentsState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const loadAgents = useCallback(async () => {
    if (!accessToken) return

    updateState({ loading: true, error: null })

    try {
      const result = await agentService.getAgents(accessToken, state.filters, state.pagination)
      
      updateState({
        agents: result.agents || result.items || [],
        totalCount: result.totalCount || result.total || 0,
        totalPages: result.totalPages || 0,
        loading: false
      })
    } catch (error) {
      console.error('Failed to load agents:', error)
      updateState({
        error: error instanceof Error ? error.message : 'Failed to load agents',
        loading: false
      })
    }
  }, [accessToken, state.filters, state.pagination, updateState])

  const createAgent = useCallback(async (data: AgentFormData): Promise<Agent> => {
    if (!accessToken) throw new Error('No access token')

    updateState({ loading: true, error: null })

    try {
      const newAgent = await agentService.createAgent(accessToken, data)
      
      // 重新加载列表
      await loadAgents()
      
      return newAgent
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create agent'
      updateState({ error: errorMessage, loading: false })
      throw error
    }
  }, [accessToken, loadAgents, updateState])

  const updateAgent = useCallback(async (id: string, data: Partial<AgentFormData>): Promise<Agent> => {
    if (!accessToken) throw new Error('No access token')

    try {
      const updatedAgent = await agentService.updateAgent(accessToken, id, data)
      
      // 更新本地状态
      updateState({
        agents: state.agents.map(agent => 
          agent.id === id ? { ...agent, ...updatedAgent } : agent
        )
      })
      
      return updatedAgent
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update agent'
      updateState({ error: errorMessage })
      throw error
    }
  }, [accessToken, state.agents, updateState])

  const deleteAgent = useCallback(async (id: string): Promise<void> => {
    if (!accessToken) throw new Error('No access token')

    try {
      await agentService.deleteAgent(accessToken, id)
      
      // 更新本地状态
      updateState({
        agents: state.agents.filter(agent => agent.id !== id),
        selectedAgents: state.selectedAgents.filter(selectedId => selectedId !== id),
        totalCount: state.totalCount - 1
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete agent'
      updateState({ error: errorMessage })
      throw error
    }
  }, [accessToken, state.agents, state.selectedAgents, state.totalCount, updateState])

  const resetAgentKey = useCallback(async (id: string): Promise<string> => {
    if (!accessToken) throw new Error('No access token')

    try {
      const newSecretKey = await agentService.resetAgentKey(accessToken, id)
      
      // 更新本地状态
      updateState({
        agents: state.agents.map(agent => 
          agent.id === id ? { ...agent, secretKey: newSecretKey } : agent
        )
      })
      
      return newSecretKey
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset agent key'
      updateState({ error: errorMessage })
      throw error
    }
  }, [accessToken, state.agents, updateState])

  const testConnection = useCallback(async (id: string): Promise<ConnectionTestResult> => {
    if (!accessToken) throw new Error('No access token')

    try {
      const result = await agentService.testConnection(accessToken, id)
      
      // 更新Agent的验证结果
      updateState({
        agents: state.agents.map(agent => 
          agent.id === id 
            ? { 
                ...agent, 
                metadata: {
                  ...agent.metadata,
                  lastValidationResult: {
                    success: result.success,
                    timestamp: result.timestamp,
                    responseTime: result.responseTime,
                    errorMessage: result.success ? undefined : result.message
                  }
                }
              }
            : agent
        )
      })
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to test connection'
      updateState({ error: errorMessage })
      throw error
    }
  }, [accessToken, state.agents, updateState])

  const performBatchOperation = useCallback(async (operation: BatchOperation): Promise<BatchOperationResult> => {
    if (!accessToken) throw new Error('No access token')

    updateState({ loading: true, error: null })

    try {
      const result = await agentService.performBatchOperation(accessToken, operation)
      
      // 根据操作类型更新本地状态
      if (operation.type === 'delete') {
        const successfulDeletes = result.results
          .filter(r => r.success)
          .map(r => r.agentId)
        
        updateState({
          agents: state.agents.filter(agent => !successfulDeletes.includes(agent.id)),
          selectedAgents: state.selectedAgents.filter(id => !successfulDeletes.includes(id)),
          loading: false
        })
      } else {
        // 对于其他操作类型，重新加载数据
        await loadAgents()
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch operation failed'
      updateState({ error: errorMessage, loading: false })
      throw error
    }
  }, [accessToken, state.agents, state.selectedAgents, loadAgents, updateState])

  const setFilters = useCallback((filters: Partial<AgentFilters>) => {
    updateState({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 } // 重置到第一页
    })
  }, [state.filters, state.pagination, updateState])

  const setPagination = useCallback((pagination: Partial<PaginationOptions>) => {
    updateState({
      pagination: { ...state.pagination, ...pagination }
    })
  }, [state.pagination, updateState])

  const setSelectedAgents = useCallback((agentIds: string[]) => {
    updateState({ selectedAgents: agentIds })
  }, [updateState])

  const toggleAgentSelection = useCallback((agentId: string) => {
    const isSelected = state.selectedAgents.includes(agentId)
    const newSelection = isSelected
      ? state.selectedAgents.filter(id => id !== agentId)
      : [...state.selectedAgents, agentId]
    
    updateState({ selectedAgents: newSelection })
  }, [state.selectedAgents, updateState])

  const selectAllAgents = useCallback(() => {
    updateState({ selectedAgents: state.agents.map(agent => agent.id) })
  }, [state.agents, updateState])

  const clearSelection = useCallback(() => {
    updateState({ selectedAgents: [] })
  }, [updateState])

  const refreshAgent = useCallback(async (id: string) => {
    if (!accessToken) return

    try {
      const updatedAgent = await agentService.getAgent(accessToken, id)
      
      updateState({
        agents: state.agents.map(agent => 
          agent.id === id ? updatedAgent : agent
        )
      })
    } catch (error) {
      console.error('Failed to refresh agent:', error)
    }
  }, [accessToken, state.agents, updateState])

  const loadStatistics = useCallback(async () => {
    if (!accessToken) return

    try {
      const statistics = await agentService.getAgentStatistics(accessToken)
      updateState({ statistics })
    } catch (error) {
      console.error('Failed to load statistics:', error)
    }
  }, [accessToken, updateState])

  // 当筛选或分页改变时重新加载数据
  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  // 初始加载统计信息
  useEffect(() => {
    loadStatistics()
  }, [loadStatistics])

  return {
    ...state,
    loadAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    resetAgentKey,
    testConnection,
    performBatchOperation,
    setFilters,
    setPagination,
    setSelectedAgents,
    toggleAgentSelection,
    selectAllAgents,
    clearSelection,
    refreshAgent,
    loadStatistics
  }
}