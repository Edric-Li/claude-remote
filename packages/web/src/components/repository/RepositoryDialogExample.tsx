/**
 * RepositoryDialog 使用示例
 * 
 * 这个文件展示了如何使用响应式仓库对话框组件
 * 可以在开发过程中作为参考，生产环境中可以删除此文件
 */

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  RepositoryDialog,
  ResponsiveDialogFormSection,
  ResponsiveDialogFormField,
  ResponsiveDialogFooter,
  DialogTrigger,
} from './RepositoryDialog'
import type { RepositoryType } from '@/types/api.types'

interface FormData {
  name: string
  description: string
  url: string
  type: RepositoryType
  branch: string
  credentials: string
}

interface FormErrors {
  name?: string
  url?: string
  credentials?: string
}

export const RepositoryDialogExample: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    url: '',
    type: 'git',
    branch: 'main',
    credentials: '',
  })
  const [formErrors, setFormErrors] = useState<FormErrors>({})

  // 表单验证
  const validateForm = (): boolean => {
    const errors: FormErrors = {}
    
    if (!formData.name.trim()) {
      errors.name = '仓库名称不能为空'
    }
    
    if (!formData.url.trim()) {
      errors.url = '仓库URL不能为空'
    } else if (formData.type === 'git' && !isValidGitUrl(formData.url)) {
      errors.url = '请输入有效的Git仓库URL'
    }
    
    if (formData.type === 'git' && formData.url.startsWith('https://') && !formData.credentials.trim()) {
      errors.credentials = 'HTTPS仓库需要提供认证信息'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // 简单的Git URL验证
  const isValidGitUrl = (url: string): boolean => {
    const gitUrlPattern = /^(https?:\/\/|git@)[\w\.-]+[:\/][\w\.-\/]+\.git?$/
    return gitUrlPattern.test(url) || url.startsWith('https://github.com/') || url.startsWith('https://gitlab.com/')
  }

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      setError(true)
      return
    }
    
    setLoading(true)
    setError(false)
    
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 模拟50%成功率
      if (Math.random() > 0.5) {
        console.log('仓库创建成功:', formData)
        setOpen(false)
        // 重置表单
        setFormData({
          name: '',
          description: '',
          url: '',
          type: 'git',
          branch: 'main',
          credentials: '',
        })
        setFormErrors({})
      } else {
        throw new Error('模拟网络错误')
      }
    } catch (error) {
      console.error('创建仓库失败:', error)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  // 处理表单字段变化
  const handleFieldChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // 清除对应字段的错误
    if (formErrors[field as keyof FormErrors]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field as keyof FormErrors]
        return newErrors
      })
    }
    
    // 清除错误状态
    if (error) {
      setError(false)
    }
  }

  // 处理对话框关闭
  const handleClose = () => {
    if (!loading) {
      setOpen(false)
      setError(false)
      setFormErrors({})
    }
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">仓库对话框组件示例</h1>
      
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">功能演示</h2>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 响应式设计 - 在不同屏幕尺寸下自适应</li>
          <li>• 键盘导航 - 支持ESC键关闭</li>
          <li>• 点击外部关闭</li>
          <li>• 加载状态和错误状态显示</li>
          <li>• 表单验证和错误提示</li>
          <li>• 滚动支持 - 内容超长时自动滚动</li>
          <li>• 无障碍访问 - ARIA标签和屏幕阅读器支持</li>
        </ul>
      </div>

      <RepositoryDialog
        mode="create"
        open={open}
        onOpenChange={setOpen}
        onClose={handleClose}
        loading={loading}
        error={error}
        description="配置新的代码仓库连接信息。支持Git、本地目录等多种类型。"
      >
        <form onSubmit={handleSubmit}>
          <ResponsiveDialogFormSection>
            {/* 仓库名称 */}
            <ResponsiveDialogFormField
              label="仓库名称"
              error={formErrors.name}
              required
            >
              <Input
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="输入仓库名称"
                disabled={loading}
              />
            </ResponsiveDialogFormField>

            {/* 仓库描述 */}
            <ResponsiveDialogFormField label="描述">
              <Textarea
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="输入仓库描述（可选）"
                rows={2}
                disabled={loading}
              />
            </ResponsiveDialogFormField>

            {/* 仓库类型 */}
            <ResponsiveDialogFormField label="仓库类型" required>
              <Select
                value={formData.type}
                onValueChange={(value) => handleFieldChange('type', value as RepositoryType)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择仓库类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="git">Git仓库</SelectItem>
                  <SelectItem value="local">本地目录</SelectItem>
                  <SelectItem value="svn">SVN仓库</SelectItem>
                </SelectContent>
              </Select>
            </ResponsiveDialogFormField>

            {/* 仓库URL */}
            <ResponsiveDialogFormField
              label={formData.type === 'local' ? '本地路径' : '仓库URL'}
              error={formErrors.url}
              required
            >
              <Input
                value={formData.url}
                onChange={(e) => handleFieldChange('url', e.target.value)}
                placeholder={
                  formData.type === 'local'
                    ? '/path/to/local/repo'
                    : 'https://github.com/user/repo.git'
                }
                disabled={loading}
              />
            </ResponsiveDialogFormField>

            {/* 分支名称 */}
            {formData.type === 'git' && (
              <ResponsiveDialogFormField label="分支">
                <Input
                  value={formData.branch}
                  onChange={(e) => handleFieldChange('branch', e.target.value)}
                  placeholder="main"
                  disabled={loading}
                />
              </ResponsiveDialogFormField>
            )}

            {/* 认证信息 */}
            {formData.type === 'git' && formData.url.startsWith('https://') && (
              <ResponsiveDialogFormField
                label="认证信息"
                error={formErrors.credentials}
                required
              >
                <Input
                  type="password"
                  value={formData.credentials}
                  onChange={(e) => handleFieldChange('credentials', e.target.value)}
                  placeholder="Personal Access Token 或 username:password"
                  disabled={loading}
                />
              </ResponsiveDialogFormField>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">
                  创建仓库失败，请检查配置信息后重试。
                </p>
              </div>
            )}
          </ResponsiveDialogFormSection>

          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? '创建中...' : '创建仓库'}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </RepositoryDialog>

      {/* 触发按钮 */}
      <div className="flex gap-4">
        <Button onClick={() => setOpen(true)}>
          打开仓库对话框
        </Button>
        
        <Button
          variant="outline"
          onClick={() => {
            setOpen(true)
            setError(true)
          }}
        >
          测试错误状态
        </Button>
      </div>

      {/* 测试不同屏幕尺寸的说明 */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">响应式测试</h3>
        <p className="text-sm text-gray-600">
          调整浏览器窗口大小或使用开发者工具的设备模拟器来测试响应式效果：
        </p>
        <ul className="text-sm text-gray-600 mt-2 space-y-1">
          <li>• <strong>桌面端 (&gt;1024px)</strong>: 标准对话框居中显示</li>
          <li>• <strong>平板端 (768px-1024px)</strong>: 调整宽度适应屏幕</li>
          <li>• <strong>手机端 (&lt;768px)</strong>: 接近全屏显示，向上偏移</li>
        </ul>
      </div>
    </div>
  )
}

export default RepositoryDialogExample