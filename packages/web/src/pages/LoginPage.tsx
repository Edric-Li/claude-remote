import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../store/auth.store'
import { RadixBackground } from '../components/RadixBackground'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, error } = useAuthStore()
  
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    nickname: ''
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // 验证表单
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (isLogin) {
      if (!formData.username) {
        errors.username = '请输入用户名或邮箱'
      }
      if (!formData.password) {
        errors.password = '请输入密码'
      }
    } else {
      if (!formData.username || formData.username.length < 3) {
        errors.username = '用户名至少3个字符'
      }
      if (!formData.email || !isValidEmail(formData.email)) {
        errors.email = '请输入有效的邮箱地址'
      }
      if (!formData.password || formData.password.length < 6) {
        errors.password = '密码至少6个字符'
      }
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // 验证邮箱
  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  // 处理提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      if (isLogin) {
        // 登录
        await login(formData.username, formData.password)
      } else {
        // 注册
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: formData.username,
            email: formData.email,
            password: formData.password,
            nickname: formData.nickname || formData.username
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || '注册失败')
        }

        const data = await response.json()
        
        // 注册成功后自动登录
        useAuthStore.getState().setAuth(data.user, data.accessToken, data.refreshToken)
      }
      
      // 跳转到主页
      navigate('/')
    } catch (err: any) {
      console.error('Auth error:', err)
      // 错误已经在 store 中处理
    }
  }

  // 切换登录/注册
  const toggleMode = () => {
    setIsLogin(!isLogin)
    setFormErrors({})
    setFormData({
      username: '',
      email: '',
      password: '',
      nickname: ''
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-background">
      {/* Radix UI 风格背景 */}
      <RadixBackground />
      
      <div className="w-full max-w-sm animate-slide-down relative z-10">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            AI Orchestra
          </h1>
          <p className="text-sm text-muted-foreground">
            智能 CLI 工具编排平台
          </p>
        </div>

        {/* 登录卡片 */}
        <div className="radix-card rounded-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 用户名 */}
            <div className="space-y-2">
              <label htmlFor="username" className="radix-label">
                {isLogin ? '用户名 / 邮箱' : '用户名'}
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="radix-input w-full h-10 px-3 rounded-md text-sm"
                placeholder={isLogin ? 'demo' : ''}
              />
              {formErrors.username && (
                <p className="text-xs text-destructive mt-1">{formErrors.username}</p>
              )}
            </div>

            {/* 邮箱 - 仅注册 */}
            {!isLogin && (
              <div className="space-y-2">
                <label htmlFor="email" className="radix-label">
                  邮箱
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="radix-input w-full h-10 px-3 rounded-md text-sm"
                />
                {formErrors.email && (
                  <p className="text-xs text-destructive mt-1">{formErrors.email}</p>
                )}
              </div>
            )}

            {/* 昵称 - 仅注册 */}
            {!isLogin && (
              <div className="space-y-2">
                <label htmlFor="nickname" className="radix-label">
                  昵称（可选）
                </label>
                <input
                  id="nickname"
                  type="text"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  className="radix-input w-full h-10 px-3 rounded-md text-sm"
                />
              </div>
            )}

            {/* 密码 */}
            <div className="space-y-2">
              <label htmlFor="password" className="radix-label">
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="radix-input w-full h-10 px-3 pr-10 rounded-md text-sm"
                  placeholder={isLogin ? 'demo123' : ''}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {formErrors.password && (
                <p className="text-xs text-destructive mt-1">{formErrors.password}</p>
              )}
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-sm text-red-400">
                {error}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="radix-button w-full h-10 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <span className="mr-2 h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isLogin ? '登录中...' : '注册中...'}
                </span>
              ) : (
                isLogin ? '登录' : '注册'
              )}
            </button>
          </form>

          {/* 切换登录/注册 */}
          <div className="mt-6 text-center">
            <button
              onClick={toggleMode}
              className="radix-link text-sm"
            >
              {isLogin ? '还没有账号？点击注册' : '已有账号？点击登录'}
            </button>
          </div>

          {/* 测试账号提示 */}
          {isLogin && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                测试账号：demo / demo123
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}