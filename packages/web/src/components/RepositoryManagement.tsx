import { useState, useEffect } from 'react'
import { 
  Plus, Edit2, Trash2, GitBranch, FolderOpen, 
  TestTube, CheckCircle, RefreshCw, AlertCircle,
  Eye, EyeOff
} from 'lucide-react'
import { useAuthStore } from '../store/auth.store'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Switch } from './ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Combobox, type ComboboxOption } from './ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { API_BASE_URL } from '../config'

interface Repository {
  id: string
  name: string
  description: string
  url: string
  type: 'git' | 'local' | 'svn'
  branch?: string
  localPath?: string
  enabled: boolean
  settings?: {
    autoUpdate?: boolean
    cachePath?: string
  }
  createdAt: string
  updatedAt: string
  credentials?: string
}

export function RepositoryManagement() {
  const { accessToken } = useAuthStore()  // 从 auth store 获取 token
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingRepo, setEditingRepo] = useState<Repository | null>(null)
  const [deletingRepo, setDeletingRepo] = useState<Repository | null>(null)
  const [testingConnection, setTestingConnection] = useState<string | null>(null)
  const [testingForm, setTestingForm] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)  // 添加密码显示状态
  const [availableBranches, setAvailableBranches] = useState<ComboboxOption[]>([])  // 可用分支列表
  const [formData, setFormData] = useState<Partial<Repository>>({
    name: '',
    description: '',
    url: '',
    type: 'git',
    branch: 'main',
    enabled: true,
    settings: {
      autoUpdate: false
    }
  })

  // 获取仓库列表
  const fetchRepositories = async () => {
    setLoading(true)
    try {
      // 使用 auth store 中的 token
      const response = await fetch(`${API_BASE_URL}/api/repositories`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setRepositories(data)
      }
    } catch (error) {
      console.error('Failed to fetch repositories:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRepositories()
  }, [])

  // 测试连接
  const handleTestConnection = async (id: string) => {
    setTestingConnection(id)
    try {
      // 使用 auth store 中的 token
      const response = await fetch(`${API_BASE_URL}/api/repositories/${id}/test`, {
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
    } catch (error) {
      alert('测试连接失败')
    } finally {
      setTestingConnection(null)
    }
  }

  // 测试表单中的仓库配置
  const testFormConfig = async () => {
    // 验证必填字段
    if (formData.type === 'local') {
      if (!formData.localPath?.trim()) {
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
      // 使用 auth store 中的 token
      
      // 使用新的测试端点，不需要创建临时仓库
      const testData = {
        url: formData.url || '',
        type: formData.type || 'git',
        branch: formData.branch || 'main',
        localPath: formData.localPath || '',
        credentials: formData.credentials || ''
      }
      
      const testResponse = await fetch(`${API_BASE_URL}/api/repositories/test-config`, {
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
        setTestingForm(false)
        return
      }
      
      const result = await testResponse.json()
      
      // 构建详细的结果信息
      let message = result.message
      if (result.success && result.details?.branches) {
        // 保存分支列表到状态
        const branchOptions: ComboboxOption[] = result.details.branches.map((branch: string) => ({
          value: branch,
          label: branch
        }))
        setAvailableBranches(branchOptions)
        
        // 如果当前没有选择分支，或选择的分支不在列表中，使用默认分支
        if (!formData.branch || !result.details.branches.includes(formData.branch)) {
          setFormData(prev => ({ ...prev, branch: result.details.defaultBranch || 'main' }))
        }
        
        message = `✅ ${message}\n找到 ${result.details.branches.length} 个分支`
      } else if (!result.success) {
        message = `❌ ${message}`
        setAvailableBranches([])  // 清空分支列表
      }
      
      setTestResult({ success: result.success, message })
    } catch (error) {
      setTestResult({ success: false, message: '测试失败：网络错误' })
    } finally {
      setTestingForm(false)
    }
  }

  // 创建工作区
  const handleCreateWorkspace = async (id: string) => {
    try {
      // 使用 auth store 中的 token
      const response = await fetch(`${API_BASE_URL}/api/repositories/${id}/workspace`, {
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
        alert('创建工作区失败')
      }
    } catch (error) {
      alert('创建工作区失败')
    }
  }

  // 删除仓库
  const handleDelete = async () => {
    if (!deletingRepo) return
    
    try {
      // 使用 auth store 中的 token
      const response = await fetch(`${API_BASE_URL}/api/repositories/${deletingRepo.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      if (response.ok) {
        fetchRepositories()
        setDeleteDialogOpen(false)
        setDeletingRepo(null)
      }
    } catch (error) {
      alert('删除失败')
    }
  }

  // 提交表单
  const handleSubmit = async () => {
    // 验证必填字段
    if (!formData.name?.trim()) {
      alert('请输入仓库名称')
      return
    }
    
    if (formData.type === 'local') {
      if (!formData.localPath?.trim()) {
        alert('请输入本地路径')
        return
      }
    } else {
      if (!formData.url?.trim()) {
        alert('请输入仓库URL')
        return
      }
    }

    try {
      // 使用 auth store 中的 token
      const url = editingRepo 
        ? `${API_BASE_URL}/api/repositories/${editingRepo.id}`
        : `${API_BASE_URL}/api/repositories`
      
      const response = await fetch(url, {
        method: editingRepo ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const savedRepo = await response.json()
        
        // 对新创建的仓库自动进行连接测试
        if (!editingRepo) {
          const confirmTest = confirm('仓库已创建，是否立即测试连接以验证配置？')
          if (confirmTest) {
            setModalOpen(false)
            resetForm()
            fetchRepositories()
            
            // 延迟一下再测试，确保UI更新
            setTimeout(() => {
              handleTestConnection(savedRepo.id)
            }, 500)
          } else {
            setModalOpen(false)
            resetForm()
            fetchRepositories()
          }
        } else {
          setModalOpen(false)
          resetForm()
          fetchRepositories()
        }
      } else {
        const error = await response.json()
        alert(`操作失败：${error.message || '未知错误'}`)
      }
    } catch (error) {
      alert('操作失败')
    }
  }

  // 编辑仓库
  const handleEdit = (repo: Repository) => {
    setEditingRepo(repo)
    setFormData({
      ...repo,
      credentials: repo.credentials ? '******' : undefined
    })
    setModalOpen(true)
  }

  // 重置表单
  const resetForm = () => {
    setEditingRepo(null)
    setTestResult(null)
    setShowPassword(false)  // 重置密码显示状态
    setAvailableBranches([])  // 清空分支列表
    setFormData({
      name: '',
      description: '',
      url: '',
      type: 'git',
      branch: 'main',
      enabled: true,
      settings: {
        autoUpdate: false
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
          仓库管理
        </h2>
        <Button
          onClick={() => {
            resetForm()
            setModalOpen(true)
          }}
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          添加仓库
        </Button>
      </div>

      {/* 仓库列表 */}
      <div className="grid gap-4">
        {repositories.length > 0 ? (
          repositories.map((repo) => (
            <Card key={repo.id} className="backdrop-blur-md bg-card/60 border-purple-500/20">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <GitBranch className="h-5 w-5 text-purple-400" />
                      <h3 className="text-lg font-semibold text-foreground">{repo.name}</h3>
                      <Badge 
                        variant={repo.type === 'git' ? 'default' : 'secondary'}
                        className={
                          repo.type === 'git' 
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : repo.type === 'local'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        }
                      >
                        {repo.type.toUpperCase()}
                      </Badge>
                      <Badge 
                        variant={repo.enabled ? 'default' : 'outline'}
                        className={
                          repo.enabled 
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'text-muted-foreground'
                        }
                      >
                        {repo.enabled ? '启用' : '禁用'}
                      </Badge>
                    </div>
                    
                    {repo.description && (
                      <p className="text-sm text-muted-foreground">{repo.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {repo.type === 'local' ? '路径:' : 'URL:'}
                      </span>
                      <code className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 font-mono text-xs">
                        {repo.type === 'local' ? repo.localPath : repo.url}
                      </code>
                      {repo.branch && (
                        <>
                          <span className="text-muted-foreground">分支:</span>
                          <code className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 font-mono text-xs">
                            {repo.branch}
                          </code>
                        </>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      创建于 {new Date(repo.createdAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestConnection(repo.id)}
                      disabled={testingConnection === repo.id}
                      className="border-purple-500/20 hover:bg-purple-500/10"
                    >
                      {testingConnection === repo.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                      <span className="ml-2">测试</span>
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateWorkspace(repo.id)}
                      className="border-purple-500/20 hover:bg-purple-500/10"
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      创建工作区
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(repo)}
                      className="border-purple-500/20 hover:bg-purple-500/10"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDeletingRepo(repo)
                        setDeleteDialogOpen(true)
                      }}
                      className="border-red-500/20 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="backdrop-blur-md bg-card/60 border-purple-500/20">
            <CardContent className="py-12 text-center">
              <GitBranch className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">暂无仓库配置</p>
              <p className="text-sm text-muted-foreground mt-2">点击上方"添加仓库"按钮创建第一个仓库</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 添加/编辑对话框 */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingRepo ? '编辑仓库' : '添加仓库'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>仓库名称</Label>
              <Input
                placeholder="请输入仓库名称"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label>描述</Label>
              <Textarea
                placeholder="请输入仓库描述"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            
            <div className="grid gap-2">
              <Label>仓库类型</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'git' | 'local' | 'svn') => 
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="git">Git</SelectItem>
                  <SelectItem value="local">本地目录</SelectItem>
                  <SelectItem value="svn">SVN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {formData.type === 'local' ? (
              <div className="grid gap-2">
                <Label>本地路径</Label>
                <Input
                  placeholder="/path/to/local/repository"
                  value={formData.localPath}
                  onChange={(e) => setFormData({ ...formData, localPath: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label>仓库URL</Label>
                  <Input
                    placeholder="https://github.com/user/repo.git"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label>分支</Label>
                  {availableBranches.length > 0 ? (
                    <Combobox
                      options={availableBranches}
                      value={formData.branch}
                      onValueChange={(value) => setFormData({ ...formData, branch: value })}
                      placeholder="选择分支..."
                      searchPlaceholder="搜索分支..."
                      emptyText="没有找到匹配的分支"
                    />
                  ) : (
                    <Input
                      placeholder="main（请先测试连接以获取分支列表）"
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    />
                  )}
                  {availableBranches.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      共 {availableBranches.length} 个分支，可通过搜索快速查找
                    </p>
                  )}
                </div>
                
                <div className="grid gap-2">
                  <Label>认证信息（可选）</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="username:password 或 token"
                      value={formData.credentials}
                      onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">用于访问私有仓库，支持以下格式：</p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                      <li>GitHub: Personal Access Token 或 username:password</li>
                      <li>GitLab: Personal/Project Access Token</li>
                      <li>Bitbucket: <span className="text-yellow-500">必须使用 App Password</span> (格式: username:app_password)</li>
                      <li>通用 Git: username:password</li>
                    </ul>
                    <p className="text-xs text-yellow-500 mt-1">
                      ⚠️ 注意：Bitbucket 不支持账户密码，必须创建 App Password
                    </p>
                  </div>
                </div>
              </>
            )}
            
            <div className="flex items-center justify-between">
              <Label>启用状态</Label>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
            
            {/* 高级设置 */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">高级设置</h4>
              
              <div className="flex items-center justify-between">
                <Label>自动更新</Label>
                <Switch
                  checked={formData.settings?.autoUpdate}
                  onCheckedChange={(checked) => 
                    setFormData({ 
                      ...formData, 
                      settings: { ...formData.settings, autoUpdate: checked }
                    })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                启用后，Worker 每次执行任务前会自动拉取最新代码
              </p>
            </div>
          </div>
          
          <DialogFooter className="flex flex-col gap-3">
            {testResult && (
              <div className={`w-full p-3 rounded-lg border ${
                testResult.success 
                  ? 'bg-green-500/10 border-green-500/20' 
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                  )}
                  <div className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    <pre className="whitespace-pre-wrap font-sans">{testResult.message}</pre>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between w-full">
              <Button 
                variant="outline" 
                onClick={testFormConfig}
                disabled={testingForm}
                className="border-purple-500/20 hover:bg-purple-500/10"
              >
                {testingForm ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    测试中...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    测试连接
                  </>
                )}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setModalOpen(false)
                  setTestResult(null)
                }}>
                  取消
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={testingForm}
                >
                  {editingRepo ? '保存' : '创建'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        // 只允许通过按钮关闭，不允许点击外部关闭
        if (!open) return
        setDeleteDialogOpen(open)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除仓库 "{deletingRepo?.name}" 吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingRepo(null)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}