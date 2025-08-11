import React, { useState, useEffect } from 'react'
import { 
  Plus, Database, Trash2, Edit, RefreshCw, 
  CheckCircle, XCircle, AlertCircle, Eye, EyeOff,
  FolderOpen, TestTube
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'

interface Repository {
  id: string
  name: string
  type: 'git' | 'local'
  url: string
  branch: string
  username?: string
  status: 'active' | 'inactive' | 'error'
  description?: string
  lastSync?: Date
}

interface RepositoryFormData {
  name: string
  type: 'git' | 'local'
  url: string
  branch: string
  username: string
  password: string
  description: string
}

interface TestResult {
  success: boolean
  message: string
  details?: {
    branches: string[]
    defaultBranch: string
  }
}

export function RepositorySettings() {
  const { accessToken } = useAuthStore()
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingRepo, setEditingRepo] = useState<Repository | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [testingForm, setTestingForm] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [availableBranches, setAvailableBranches] = useState<string[]>([])
  const [formData, setFormData] = useState<RepositoryFormData>({
    name: '',
    type: 'git',
    url: '',
    branch: 'main',
    username: '',
    password: '',
    description: ''
  })

  useEffect(() => {
    loadRepositories()
  }, [])

  const loadRepositories = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/repositories', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
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
      const method = editingRepo ? 'PUT' : 'POST'
      const url = editingRepo ? `/api/repositories/${editingRepo.id}` : '/api/repositories'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await loadRepositories()
        resetForm()
      } else {
        const error = await response.json()
        alert(`操作失败: ${error.message}`)
      }
    } catch (error) {
      console.error('Failed to save repository:', error)
      alert('保存失败，请重试')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除仓库 "${name}" 吗？此操作不可恢复。`)) {
      return
    }

    try {
      const response = await fetch(`/api/repositories/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
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

  const handleTestConnection = async (id: string) => {
    try {
      const response = await fetch(`/api/repositories/${id}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      const result = await response.json()
      
      if (result.success) {
        let message = result.message || '连接成功'
        if (result.details?.branches) {
          message += `\n\n发现 ${result.details.branches.length} 个分支：\n${result.details.branches.slice(0, 5).join(', ')}`
          if (result.details.branches.length > 5) {
            message += ` 等${result.details.branches.length}个分支`
          }
          message += `\n\n默认分支：${result.details.defaultBranch}`
        }
        alert(message)
      } else {
        alert(result.message || '连接失败')
      }
      
      if (result.success) {
        await loadRepositories()
      }
    } catch (error) {
      console.error('Failed to test connection:', error)
      alert('连接测试失败')
    }
  }

  // 测试表单中的仓库配置
  const testFormConfig = async () => {
    if (formData.type === 'local') {
      if (!formData.url?.trim()) {
        setTestResult({ success: false, message: '请先填写本地路径' })
        return
      }
    } else {
      if (!formData.url?.trim()) {
        setTestResult({ success: false, message: '请先填写仓库URL' })
        return
      }
    }

    setTestingForm(true)
    setTestResult(null)
    
    try {
      const testData = {
        url: formData.url || '',
        type: formData.type || 'git',
        branch: formData.branch || 'main',
        username: formData.username || '',
        password: formData.password || ''
      }
      
      const testResponse = await fetch(`/api/repositories/test-config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      })
      
      if (!testResponse.ok) {
        const error = await testResponse.json().catch(() => ({ message: '未知错误' }))
        setTestResult({ 
          success: false, 
          message: `❌ ${error.message || '测试失败'}` 
        })
        return
      }
      
      const result = await testResponse.json()
      
      // 构建详细的结果信息
      let message = result.message
      if (result.success && result.details?.branches) {
        setAvailableBranches(result.details.branches)
        
        // 如果当前没有选择分支，或选择的分支不在列表中，使用默认分支
        if (!formData.branch || !result.details.branches.includes(formData.branch)) {
          setFormData(prev => ({ ...prev, branch: result.details.defaultBranch || 'main' }))
        }
        
        message = `✅ ${message}\n找到 ${result.details.branches.length} 个分支`
      } else if (!result.success) {
        message = `❌ ${message}`
        setAvailableBranches([])
      }
      
      setTestResult({ success: result.success, message, details: result.details })
    } catch (error) {
      setTestResult({ success: false, message: '测试失败：网络错误' })
    } finally {
      setTestingForm(false)
    }
  }

  // 创建工作区
  const handleCreateWorkspace = async (id: string) => {
    try {
      const response = await fetch(`/api/repositories/${id}/workspace`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workerId: 'test-worker' })
      })
      const result = await response.json()
      if (result.success) {
        alert(`工作区创建成功: ${result.workspaceDir}`)
      } else {
        alert('创建工作区失败: ' + (result.message || '未知错误'))
      }
    } catch (error) {
      alert('创建工作区失败: 网络错误')
    }
  }

  const handleEdit = (repo: Repository) => {
    setEditingRepo(repo)
    setFormData({
      name: repo.name,
      type: repo.type,
      url: repo.url,
      branch: repo.branch,
      username: repo.username || '',
      password: '',
      description: repo.description || ''
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'git',
      url: '',
      branch: 'main',
      username: '',
      password: '',
      description: ''
    })
    setEditingRepo(null)
    setShowForm(false)
    setShowPassword(false)
    setTestResult(null)
    setTestingForm(false)
    setAvailableBranches([])
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '活跃'
      case 'error':
        return '错误'
      default:
        return '非活跃'
    }
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700'
      case 'error':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-yellow-100 text-yellow-700'
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
          <p className="text-sm text-gray-600">管理您的代码仓库和访问权限</p>
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
            <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
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
            {repositories.map((repo) => (
              <div key={repo.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">{repo.name}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${getStatusBgColor(repo.status)}`}>
                        {getStatusIcon(repo.status)}
                        {getStatusText(repo.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{repo.url}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>类型: {repo.type.toUpperCase()}</span>
                      <span>分支: {repo.branch}</span>
                      {repo.lastSync && (
                        <span>最后同步: {new Date(repo.lastSync).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(repo.id)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="测试连接"
                    >
                      <TestTube className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCreateWorkspace(repo.id)}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                      title="创建工作区"
                    >
                      <FolderOpen className="w-4 h-4" />
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
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingRepo ? '编辑仓库' : '添加仓库'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">仓库名称</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    placeholder="输入仓库名称"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">仓库类型</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'git' | 'local' })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                  >
                    <option value="git">Git仓库</option>
                    <option value="local">本地目录</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.type === 'git' ? '仓库URL' : '本地路径'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    placeholder={formData.type === 'git' ? 'https://github.com/user/repo.git' : '/path/to/local/directory'}
                  />
                </div>

                {formData.type === 'git' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">分支</label>
                      {availableBranches.length > 0 ? (
                        <select
                          value={formData.branch}
                          onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                        >
                          {availableBranches.map((branch) => (
                            <option key={branch} value={branch}>{branch}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={formData.branch}
                          onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                          placeholder="main（请先测试连接以获取分支列表）"
                        />
                      )}
                      {availableBranches.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          共 {availableBranches.length} 个分支，已从仓库获取
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">用户名（可选）</label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                        placeholder="Git用户名"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">密码/Token（可选）</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                          placeholder="密码或Personal Access Token"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    rows={3}
                    placeholder="仓库描述"
                  />
                </div>

                {/* 测试结果显示 */}
                {testResult && (
                  <div className={`p-3 rounded-lg border ${
                    testResult.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-start gap-2">
                      {testResult.success ? (
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                        <pre className="whitespace-pre-wrap font-sans">{testResult.message}</pre>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <button
                    type="button"
                    onClick={testFormConfig}
                    disabled={testingForm}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {testingForm ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        测试中...
                      </>
                    ) : (
                      <>
                        <TestTube className="w-4 h-4" />
                        测试连接
                      </>
                    )}
                  </button>
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={testingForm}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                      {editingRepo ? '保存更改' : '添加仓库'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}