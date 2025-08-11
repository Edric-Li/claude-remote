import React, { useState, useEffect } from 'react'
import { 
  Plus, Bot, Trash2, Edit, RefreshCw, 
  AlertCircle, X,
  Sparkles, Brain, Code, FileText, MessageCircle,
  Zap, Shield
} from 'lucide-react'
import { useAssistantStore, initializeAssistantStore, type Assistant } from '../../store/assistant.store'

interface AssistantFormData {
  name: string
  description: string
  avatar: string
  type: 'general' | 'coding' | 'writing' | 'analysis' | 'creative' | 'support'
  model: 'claude-3' | 'gpt-4' | 'gemini-pro' | 'custom'
  systemPrompt: string
  temperature: number
  maxTokens: number
  isPublic: boolean
  isActive: boolean
}

export function AssistantSettings() {
  const { 
    assistants, 
    loading, 
    error,
    createAssistant,
    updateAssistant,
    deleteAssistant,
    toggleAssistant,
    clearError
  } = useAssistantStore()
  
  const [showForm, setShowForm] = useState(false)
  const [editingAssistant, setEditingAssistant] = useState<Assistant | null>(null)
  const [formData, setFormData] = useState<AssistantFormData>({
    name: '',
    description: '',
    avatar: '🤖',
    type: 'general',
    model: 'claude-3',
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 2000,
    isPublic: false,
    isActive: true
  })

  const assistantTypes = [
    { value: 'general', label: '通用助手', icon: Bot, color: 'blue' },
    { value: 'coding', label: '编程助手', icon: Code, color: 'green' },
    { value: 'writing', label: '写作助手', icon: FileText, color: 'purple' },
    { value: 'analysis', label: '分析助手', icon: Brain, color: 'indigo' },
    { value: 'creative', label: '创意助手', icon: Sparkles, color: 'pink' },
    { value: 'support', label: '客服助手', icon: MessageCircle, color: 'orange' }
  ]

  const models = [
    { value: 'claude-3', label: 'Claude 3 Sonnet', description: 'Anthropic的高质量模型' },
    { value: 'gpt-4', label: 'GPT-4', description: 'OpenAI的旗舰模型' },
    { value: 'gemini-pro', label: 'Gemini Pro', description: 'Google的多模态模型' },
    { value: 'custom', label: '自定义模型', description: '使用自定义配置' }
  ]

  const avatarOptions = ['🤖', '👨‍💻', '👩‍💻', '🧑‍🎓', '👨‍🏫', '👩‍🏫', '🦾', '🧠', '⚡', '🌟', '🎯', '🚀']

  useEffect(() => {
    // Initialize the store and load assistants
    initializeAssistantStore()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingAssistant) {
        // Update existing assistant
        await updateAssistant(editingAssistant.id, formData)
      } else {
        // Create new assistant
        await createAssistant(formData)
      }
      resetForm()
    } catch (error) {
      console.error('Failed to save assistant:', error)
      alert('保存失败，请重试')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除助手 "${name}" 吗？此操作不可恢复。`)) {
      return
    }

    try {
      await deleteAssistant(id)
    } catch (error) {
      console.error('Failed to delete assistant:', error)
      alert('删除失败，请重试')
    }
  }

  const handleToggleActive = async (id: string) => {
    try {
      await toggleAssistant(id)
    } catch (error) {
      console.error('Failed to toggle assistant:', error)
    }
  }

  const handleEdit = (assistant: Assistant) => {
    setEditingAssistant(assistant)
    setFormData({
      name: assistant.name,
      description: assistant.description,
      avatar: assistant.avatar,
      type: assistant.type,
      model: assistant.model,
      systemPrompt: assistant.systemPrompt,
      temperature: assistant.temperature,
      maxTokens: assistant.maxTokens,
      isPublic: assistant.isPublic,
      isActive: assistant.isActive
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      avatar: '🤖',
      type: 'general',
      model: 'claude-3',
      systemPrompt: '',
      temperature: 0.7,
      maxTokens: 2000,
      isPublic: false,
      isActive: true
    })
    setEditingAssistant(null)
    setShowForm(false)
  }

  const getTypeIcon = (type: string) => {
    const typeConfig = assistantTypes.find(t => t.value === type)
    return typeConfig ? typeConfig.icon : Bot
  }

  const getTypeColor = (type: string) => {
    const typeConfig = assistantTypes.find(t => t.value === type)
    switch (typeConfig?.color) {
      case 'blue': return 'bg-blue-100 text-blue-700'
      case 'green': return 'bg-green-100 text-green-700'
      case 'purple': return 'bg-purple-100 text-purple-700'
      case 'indigo': return 'bg-indigo-100 text-indigo-700'
      case 'pink': return 'bg-pink-100 text-pink-700'
      case 'orange': return 'bg-orange-100 text-orange-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getSystemPromptPreview = (type: string) => {
    switch (type) {
      case 'coding':
        return '你是一个专业的编程助手，擅长多种编程语言和软件开发最佳实践...'
      case 'writing':
        return '你是一个优秀的写作助手，能够帮助用户创作各种类型的文本内容...'
      case 'analysis':
        return '你是一个数据分析专家，擅长解读数据、发现趋势和提供洞察...'
      case 'creative':
        return '你是一个富有创意的助手，善于头脑风暴和创意思维...'
      case 'support':
        return '你是一个友善的客服助手，专注于帮助用户解决问题...'
      default:
        return '你是一个通用AI助手，能够帮助用户处理各种任务和问题...'
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
          <h3 className="text-lg font-semibold text-gray-900">助手管理</h3>
          <p className="text-sm text-gray-600">创建和管理您的AI助手</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加助手
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 助手列表 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {assistants.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h4 className="font-medium text-gray-900 mb-2">还没有创建助手</h4>
            <p className="text-sm mb-4">创建您的第一个AI助手开始使用</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              创建助手
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {assistants.map((assistant) => {
              const IconComponent = getTypeIcon(assistant.type)
              return (
                <div key={assistant.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{assistant.avatar}</span>
                        <div>
                          <h4 className="font-medium text-gray-900">{assistant.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${getTypeColor(assistant.type)}`}>
                              <IconComponent className="w-3 h-3" />
                              {assistantTypes.find(t => t.value === assistant.type)?.label}
                            </span>
                            <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
                              {models.find(m => m.value === assistant.model)?.label}
                            </span>
                            {assistant.isActive ? (
                              <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">激活</span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">未激活</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{assistant.description}</p>

                      {/* 配置信息 */}
                      <div className="grid grid-cols-3 gap-4 text-xs text-gray-500 mb-3">
                        <div>
                          <span className="font-medium">温度:</span> {assistant.temperature}
                        </div>
                        <div>
                          <span className="font-medium">最大Token:</span> {assistant.maxTokens}
                        </div>
                        <div>
                          <span className="font-medium">可见性:</span> {assistant.isPublic ? '公开' : '私有'}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>创建时间: {assistant.createdAt.toLocaleDateString()}</span>
                        <span>更新时间: {assistant.updatedAt.toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(assistant.id)}
                        className={`p-2 transition-colors ${
                          assistant.isActive 
                            ? 'text-orange-400 hover:text-orange-600' 
                            : 'text-green-400 hover:text-green-600'
                        }`}
                        title={assistant.isActive ? '停用助手' : '激活助手'}
                      >
                        {assistant.isActive ? <Shield className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleEdit(assistant)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="编辑助手"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(assistant.id, assistant.name)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="删除助手"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 添加/编辑表单模态框 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingAssistant ? '编辑助手' : '添加助手'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">助手名称</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                      placeholder="输入助手名称"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">头像</label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{formData.avatar}</span>
                      <select
                        value={formData.avatar}
                        onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                      >
                        {avatarOptions.map((avatar) => (
                          <option key={avatar} value={avatar}>{avatar}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    rows={3}
                    placeholder="简单描述助手的功能和特点"
                  />
                </div>

                {/* 类型和模型 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">助手类型</label>
                    <div className="space-y-2">
                      {assistantTypes.map((type) => {
                        const IconComponent = type.icon
                        return (
                          <label key={type.value} className="flex items-center">
                            <input
                              type="radio"
                              name="type"
                              value={type.value}
                              checked={formData.type === type.value}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                type: e.target.value as any,
                                systemPrompt: formData.systemPrompt || getSystemPromptPreview(e.target.value)
                              })}
                              className="w-4 h-4 text-blue-600"
                            />
                            <IconComponent className="w-4 h-4 ml-2 mr-1" />
                            <span className="text-sm">{type.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">AI模型</label>
                    <select
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    >
                      {models.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {models.find(m => m.value === formData.model)?.description}
                    </p>
                  </div>
                </div>

                {/* 系统提示词 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">系统提示词</label>
                  <textarea
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    rows={4}
                    placeholder={getSystemPromptPreview(formData.type)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    定义助手的角色、行为和响应风格
                  </p>
                </div>

                {/* 参数设置 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      创造性温度: {formData.temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>保守</span>
                      <span>创造性</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">最大Token数</label>
                    <input
                      type="number"
                      min="100"
                      max="8000"
                      value={formData.maxTokens}
                      onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                    />
                  </div>
                </div>

                {/* 选项设置 */}
                <div className="flex items-center gap-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">公开助手</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">立即激活</span>
                  </label>
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
                    {editingAssistant ? '保存更改' : '创建助手'}
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