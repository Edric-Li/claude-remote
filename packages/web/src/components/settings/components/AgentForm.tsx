import React, { useState, useEffect } from 'react'
import { X, Loader2, Plus, Trash2, Info } from 'lucide-react'
import type { Agent, AgentFormData } from '../../../types/agent.types'

interface AgentFormProps {
  agent?: Agent | null
  onSubmit: (data: AgentFormData) => Promise<void>
  onCancel: () => void
}

export function AgentForm({ agent, onSubmit, onCancel }: AgentFormProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    description: '',
    maxWorkers: 4,
    tags: [],
    allowedTools: ['claude', 'qwen']
  })

  // 可用工具选项
  const availableTools = [
    { value: 'claude', label: 'Claude (Anthropic)' },
    { value: 'qwen', label: 'Qwen (阿里云)' },
    { value: 'gpt', label: 'GPT (OpenAI)' },
    { value: 'gemini', label: 'Gemini (Google)' }
  ]

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        description: agent.description,
        maxWorkers: agent.maxWorkers,
        tags: agent.tags || [],
        allowedTools: agent.allowedTools || ['claude', 'qwen']
      })
    }
  }, [agent])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Agent名称不能为空'
    } else if (formData.name.length < 2) {
      newErrors.name = 'Agent名称至少需要2个字符'
    } else if (formData.name.length > 100) {
      newErrors.name = 'Agent名称不能超过100个字符'
    }

    if (formData.maxWorkers < 1) {
      newErrors.maxWorkers = '最大Worker数量不能小于1'
    } else if (formData.maxWorkers > 32) {
      newErrors.maxWorkers = '最大Worker数量不能超过32'
    }

    if (formData.tags && formData.tags.length > 20) {
      newErrors.tags = '最多只能添加20个标签'
    }

    if (formData.allowedTools && formData.allowedTools.length === 0) {
      newErrors.allowedTools = '至少需要选择一个允许的工具'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Form submission error:', error)
      if (error instanceof Error) {
        setErrors({ submit: error.message })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddTag = () => {
    const newTag = prompt('请输入新标签:')
    if (newTag && newTag.trim()) {
      const tag = newTag.trim()
      if (!formData.tags?.includes(tag)) {
        setFormData({
          ...formData,
          tags: [...(formData.tags || []), tag]
        })
      }
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(tag => tag !== tagToRemove) || []
    })
  }

  const handleToolToggle = (tool: string) => {
    const currentTools = formData.allowedTools || []
    if (currentTools.includes(tool)) {
      setFormData({
        ...formData,
        allowedTools: currentTools.filter(t => t !== tool)
      })
    } else {
      setFormData({
        ...formData,
        allowedTools: [...currentTools, tool]
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* 头部 */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {agent ? '编辑Agent' : '添加Agent'}
            </h3>
            <button
              type="button"
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* 表单内容 */}
          <div className="p-6 space-y-6">
            {/* 全局错误 */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {errors.submit}
              </div>
            )}

            {/* 基础信息 */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 border-b border-gray-200 pb-2">
                基础信息
              </h4>

              {/* Agent名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="输入Agent名称"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  rows={3}
                  placeholder="描述Agent的用途和功能"
                />
              </div>

              {/* 最大Worker数 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大Worker数 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={formData.maxWorkers}
                  onChange={(e) => setFormData({ ...formData, maxWorkers: parseInt(e.target.value) })}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent ${
                    errors.maxWorkers ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="最大并发Worker数量"
                />
                {errors.maxWorkers && (
                  <p className="mt-1 text-sm text-red-600">{errors.maxWorkers}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  推荐值：1-8（根据Agent机器性能调整）
                </p>
              </div>
            </div>

            {/* 标签管理 */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 border-b border-gray-200 pb-2">
                标签管理
              </h4>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    标签
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    <Plus className="w-4 h-4" />
                    添加标签
                  </button>
                </div>

                {formData.tags && formData.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">暂无标签，点击上方按钮添加</p>
                )}

                {errors.tags && (
                  <p className="mt-1 text-sm text-red-600">{errors.tags}</p>
                )}
              </div>
            </div>

            {/* 工具配置 */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 border-b border-gray-200 pb-2">
                允许的工具
              </h4>

              <div>
                <div className="space-y-2">
                  {availableTools.map((tool) => (
                    <label
                      key={tool.value}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.allowedTools?.includes(tool.value) || false}
                        onChange={() => handleToolToggle(tool.value)}
                        className="h-4 w-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">
                          {tool.label}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>

                {errors.allowedTools && (
                  <p className="mt-1 text-sm text-red-600">{errors.allowedTools}</p>
                )}

                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">工具说明：</p>
                      <ul className="space-y-1 text-xs">
                        <li>• Claude: Anthropic的AI模型，支持代码生成和分析</li>
                        <li>• Qwen: 阿里云的通义千问模型</li>
                        <li>• GPT: OpenAI的GPT系列模型</li>
                        <li>• Gemini: Google的Gemini模型</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 预览信息 */}
            {!agent && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-900 mb-2">创建后将自动生成：</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 唯一的密钥用于Agent认证</li>
                  <li>• 默认的监控配置</li>
                  <li>• 基础的权限设置</li>
                  <li>• 连接命令和使用说明</li>
                </ul>
              </div>
            )}
          </div>

          {/* 底部操作 */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {agent ? '保存更改' : '创建Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}