import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus,
  GitBranch,
  Trash2,
  Edit,
  RefreshCw,
  TestTube,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  FolderOpen,
  Github,
  GitlabIcon,
  AlertCircle,
  Clock,
  Pause,
  Play,
  RotateCcw
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { API_BASE_URL } from '../../config'
import { SearchInput, type SearchState } from './SearchInput'
import { PaginationControls, type PaginationState } from './PaginationControls'
import { ConnectionTestIndicator } from './ConnectionTestIndicator'

interface Repository {
  id: string
  name: string
  description?: string
  url: string
  type: 'git' | 'local' | 'svn'
  branch?: string
  localPath?: string
  enabled: boolean
  credentials?: string
  settings?: {
    autoUpdate?: boolean
    cachePath?: string
  }
  createdAt: string
  updatedAt: string
}

interface RepositoryFormData {
  name: string
  description: string
  url: string
  type: 'git' | 'local'
  branch: string
  localPath: string
  credentials: string
  enabled: boolean
  autoUpdate: boolean
}

interface TestResult {
  success: boolean
  message: string
  details?: {
    branches?: string[]
    defaultBranch?: string
    isGitRepo?: boolean
    errorType?: string
  }
  retryCount?: number
  duration?: number
  timestamp?: string
  retryDetails?: Array<{
    attempt: number
    success: boolean
    error?: string
    duration: number
    timestamp: string
  }>
}

interface TestState {
  state: 'idle' | 'testing' | 'success' | 'error' | 'cancelled'
  progress: number
  retryCount: number
  maxRetries: number
  currentAttempt: number
  startTime?: number
  duration?: number
  canRetry: boolean
  cancelled: boolean
  result?: TestResult
}

interface TestProgress {
  [repoId: string]: TestState
}

interface SearchResult {
  repositories: Repository[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
  statistics?: {
    totalCount: number
    enabledCount: number
    disabledCount: number
    gitCount: number
    localCount: number
  }
}

interface ExtendedSearchState extends SearchState {
  results: SearchResult | null
  loading: boolean
  error: string | null
  isSearching: boolean
}


export function RepositoryManager() {
  const { accessToken } = useAuthStore()
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingRepo, setEditingRepo] = useState<Repository | null>(null)
  const [showCredentials, setShowCredentials] = useState<{ [key: string]: boolean }>({})
  const [testingConnection, setTestingConnection] = useState<{ [key: string]: boolean }>({})
  const [testResults, setTestResults] = useState<{ [key: string]: TestResult | null }>({})
  const [testProgress, setTestProgress] = useState<TestProgress>({})
  const testTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({})
  const testControllers = useRef<{ [key: string]: AbortController }>({})
  const [formData, setFormData] = useState<RepositoryFormData>({
    name: '',
    description: '',
    url: '',
    type: 'git',
    branch: 'main',
    localPath: '',
    credentials: '',
    enabled: true,
    autoUpdate: true
  })

  // 搜索状态管理
  const [searchState, setSearchState] = useState<ExtendedSearchState>({
    query: '',
    type: '',
    enabled: '',
    results: null,
    loading: false,
    error: null,
    isSearching: false
  })
  const [showFilters, setShowFilters] = useState(false)
  const [searchDebounceTimeout, setSearchDebounceTimeout] = useState<NodeJS.Timeout | null>(null)

