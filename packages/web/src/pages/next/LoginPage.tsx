import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Bot, Shield, Zap, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import './design-system.css'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    // 客户端验证
    const newErrors: Record<string, string> = {}
    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名或邮箱'
    }
    if (!formData.password) {
      newErrors.password = '请输入密码'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      await login(formData.username, formData.password)
      navigate('/next/home')
    } catch (error: any) {
      setErrors({ submit: error.message || '登录失败，请重试' })
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center p-4">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div
          className="absolute top-3/4 right-1/4 w-96 h-96 bg-secondary-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
          style={{ animationDelay: '2s' }}
        ></div>
      </div>

      {/* 主要内容 */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo和标题区域 */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl mb-6">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold modern-text-gradient mb-2">AI Orchestra</h1>
          <p className="text-gray-600 text-base">智能Agent编排平台</p>
        </div>

        {/* 登录表单 */}
        <form
          onSubmit={handleSubmit}
          className="modern-card p-8 animate-fade-in"
          style={{ animationDelay: '0.2s' }}
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">欢迎回来</h2>
            <p className="text-sm text-gray-600">登录到您的AI Orchestra账户</p>
          </div>

          {errors.submit && (
            <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg">
              <p className="text-sm text-error-700">{errors.submit}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* 用户名输入 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                用户名或邮箱
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={e => handleInputChange('username', e.target.value)}
                className={`modern-input ${errors.username ? 'border-error-500 focus:border-error-500' : ''}`}
                placeholder="输入您的用户名或邮箱"
                disabled={isLoading}
              />
              {errors.username && <p className="mt-2 text-sm text-error-600">{errors.username}</p>}
            </div>

            {/* 密码输入 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={e => handleInputChange('password', e.target.value)}
                  className={`modern-input pr-12 ${errors.password ? 'border-error-500 focus:border-error-500' : ''}`}
                  placeholder="输入您的密码"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-2 text-sm text-error-600">{errors.password}</p>}
            </div>

            {/* 记住我选项 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-600">记住我</span>
              </label>
              <button
                type="button"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                忘记密码？
              </button>
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="modern-btn modern-btn-primary w-full py-3 text-base font-semibold"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  登录中...
                </div>
              ) : (
                '登录'
              )}
            </button>
          </div>
        </form>

        {/* 功能亮点 */}
        <div
          className="mt-8 grid grid-cols-1 gap-4 animate-fade-in"
          style={{ animationDelay: '0.4s' }}
        >
          <div className="modern-card p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">智能Agent管理</h3>
                <p className="text-xs text-gray-600">统一管理和调度多个AI Agent，提升工作效率</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="modern-card p-4">
              <div className="text-center">
                <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Shield className="w-4 h-4 text-success-600" />
                </div>
                <h4 className="text-xs font-semibold text-gray-900 mb-1">安全可靠</h4>
                <p className="text-xs text-gray-600">企业级安全保障</p>
              </div>
            </div>

            <div className="modern-card p-4">
              <div className="text-center">
                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-4 h-4 text-warning-600" />
                </div>
                <h4 className="text-xs font-semibold text-gray-900 mb-1">高性能</h4>
                <p className="text-xs text-gray-600">毫秒级响应速度</p>
              </div>
            </div>
          </div>
        </div>

        {/* 版本信息 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">AI Orchestra v2.0 - 现代化AI Agent编排平台</p>
        </div>
      </div>
    </div>
  )
}
