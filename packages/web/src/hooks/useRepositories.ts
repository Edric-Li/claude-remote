import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/auth.store'
import { API_BASE_URL } from '../config'
import type { Repository } from '../types/api.types'

export interface UseRepositoriesState {
  repositories: Repository[]
  loading: boolean
  error: string | null
  selectedRepository: Repository | null
}

export interface UseRepositoriesActions {
  loadRepositories: () => Promise<void>
  selectRepository: (repository: Repository | null) => void
  refreshRepository: (id: string) => Promise<void>
  testConnection: (id: string) => Promise<any>
}

export function useRepositories(): UseRepositoriesState & UseRepositoriesActions {
  const { accessToken } = useAuthStore()
  
  const [state, setState] = useState<UseRepositoriesState>({
    repositories: [],
    loading: false,
    error: null,
    selectedRepository: null
  })

  const updateState = useCallback((updates: Partial<UseRepositoriesState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const loadRepositories = useCallback(async () => {
    if (!accessToken) return

    updateState({ loading: true, error: null })

    try {
      const response = await fetch(`${API_BASE_URL}/api/repositories`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const repositories = await response.json()
      
      updateState({
        repositories: Array.isArray(repositories) ? repositories : [],
        loading: false
      })
    } catch (error) {
      console.error('Failed to load repositories:', error)
      updateState({
        error: error instanceof Error ? error.message : 'Failed to load repositories',
        loading: false
      })
    }
  }, [accessToken, updateState])

  const selectRepository = useCallback((repository: Repository | null) => {
    updateState({ selectedRepository: repository })
  }, [updateState])

  const refreshRepository = useCallback(async (id: string) => {
    if (!accessToken) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/repositories/${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const updatedRepository = await response.json()
        
        updateState({
          repositories: state.repositories.map(repo => 
            repo.id === id ? updatedRepository : repo
          )
        })
      }
    } catch (error) {
      console.error('Failed to refresh repository:', error)
    }
  }, [accessToken, state.repositories, updateState])

  const testConnection = useCallback(async (id: string) => {
    if (!accessToken) throw new Error('No access token')

    try {
      const response = await fetch(`${API_BASE_URL}/api/repositories/${id}/test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      // 更新本地仓库的测试结果
      updateState({
        repositories: state.repositories.map(repo => 
          repo.id === id 
            ? { 
                ...repo, 
                metadata: {
                  ...repo.metadata,
                  lastTestResult: result,
                  lastTestDate: new Date().toISOString()
                }
              }
            : repo
        )
      })
      
      return result
    } catch (error) {
      console.error('Failed to test connection:', error)
      throw error
    }
  }, [accessToken, state.repositories, updateState])

  // 初始加载
  useEffect(() => {
    loadRepositories()
  }, [loadRepositories])

  return {
    ...state,
    loadRepositories,
    selectRepository,
    refreshRepository,
    testConnection
  }
}