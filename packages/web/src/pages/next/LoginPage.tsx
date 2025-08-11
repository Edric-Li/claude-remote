import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Sparkles, 
  Bot, 
  Shield, 
  Eye, 
  EyeOff,
  ChevronRight,
  Rocket
} from 'lucide-react'
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
      navigate('/home')
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* 左侧展示区 - PC端显示 */}
      <div className="hidden lg:flex lg:w-1/2 bg-white border-r border-gray-200 items-center justify-center p-12">
        <div className="max-w-lg">
          {/* Logo和标题 */}
          <div className="mb-12">
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-16 h-16 bg-gray-900 rounded-xl flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900">AI Orchestra</h1>
                <p className="text-gray-600">下一代智能编排平台</p>
              </div>
            </div>
            
            {/* 特性介绍 */}
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Bot className="w-6 h-6 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1 text-gray-900">智能Agent协作</h3>
                  <p className="text-gray-600 text-sm">多Agent协同工作，实现复杂任务自动化处理</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1 text-gray-900">极速响应</h3>
                  <p className="text-gray-600 text-sm">毫秒级任务调度，实时状态同步更新</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1 text-gray-900">企业级安全</h3>
                  <p className="text-gray-600 text-sm">端到端加密，完整的权限管理体系</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧登录区 */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* 移动端Logo - 仅在小屏幕显示 */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-900 rounded-xl mb-4">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">AI Orchestra</h1>
            <p className="text-gray-600 text-sm">智能Agent编排平台</p>
          </div>

          {/* 登录表单 */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">欢迎回来</h2>
              <p className="text-gray-600 text-sm">登录以继续使用 AI Orchestra</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {errors.submit && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}

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
                  className={`w-full px-4 py-2.5 border ${
                    errors.username ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all`}
                  placeholder="输入您的用户名或邮箱"
                  disabled={isLoading}
                />
                {errors.username && <p className="mt-2 text-sm text-red-600">{errors.username}</p>}
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
                    className={`w-full px-4 py-2.5 pr-12 border ${
                      errors.password ? 'border-red-300' : 'border-gray-300'
                    } rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all`}
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
                {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password}</p>}
              </div>

              {/* 记住我和忘记密码 */}
              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 border-gray-300 rounded text-gray-900 focus:ring-gray-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">记住我</span>
                </label>
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  忘记密码？
                </button>
              </div>

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    登录中...
                  </div>
                ) : (
                  <span className="flex items-center justify-center">
                    登录
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </span>
                )}
              </button>
            </form>

            {/* 注册提示 */}
            <div className="mt-8 text-center">
              <p className="text-gray-600 text-sm">
                还没有账户？
                <button className="text-gray-900 hover:underline font-medium ml-1 transition-colors">
                  立即注册
                </button>
              </p>
            </div>
          </div>

          {/* 底部信息 */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center space-x-6 text-gray-500 text-xs">
              <span>© 2024 AI Orchestra</span>
              <span>·</span>
              <button className="hover:text-gray-700 transition-colors">隐私政策</button>
              <span>·</span>
              <button className="hover:text-gray-700 transition-colors">服务条款</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}