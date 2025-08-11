import React, { useState, useEffect } from 'react'
import { Bot, X, Loader2, AlertCircle, Package, Server, Sparkles } from 'lucide-react'

interface Repository {
  id: string
  name: string
  url: string
  type: 'git' | 'local'
  status: 'active' | 'syncing' | 'error'
}

interface AiConfig {
  id: string
  name: string
  provider: string
  model: string
  isDefault: boolean
}

interface Agent {
  id: string
  name: string
  type: string
  status: 'online' | 'offline'
  lastConnectedAt?: Date
}

interface CreateAssistantModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateAssistantData) => Promise<void>
}

export interface CreateAssistantData {
  name: string
  description: string
  avatar: string
  aiConfigId: string
  repositoryIds: string[]
  agentId?: string
}

export function CreateAssistantModal({ isOpen, onClose, onSubmit }: CreateAssistantModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form data
  const [formData, setFormData] = useState<CreateAssistantData>({
    name: '',
    description: '',
    avatar: '🤖',
    aiConfigId: '',
    repositoryIds: [],
    agentId: undefined
  })

  // Available resources
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingResources, setLoadingResources] = useState(true)

  const avatarOptions = ['🤖', '👨‍💻', '👩‍💻', '🧑‍🎓', '👨‍🏫', '👩‍🏫', '🦾', '🧠', '⚡', '🌟', '🎯', '🚀']

  useEffect(() => {
    if (isOpen) {
      loadResources()
    }
  }, [isOpen])

  const loadResources = async () => {
    setLoadingResources(true)
    setError(null)

    try {
      // 获取用户的token
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('未登录')
      }

      // 并行加载所有资源
      const [reposResponse, configsResponse, agentsResponse] = await Promise.all([
        fetch('/api/repositories', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/ai-configs', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/agents', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      if (!reposResponse.ok || !configsResponse.ok || !agentsResponse.ok) {
        throw new Error('加载资源失败')
      }

      const [reposData, configsData, agentsData] = await Promise.all([
        reposResponse.json(),
        configsResponse.json(),
        agentsResponse.json()
      ])

      setRepositories(reposData)
      setAiConfigs(configsData)
      setAgents(agentsData)

      // 如果有默认的AI配置，自动选中
      const defaultConfig = configsData.find((c: AiConfig) => c.isDefault)
      if (defaultConfig) {
        setFormData(prev => ({ ...prev, aiConfigId: defaultConfig.id }))
      }
    } catch (err) {
      console.error('Failed to load resources:', err)
      setError(err instanceof Error ? err.message : '加载资源失败')
    } finally {
      setLoadingResources(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证表单
    if (!formData.name.trim()) {
      setError('请输入助手名称')
      return
    }

    if (!formData.aiConfigId) {
      setError('请选择AI配置')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSubmit(formData)
      // 重置表单
      setFormData({
        name: '',
        description: '',
        avatar: '🤖',
        aiConfigId: '',
        repositoryIds: [],
        agentId: undefined
      })
      onClose()
    } catch (err) {
      console.error('Failed to create assistant:', err)
      setError(err instanceof Error ? err.message : '创建助手失败')
    } finally {
      setLoading(false)
    }
  }

  const toggleRepository = (repoId: string) => {
    setFormData(prev => ({
      ...prev,
      repositoryIds: prev.repositoryIds.includes(repoId)
        ? prev.repositoryIds.filter(id => id !== repoId)
        : [...prev.repositoryIds, repoId]
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">创建新助手</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              disabled={loading}
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loadingResources ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-3 text-gray-400">加载资源中...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-400">{error}</p>
                  </div>
                </div>
              )}

              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-200">基本信息</h3>

                {/* Avatar Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">选择头像</label>
                  <div className="flex gap-2 flex-wrap">
                    {avatarOptions.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, avatar: emoji }))}
                        className={`text-2xl p-2 rounded-lg transition-all ${
                          formData.avatar === emoji
                            ? 'bg-blue-500/20 ring-2 ring-blue-500'
                            : 'bg-gray-800 hover:bg-gray-700'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">助手名称 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="例如：代码审查助手"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">描述</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="描述助手的功能和用途..."
                    rows={3}
                  />
                </div>
              </div>

              {/* AI Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-200">AI 配置</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    选择AI工具配置 *
                  </label>
                  <select
                    value={formData.aiConfigId}
                    onChange={e => setFormData(prev => ({ ...prev, aiConfigId: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">请选择AI配置</option>
                    {aiConfigs.map(config => (
                      <option key={config.id} value={config.id}>
                        {config.name} ({config.provider} - {config.model})
                        {config.isDefault && ' ⭐'}
                      </option>
                    ))}
                  </select>
                  {aiConfigs.length === 0 && (
                    <p className="mt-2 text-sm text-yellow-400">
                      还没有AI配置，请先在设置中创建AI工具配置
                    </p>
                  )}
                </div>
              </div>

              {/* Repository Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-200">
                  <Package className="inline w-5 h-5 mr-2" />
                  选择仓库
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {repositories.length > 0 ? (
                    repositories.map(repo => (
                      <label
                        key={repo.id}
                        className="flex items-center p-3 bg-gray-800 rounded-lg hover:bg-gray-750 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.repositoryIds.includes(repo.id)}
                          onChange={() => toggleRepository(repo.id)}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium">{repo.name}</span>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                repo.status === 'active'
                                  ? 'bg-green-500/20 text-green-400'
                                  : repo.status === 'syncing'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {repo.status}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{repo.url}</span>
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="text-gray-400 text-center py-4">还没有仓库，助手将无法访问代码</p>
                  )}
                </div>
              </div>

              {/* Agent Selection (Optional) */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-200">
                  <Server className="inline w-5 h-5 mr-2" />
                  选择Agent（可选）
                </h3>
                <div>
                  <select
                    value={formData.agentId || ''}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        agentId: e.target.value || undefined
                      }))
                    }
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">不指定Agent（使用默认）</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} - {agent.type}
                        {agent.status === 'online' ? ' 🟢' : ' 🔴'}
                      </option>
                    ))}
                  </select>
                  {agents.length === 0 && (
                    <p className="mt-2 text-sm text-gray-400">没有可用的Agent</p>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-800 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            disabled={loading}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || loadingResources}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" />
                创建助手
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
