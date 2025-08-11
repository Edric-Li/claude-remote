import React, { useState, useEffect } from 'react'
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
  GitlabIcon
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { API_BASE_URL } from '../../config'

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

  useEffect(() => {
    loadRepositories()
  }, [])

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

  const handleTestConnection = async (repo: Repository) => {
    setTestingConnection(prev => ({ ...prev, [repo.id]: true }))
    setTestResults(prev => ({ ...prev, [repo.id]: null }))

    try {
      const response = await fetch(`${API_BASE_URL}/repositories/${repo.id}/test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      const result = await response.json()
      setTestResults(prev => ({ ...prev, [repo.id]: result }))
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [repo.id]: {
          success: false,
          message: '测试失败: 网络错误'
        }
      }))
    } finally {
      setTestingConnection(prev => ({ ...prev, [repo.id]: false }))
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

      {/* 仓库列表 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {repositories.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <GitBranch className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h4 className="font-medium text-gray-900 mb-2">还没有配置仓库</h4>
            <p className="text-sm mb-4">添加您的第一个代码仓库开始使用</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              添加仓库
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {repositories.map(repo => (
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

                    {/* 测试结果显示 */}
                    {testResults[repo.id] && (
                      <div
                        className={`mt-3 p-2 rounded text-xs ${
                          testResults[repo.id]!.success
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-red-50 border border-red-200 text-red-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {testResults[repo.id]!.success ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          <span>{testResults[repo.id]!.message}</span>
                        </div>
                        {testResults[repo.id]!.details?.branches && (
                          <div className="mt-1 text-xs opacity-75">
                            可用分支: {testResults[repo.id]!.details!.branches!.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleTestConnection(repo)}
                      disabled={testingConnection[repo.id]}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                      title="测试连接"
                    >
                      {testingConnection[repo.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
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