  // 分页状态管理
  const [paginationState, setPaginationState] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
    loading: false,
    error: null
  })

  useEffect(() => {
    // 为了演示功能，加载模拟数据
    console.log('🚀 Component mounted, loading mock data...')
    loadMockData()
  }, [])

  // 模拟数据加载函数
  const loadMockData = () => {
    console.log('📦 loadMockData called')
    // 显示初始的5个仓库，分页功能将显示完整的15个仓库
    const initialRepositories: Repository[] = [
      {
        id: '1',
        name: 'React 官方仓库',
        description: 'React.js 官方 GitHub 仓库，用于学习和测试',
        url: 'https://github.com/facebook/react.git',
        type: 'git',
        branch: 'main',
        enabled: true,
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-20T14:45:00Z'
      },
      {
        id: '2',
        name: 'Vue.js 仓库',
        description: 'Vue.js 渐进式 JavaScript 框架',
        url: 'https://github.com/vuejs/vue.git',
        type: 'git',
        branch: 'dev',
        enabled: true,
        createdAt: '2024-01-10T09:15:00Z',
        updatedAt: '2024-01-18T16:20:00Z'
      },
      {
        id: '3',
        name: '本地项目',
        description: '本地开发项目目录',
        url: '/Users/developer/projects/myapp',
        type: 'local',
        localPath: '/Users/developer/projects/myapp',
        enabled: false,
        createdAt: '2024-01-12T08:00:00Z',
        updatedAt: '2024-01-12T08:00:00Z'
      },
      {
        id: '4',
        name: 'TypeScript 仓库',
        description: 'TypeScript 编程语言官方仓库',
        url: 'https://github.com/microsoft/TypeScript.git',
        type: 'git',
        branch: 'main',
        enabled: true,
        createdAt: '2024-01-08T11:30:00Z',
        updatedAt: '2024-01-22T13:10:00Z'
      },
      {
        id: '5',
        name: 'Node.js 仓库',
        description: 'Node.js JavaScript 运行时环境',
        url: 'https://github.com/nodejs/node.git',
        type: 'git',
        branch: 'main',
        enabled: true,
        createdAt: '2024-01-05T14:20:00Z',
        updatedAt: '2024-01-25T10:30:00Z'
      }
    ]
    
    console.log('💾 Setting repositories to:', initialRepositories.length, 'items')
    console.log('📝 Repository names:', initialRepositories.map(r => r.name))
    setRepositories(initialRepositories)
    setPaginationState({
      currentPage: 1,
      pageSize: 20,
      totalPages: 1,
      totalItems: 15, // 显示总共有15个仓库可分页
      loading: false,
      error: null
    })
    console.log('✅ Mock data loaded successfully')
  }

  // 防抖搜索功能
  const debouncedSearch = useCallback((searchQuery: string, searchType: string, searchEnabled: string) => {
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout)
    }

    const timeout = setTimeout(() => {
      performSearch(searchQuery, searchType, searchEnabled)
    }, 300) // 300ms 防抖延迟

    setSearchDebounceTimeout(timeout)
  }, [searchDebounceTimeout, repositories])

  // 本地搜索和过滤函数
  const performLocalSearch = (
    query: string, 
    type: string, 
    enabled: string, 
    allRepos: Repository[] = repositories
  ): Repository[] => {
    let filteredRepos = [...allRepos]

    // 按查询关键词过滤
    if (query && query.trim()) {
      const searchTerm = query.trim().toLowerCase()
      filteredRepos = filteredRepos.filter(repo => 
        repo.name.toLowerCase().includes(searchTerm) ||
        (repo.description && repo.description.toLowerCase().includes(searchTerm)) ||
        repo.url.toLowerCase().includes(searchTerm)
      )
    }

    // 按类型过滤
    if (type && type !== '') {
      filteredRepos = filteredRepos.filter(repo => repo.type === type)
    }

    // 按启用状态过滤
    if (enabled && enabled !== '') {
      const isEnabled = enabled === 'true'
      filteredRepos = filteredRepos.filter(repo => repo.enabled === isEnabled)
    }

    return filteredRepos
  }

  // 带分页的搜索函数
  const performSearchWithPagination = useCallback(async (
    query: string, 
    type: string, 
    enabled: string, 
    page: number = 1, 
    limit: number = 20
  ) => {
    // 如果没有搜索条件，显示所有仓库
    if (!query && !type && !enabled) {
      setSearchState(prev => ({
        ...prev,
        results: null,
        loading: false,
        error: null,
        isSearching: false
      }))
      
      // 更新分页状态为显示所有仓库
      setPaginationState(prev => ({
        ...prev,
        currentPage: 1,
        totalPages: Math.ceil(repositories.length / limit),
        totalItems: repositories.length,
        loading: false,
        error: null
      }))
      return
    }

    setSearchState(prev => ({
      ...prev,
      loading: true,
      error: null,
      isSearching: true
    }))

    setPaginationState(prev => ({ ...prev, loading: true, error: null }))

    // 模拟异步搜索（短暂延迟以显示加载状态）
    setTimeout(() => {
      try {
        // 执行本地搜索 - 如果repositories还没加载完，使用空数组
        const currentRepos = repositories.length > 0 ? repositories : []
        console.log('🗂️ Current repositories for search:', currentRepos.length)
        const filteredRepos = performLocalSearch(query, type, enabled, currentRepos)
        
        // 计算分页
        const startIndex = (page - 1) * limit
        const endIndex = startIndex + limit
        const paginatedRepos = filteredRepos.slice(startIndex, endIndex)
        const totalPages = Math.ceil(filteredRepos.length / limit)

        // 构建搜索结果
        const searchResult: SearchResult = {
          repositories: paginatedRepos,
          pagination: {
            total: filteredRepos.length,
            page: page,
            limit: limit,
            totalPages: totalPages
          },
          statistics: {
            totalCount: filteredRepos.length,
            enabledCount: filteredRepos.filter(r => r.enabled).length,
            disabledCount: filteredRepos.filter(r => !r.enabled).length,
            gitCount: filteredRepos.filter(r => r.type === 'git').length,
            localCount: filteredRepos.filter(r => r.type === 'local').length
          }
        }

        setSearchState(prev => ({
          ...prev,
          results: searchResult,
          loading: false,
          error: null
        }))
        
        // 更新分页状态
        setPaginationState(prev => ({
          ...prev,
          currentPage: page,
          totalPages: totalPages,
          totalItems: filteredRepos.length,
          loading: false,
          error: null
        }))
      } catch (error) {
        console.error('Local search failed:', error)
        const errorMessage = '搜索失败，请重试'
        setSearchState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage
        }))
        setPaginationState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage
        }))
      }
    }, 200) // 200ms 延迟模拟搜索过程
  }, [repositories]) // 依赖 repositories 状态

  // 执行搜索（兼容性保留，默认第一页）
  const performSearch = useCallback(async (query: string, type: string, enabled: string) => {
    await performSearchWithPagination(query, type, enabled, 1, paginationState.pageSize)
  }, [performSearchWithPagination, paginationState.pageSize])

  // 处理搜索输入变化
  const handleSearchChange = useCallback((field: keyof SearchState, value: string) => {
    setSearchState(prev => {
      const newState = {
        ...prev,
        [field]: value
      }
      
      // 触发防抖搜索
      debouncedSearch(newState.query, newState.type, newState.enabled)
      
      return newState
    })
  }, [debouncedSearch])

  // 清除搜索
  const clearSearch = useCallback(() => {
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout)
    }
    setSearchState({
      query: '',
      type: '',
      enabled: '',
      results: null,
      loading: false,
      error: null,
      isSearching: false
    })
    
    // 清除搜索后，重置分页状态显示所有仓库
    setPaginationState(prev => ({
      ...prev,
      currentPage: 1,
      totalPages: Math.ceil(repositories.length / prev.pageSize),
      totalItems: repositories.length,
      loading: false,
      error: null
    }))
  }, [searchDebounceTimeout, repositories.length])

  // 获取要显示的仓库列表（搜索结果或全部仓库）
  const displayRepositories = useMemo(() => {
    return searchState.results ? searchState.results.repositories : repositories
  }, [searchState.results, repositories])

  // 检查是否有活跃的搜索
  const hasActiveSearch = useMemo(() => {
    return Boolean(searchState.query || searchState.type || searchState.enabled)
  }, [searchState.query, searchState.type, searchState.enabled])

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (searchDebounceTimeout) {
        clearTimeout(searchDebounceTimeout)
      }
    }
  }, [searchDebounceTimeout])

  // 组件卸载时清理所有测试相关的定时器和控制器
  useEffect(() => {
    return () => {
      // 清理所有测试控制器
      Object.values(testControllers.current).forEach(controller => {
        controller.abort()
      })
      testControllers.current = {}

      // 清理所有测试定时器
      Object.values(testTimeouts.current).forEach(timeout => {
        clearTimeout(timeout)
      })
      testTimeouts.current = {}
    }
  }, [])

  // 分页导航函数
  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > paginationState.totalPages || page === paginationState.currentPage) {
      return
    }
    
    setPaginationState(prev => ({ ...prev, currentPage: page }))
    
    // 如果有搜索条件，使用搜索API，否则使用常规分页API
    if (hasActiveSearch) {
      // 使用当前搜索条件重新搜索指定页面
      performSearchWithPagination(searchState.query, searchState.type, searchState.enabled, page, paginationState.pageSize)
    } else {
      // 加载指定页面的仓库列表
      loadRepositoriesWithPagination(page, paginationState.pageSize)
    }
  }, [paginationState.currentPage, paginationState.totalPages, paginationState.pageSize, hasActiveSearch, searchState])

  const changePageSize = useCallback((newPageSize: number) => {
    if (newPageSize === paginationState.pageSize) return
    
    setPaginationState(prev => ({
      ...prev,
      pageSize: newPageSize,
      currentPage: 1 // 重置到第一页
    }))
    
    // 重新加载数据
    if (hasActiveSearch) {
      performSearchWithPagination(searchState.query, searchState.type, searchState.enabled, 1, newPageSize)
    } else {
      loadRepositoriesWithPagination(1, newPageSize)
    }
  }, [paginationState.pageSize, hasActiveSearch, searchState])

  // 本地分页处理函数
  const loadRepositoriesWithPagination = async (page: number = 1, limit: number = 20) => {
    try {
      setPaginationState(prev => ({ ...prev, loading: true, error: null }))
      
      // 模拟异步操作（短暂延迟以显示加载状态）
      setTimeout(() => {
        // 使用扩展的模拟数据进行分页测试（15个仓库）
        const mockRepositories = [
          {
            id: '1',
            name: 'React 官方仓库',
            description: 'React.js 官方 GitHub 仓库，用于学习和测试',
            url: 'https://github.com/facebook/react.git',
            type: 'git',
            branch: 'main',
            enabled: true,
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-20T14:45:00Z'
          },
          {
            id: '2',
            name: 'Vue.js 仓库',
            description: 'Vue.js 渐进式 JavaScript 框架',
            url: 'https://github.com/vuejs/vue.git',
            type: 'git',
            branch: 'dev',
            enabled: true,
            createdAt: '2024-01-10T09:15:00Z',
            updatedAt: '2024-01-18T16:20:00Z'
          },
          {
            id: '3',
            name: '本地项目',
            description: '本地开发项目目录',
            url: '/Users/developer/projects/myapp',
            type: 'local',
            localPath: '/Users/developer/projects/myapp',
            enabled: false,
            createdAt: '2024-01-12T08:00:00Z',
            updatedAt: '2024-01-12T08:00:00Z'
          },
          {
            id: '4',
            name: 'TypeScript 仓库',
            description: 'TypeScript 编程语言官方仓库',
            url: 'https://github.com/microsoft/TypeScript.git',
            type: 'git',
            branch: 'main',
            enabled: true,
            createdAt: '2024-01-08T11:30:00Z',
            updatedAt: '2024-01-22T13:10:00Z'
          },
          {
            id: '5',
            name: 'Node.js 仓库',
            description: 'Node.js JavaScript 运行时环境',
            url: 'https://github.com/nodejs/node.git',
            type: 'git',
            branch: 'main',
            enabled: true,
            createdAt: '2024-01-05T14:20:00Z',
            updatedAt: '2024-01-25T10:30:00Z'
          },
          {
            id: '6',
            name: 'Angular 仓库',
            description: 'Angular Web 应用框架',
            url: 'https://github.com/angular/angular.git',
            type: 'git',
            branch: 'main',
            enabled: true,
            createdAt: '2024-01-03T09:00:00Z',
            updatedAt: '2024-01-26T11:15:00Z'
          },
          {
            id: '7',
            name: 'Express.js 仓库',
            description: 'Node.js Web 应用框架',
            url: 'https://github.com/expressjs/express.git',
            type: 'git',
            branch: 'master',
            enabled: true,
            createdAt: '2024-01-02T14:30:00Z',
            updatedAt: '2024-01-27T16:45:00Z'
          },
          {
            id: '8',
            name: 'Webpack 仓库',
            description: '模块打包工具',
            url: 'https://github.com/webpack/webpack.git',
            type: 'git',
            branch: 'main',
            enabled: false,
            createdAt: '2024-01-01T12:00:00Z',
            updatedAt: '2024-01-28T10:30:00Z'
          },
          {
            id: '9',
            name: 'Vite 仓库',
            description: '现代前端构建工具',
            url: 'https://github.com/vitejs/vite.git',
            type: 'git',
            branch: 'main',
            enabled: true,
            createdAt: '2023-12-30T15:20:00Z',
            updatedAt: '2024-01-29T09:15:00Z'
          },
          {
            id: '10',
            name: 'Jest 仓库',
            description: 'JavaScript 测试框架',
            url: 'https://github.com/facebook/jest.git',
            type: 'git',
            branch: 'main',
            enabled: true,
            createdAt: '2023-12-28T11:45:00Z',
            updatedAt: '2024-01-30T14:20:00Z'
          },
          {
            id: '11',
            name: 'Prettier 仓库',
            description: '代码格式化工具',
            url: 'https://github.com/prettier/prettier.git',
            type: 'git',
            branch: 'main',
            enabled: true,
            createdAt: '2023-12-25T08:30:00Z',
            updatedAt: '2024-01-31T12:45:00Z'
          },
          {
            id: '12',
            name: 'ESLint 仓库',
            description: 'JavaScript 代码检查工具',
            url: 'https://github.com/eslint/eslint.git',
            type: 'git',
            branch: 'main',
            enabled: false,
            createdAt: '2023-12-22T16:10:00Z',
            updatedAt: '2024-02-01T15:30:00Z'
          },
          {
            id: '13',
            name: 'Tailwind CSS',
            description: '实用优先的CSS框架',
            url: 'https://github.com/tailwindlabs/tailwindcss.git',
            type: 'git',
            branch: 'master',
            enabled: true,
            createdAt: '2023-12-20T13:25:00Z',
            updatedAt: '2024-02-02T17:40:00Z'
          },
          {
            id: '14',
            name: 'Styled Components',
            description: 'CSS-in-JS 库',
            url: 'https://github.com/styled-components/styled-components.git',
            type: 'git',
            branch: 'main',
            enabled: true,
            createdAt: '2023-12-18T10:15:00Z',
            updatedAt: '2024-02-03T08:50:00Z'
          },
          {
            id: '15',
            name: 'Lodash 仓库',
            description: 'JavaScript 实用工具库',
            url: 'https://github.com/lodash/lodash.git',
            type: 'git',
            branch: 'master',
            enabled: true,
            createdAt: '2023-12-15T14:55:00Z',
            updatedAt: '2024-02-04T11:25:00Z'
          }
        ]

        // 计算分页
        const startIndex = (page - 1) * limit
        const endIndex = startIndex + limit
        const paginatedRepos = mockRepositories.slice(startIndex, endIndex)
        const totalPages = Math.ceil(mockRepositories.length / limit)

        console.log(`📄 Local pagination: page ${page}, limit ${limit}, showing ${paginatedRepos.length} of ${mockRepositories.length} repos`)

        // 更新仓库数据（如果是第一页，或者没有活跃搜索）
        if (!hasActiveSearch) {
          setRepositories(paginatedRepos)
        }
        
        // 更新分页状态
        setPaginationState(prev => ({
          ...prev,
          currentPage: page,
          totalPages: totalPages,
          totalItems: mockRepositories.length,
          loading: false,
          error: null
        }))
      }, 100) // 100ms 延迟模拟加载
    } catch (error) {
      console.error('Failed to load repositories with pagination:', error)
      setPaginationState(prev => ({
        ...prev,
        loading: false,
        error: '加载仓库列表失败，请重试'
      }))
    }
  }

  // 传统加载函数（兼容性保留）
  const loadRepositories = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/repositories`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setRepositories(data)
        
        // 更新分页状态（如果API返回分页信息）
        if (data.pagination) {
          setPaginationState(prev => ({
            ...prev,
            currentPage: data.pagination.page || 1,
            totalPages: data.pagination.totalPages || 1,
            totalItems: data.pagination.total || data.length || 0
          }))
        } else {
          // 如果没有分页信息，假设是所有数据
          setPaginationState(prev => ({
            ...prev,
            currentPage: 1,
            totalPages: 1,
            totalItems: data.length || 0
          }))
        }
      }
    } catch (error) {
      console.error('Failed to load repositories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // 先测试连接
      const testData = {
        url: formData.type === 'git' ? formData.url : undefined,
        localPath: formData.type === 'local' ? formData.localPath : undefined,
        type: formData.type,
        credentials: formData.credentials || undefined
      }

      const testResponse = await fetch(`${API_BASE_URL}/repositories/test-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(testData)
      })

      const testResult = await testResponse.json()
      if (!testResult.success) {
        alert(`连接测试失败: ${testResult.message}`)
        return
      }

      // 连接成功，保存仓库
      const method = editingRepo ? 'PUT' : 'POST'
      const url = editingRepo
        ? `${API_BASE_URL}/repositories/${editingRepo.id}`
        : `${API_BASE_URL}/repositories`

      const repoData: any = {
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        branch: formData.branch || testResult.details?.defaultBranch || 'main',
        status: formData.enabled ? 'active' : 'inactive'
      }

      // 添加URL或本地路径
      if (formData.type === 'git') {
        repoData.url = formData.url
      } else {
        repoData.url = formData.localPath // 后端使用url字段存储路径
      }

      // 处理认证信息
      if (formData.credentials) {
        // 如果是 username:password 格式，分开处理
        if (formData.credentials.includes(':')) {
          const [username, password] = formData.credentials.split(':')
          repoData.username = username
          repoData.password = password
        } else {
          // 如果是token，存储在password字段
          repoData.password = formData.credentials
        }
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify(repoData)
      })

      if (response.ok) {
        await loadRepositories()
        resetForm()
        alert('仓库保存成功')
      } else {
        const error = await response.json()
        alert(`保存失败: ${error.message}`)
      }
    } catch (error) {
      console.error('Failed to save repository:', error)
      alert('保存失败，请重试')
    }
  }

  // 初始化测试状态
  const initTestState = (repoId: string): TestState => {
    return {
      state: 'idle',
      progress: 0,
      retryCount: 0,
      maxRetries: 3,
      currentAttempt: 0,
      canRetry: false,
      cancelled: false
    }
  }

  // 更新测试状态
  const updateTestState = useCallback((repoId: string, updates: Partial<TestState>) => {
    setTestProgress(prev => ({
      ...prev,
      [repoId]: {
        ...prev[repoId] || initTestState(repoId),
        ...updates
      }
    }))
  }, [])

  // 取消测试
  const cancelTest = useCallback((repoId: string) => {
    // 取消正在进行的请求
    if (testControllers.current[repoId]) {
      testControllers.current[repoId].abort()
      delete testControllers.current[repoId]
    }

    // 清除超时定时器
    if (testTimeouts.current[repoId]) {
      clearTimeout(testTimeouts.current[repoId])
      delete testTimeouts.current[repoId]
    }

    // 更新状态
    updateTestState(repoId, {
      state: 'cancelled',
      cancelled: true,
      duration: testProgress[repoId]?.startTime 
        ? Date.now() - testProgress[repoId].startTime 
        : 0
    })

    setTestingConnection(prev => ({ ...prev, [repoId]: false }))
  }, [testProgress, updateTestState])

  // 重试测试
  const retryTest = useCallback((repo: Repository) => {
    const currentState = testProgress[repo.id]
    if (currentState?.canRetry) {
      handleTestConnection(repo)
    }
  }, [testProgress])

  // 模拟进度更新
  const simulateProgress = useCallback((repoId: string, duration: number = 15000) => {
    const startTime = Date.now()
    const interval = 100 // 每100ms更新一次
    const steps = duration / interval
    let currentStep = 0

    const progressInterval = setInterval(() => {
      currentStep++
      const progress = Math.min((currentStep / steps) * 100, 99) // 最大99%，等待实际结果
      
      updateTestState(repoId, { 
        progress,
        duration: Date.now() - startTime
      })

      if (currentStep >= steps) {
        clearInterval(progressInterval)
      }
    }, interval)

    // 保存interval用于清理
    testTimeouts.current[repoId + '_progress'] = progressInterval

    return () => clearInterval(progressInterval)
  }, [updateTestState])

  const handleTestConnection = async (repo: Repository) => {
    const repoId = repo.id
    
    // 如果已经在测试中，不重复测试
    if (testingConnection[repoId]) {
      return
    }

    // 创建中止控制器
    const controller = new AbortController()
    testControllers.current[repoId] = controller

    // 初始化测试状态
    const startTime = Date.now()
    updateTestState(repoId, {
      state: 'testing',
      progress: 0,
      retryCount: 0,
      currentAttempt: 1,
      startTime,
      cancelled: false,
      canRetry: false,
      result: undefined
    })

    setTestingConnection(prev => ({ ...prev, [repoId]: true }))
    setTestResults(prev => ({ ...prev, [repoId]: null }))

    // 开始进度模拟
    const clearProgress = simulateProgress(repoId)

    // 设置15秒超时
    const timeoutId = setTimeout(() => {
      cancelTest(repoId)
      updateTestState(repoId, {
        state: 'error',
        progress: 100,
        result: {
          success: false,
          message: '测试超时（15秒）',
          details: { errorType: 'timeout' }
        },
        canRetry: true
      })
    }, 15000)
    testTimeouts.current[repoId] = timeoutId

    try {
      // 使用带重试的API端点
      const response = await fetch(`${API_BASE_URL}/repositories/${repo.id}/test-with-retry`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 5000
        })
      })

      // 清除超时和进度
      clearTimeout(timeoutId)
      clearProgress()
      delete testTimeouts.current[repoId]
      delete testControllers.current[repoId]

      const result = await response.json()
      const duration = Date.now() - startTime

      if (result.success) {
        updateTestState(repoId, {
          state: 'success',
          progress: 100,
          duration,
          retryCount: result.retryCount || 0,
          result,
          canRetry: false
        })
        setTestResults(prev => ({ ...prev, [repoId]: result }))
      } else {
        updateTestState(repoId, {
          state: 'error',
          progress: 100,
          duration,
          retryCount: result.retryCount || 0,
          result,
          canRetry: result.details?.errorType ? ['timeout', 'network', 'connection_reset', 'dns_resolution'].includes(result.details.errorType) : true
        })
        setTestResults(prev => ({ ...prev, [repoId]: result }))
      }
    } catch (error: any) {
      // 清除超时和进度
      clearTimeout(timeoutId)
      clearProgress()
      delete testTimeouts.current[repoId]
      delete testControllers.current[repoId]

      const duration = Date.now() - startTime

      if (error.name === 'AbortError') {
        // 用户取消的测试
        updateTestState(repoId, {
          state: 'cancelled',
          progress: 100,
          duration,
          result: {
            success: false,
            message: '测试已取消',
            details: { errorType: 'cancelled' }
          },
          canRetry: true
        })
      } else {
        // 网络错误或其他错误
        updateTestState(repoId, {
          state: 'error',
          progress: 100,
          duration,
          result: {
            success: false,
            message: '测试失败: 网络错误',
            details: { errorType: 'network' }
          },
          canRetry: true
        })
        setTestResults(prev => ({
          ...prev,
          [repoId]: {
            success: false,
            message: '测试失败: 网络错误',
            details: { errorType: 'network' }
          }
        }))
      }
    } finally {
      setTestingConnection(prev => ({ ...prev, [repoId]: false }))
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除仓库 "${name}" 吗？此操作不可恢复。`)) {
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/repositories/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        await loadRepositories()
      }
    } catch (error) {
      console.error('Failed to delete repository:', error)
      alert('删除失败，请重试')
    }
  }

  const handleEdit = (repo: Repository) => {
    setEditingRepo(repo)
    setFormData({
      name: repo.name,
      description: repo.description || '',
      url: repo.url || '',
      type: repo.type as 'git' | 'local',
      branch: repo.branch || 'main',
      localPath: repo.localPath || '',
      credentials: '',
      enabled: repo.enabled,
      autoUpdate: repo.settings?.autoUpdate || false
    })
    setShowForm(true)  // 显示编辑表单
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      url: '',
      type: 'git',
      branch: 'main',
      localPath: '',
      credentials: '',
      enabled: true,
      autoUpdate: true
    })
    setEditingRepo(null)
    setShowForm(false)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('已复制到剪贴板')
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const getRepoIcon = (type: string, url?: string) => {
    if (type === 'local') return <FolderOpen className="w-4 h-4" />
    if (url?.includes('github.com')) return <Github className="w-4 h-4" />
    if (url?.includes('gitlab.com')) return <GitlabIcon className="w-4 h-4" />
    return <GitBranch className="w-4 h-4" />
  }

  const getCredentialPlaceholder = () => {
    if (formData.url.includes('github.com')) {
      return 'GitHub Personal Access Token (ghp_xxxx)'
    } else if (formData.url.includes('gitlab.com')) {
      return 'GitLab Personal/Project Access Token'
    } else if (formData.url.includes('bitbucket.org')) {
      return 'username:app_password'
    } else {
      return 'username:password 或 token'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">加载中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部操作 */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">仓库管理</h3>
          <p className="text-sm text-gray-600">管理代码仓库和项目源</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加仓库
        </button>
      </div>

      {/* 搜索和过滤器 */}
      <SearchInput
        searchState={searchState}
        onSearchChange={handleSearchChange}
        onClearSearch={clearSearch}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        hasActiveSearch={hasActiveSearch}
        loading={searchState.loading}
        placeholder="搜索仓库名称或描述..."
        debounceDelay={300}
      />

      {/* 搜索状态显示 */}
      {(searchState.loading || searchState.error || searchState.results) && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
          {searchState.loading && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              搜索中...
            </div>
          )}
          
          {searchState.error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              <XCircle className="w-4 h-4" />
              {searchState.error}
            </div>
          )}
          
          {searchState.results && (
            <div className="text-sm text-gray-600">
              找到 {searchState.results.pagination.total} 个仓库
              {searchState.results.statistics && (
                <span className="ml-2 text-xs">
                  (已启用: {searchState.results.statistics.enabledCount}, 
                  Git: {searchState.results.statistics.gitCount}, 
                  本地: {searchState.results.statistics.localCount})
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 仓库列表 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {displayRepositories.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <GitBranch className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h4 className="font-medium text-gray-900 mb-2">
              {hasActiveSearch ? '没有找到匹配的仓库' : '还没有配置仓库'}
            </h4>
            <p className="text-sm mb-4">
              {hasActiveSearch ? '尝试调整搜索条件或清除搜索' : '添加您的第一个代码仓库开始使用'}
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              添加仓库
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {displayRepositories.map(repo => (
              <div key={repo.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getRepoIcon(repo.type, repo.url)}
                      <h4 className="font-medium text-gray-900">{repo.name}</h4>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          repo.enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {repo.enabled ? '已启用' : '已禁用'}
                      </span>
                      {repo.type === 'git' && repo.branch && (
                        <span className="text-xs text-gray-500">
                          分支: {repo.branch}
                        </span>
                      )}
                    </div>

                    {repo.description && (
                      <p className="text-sm text-gray-600 mb-2">{repo.description}</p>
                    )}

                    <div className="text-xs text-gray-500 space-y-1">
                      {repo.type === 'git' && repo.url && (
                        <div className="flex items-center gap-2">
                          <span>URL:</span>
                          <code className="bg-gray-50 px-2 py-1 rounded">{repo.url}</code>
                          <button
                            onClick={() => copyToClipboard(repo.url)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {repo.type === 'local' && repo.localPath && (
                        <div className="flex items-center gap-2">
                          <span>路径:</span>
                          <code className="bg-gray-50 px-2 py-1 rounded">{repo.localPath}</code>
                        </div>
                      )}
                    </div>

                    {/* 测试进度指示器 */}
                    {testProgress[repo.id] && (
                      <ConnectionTestIndicator
                        testState={testProgress[repo.id]}
                        onCancel={() => cancelTest(repo.id)}
                        onRetry={() => retryTest(repo)}
                        variant="detailed"
                        className="mt-3"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleTestConnection(repo)}
                      disabled={testingConnection[repo.id] || testProgress[repo.id]?.state === 'testing'}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                      title={
                        testProgress[repo.id]?.state === 'testing'
                          ? '测试进行中...'
                          : testProgress[repo.id]?.canRetry
                          ? '重试连接测试'
                          : '测试连接'
                      }
                    >
                      {testingConnection[repo.id] || testProgress[repo.id]?.state === 'testing' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : testProgress[repo.id]?.canRetry && testProgress[repo.id]?.state === 'error' ? (
                        <RotateCcw className="w-4 h-4" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(repo)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(repo.id, repo.name)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 分页控件 */}
      {(paginationState.totalPages > 1 || displayRepositories.length > 0) && (
        <PaginationControls
          paginationState={paginationState}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
          pageSizeOptions={[10, 20, 50]}
          maxVisiblePages={5}
          showPageSizeSelector={true}
          showInfo={true}
          itemType="仓库"
          disabled={false}
        />
      )}

      {/* 添加/编辑表单模态框 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingRepo ? '编辑仓库' : '添加仓库'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      仓库名称 *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                      placeholder="输入仓库名称"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      仓库类型
                    </label>
                    <select
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value as 'git' | 'local' })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    >
                      <option value="git">Git仓库</option>
                      <option value="local">本地目录</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    描述
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    rows={2}
                    placeholder="仓库描述（可选）"
                  />
                </div>

                {formData.type === 'git' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Git URL *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.url}
                        onChange={e => setFormData({ ...formData, url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                        placeholder="https://github.com/user/repo.git"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        支持 GitHub、GitLab、Bitbucket 等 Git 仓库
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          分支
                        </label>
                        <input
                          type="text"
                          value={formData.branch}
                          onChange={e => setFormData({ ...formData, branch: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                          placeholder="main"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          认证凭据
                        </label>
                        <div className="relative">
                          <input
                            type={showCredentials[editingRepo?.id || 'new'] ? 'text' : 'password'}
                            value={formData.credentials}
                            onChange={e => setFormData({ ...formData, credentials: e.target.value })}
                            className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                            placeholder={getCredentialPlaceholder()}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowCredentials(prev => ({
                                ...prev,
                                [editingRepo?.id || 'new']: !prev[editingRepo?.id || 'new']
                              }))
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                          >
                            {showCredentials[editingRepo?.id || 'new'] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        {!editingRepo && (
                          <p className="text-xs text-gray-500 mt-1">
                            留空表示公开仓库
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      本地路径 *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.localPath}
                      onChange={e => setFormData({ ...formData, localPath: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                      placeholder="/path/to/repository"
                    />
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">启用仓库</span>
                  </label>

                  {formData.type === 'git' && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.autoUpdate}
                        onChange={e => setFormData({ ...formData, autoUpdate: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">任务前自动拉取最新代码</span>
                    </label>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    {editingRepo ? '保存更改' : '添加仓库'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}