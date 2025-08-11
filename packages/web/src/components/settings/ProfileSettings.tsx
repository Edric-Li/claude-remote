import React, { useState, useEffect } from 'react'
import {
  User,
  Key,
  Save,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  Mail,
  AtSign,
  UserCircle,
  Shield,
  AlertCircle
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { API_BASE_URL } from '../../config'

interface ProfileFormData {
  username: string
  displayName: string
  email: string
}

interface PasswordFormData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

interface SettingsSectionProps {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}

function SettingsSection({ icon, title, description, children }: SettingsSectionProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export function ProfileSettings() {
  const { user, accessToken, updateUser } = useAuthStore()
  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    username: '',
    displayName: '',
    email: ''
  })
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})

  // 密码强度检测
  const checkPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, text: '', color: '' }
    
    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++
    
    const strengthMap = {
      0: { text: '很弱', color: 'bg-red-500' },
      1: { text: '弱', color: 'bg-orange-500' },
      2: { text: '一般', color: 'bg-yellow-500' },
      3: { text: '强', color: 'bg-blue-500' },
      4: { text: '很强', color: 'bg-green-500' },
      5: { text: '极强', color: 'bg-green-600' }
    }
    
    return { strength, ...strengthMap[Math.min(strength, 5) as keyof typeof strengthMap] }
  }

  const passwordStrength = checkPasswordStrength(passwordForm.newPassword)

  useEffect(() => {
    if (user) {
      setProfileForm({
        username: user.username || '',
        displayName: user.displayName || '',
        email: user.email || ''
      })
    }
  }, [user])

  const validateProfileForm = () => {
    const errors: Record<string, string> = {}
    
    if (!profileForm.username.trim()) {
      errors.username = '用户名不能为空'
    } else if (profileForm.username.length < 3) {
      errors.username = '用户名至少3个字符'
    } else if (!/^[a-zA-Z0-9_-]+$/.test(profileForm.username)) {
      errors.username = '用户名只能包含字母、数字、下划线和连字符'
    }
    
    if (profileForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
      errors.email = '请输入有效的邮箱地址'
    }
    
    setProfileErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validatePasswordForm = () => {
    const errors: Record<string, string> = {}
    
    if (!passwordForm.currentPassword) {
      errors.currentPassword = '请输入当前密码'
    }
    
    if (!passwordForm.newPassword) {
      errors.newPassword = '请输入新密码'
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = '密码至少6个字符'
    } else if (passwordForm.newPassword === passwordForm.currentPassword) {
      errors.newPassword = '新密码不能与当前密码相同'
    }
    
    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = '请确认新密码'
    } else if (passwordForm.confirmPassword !== passwordForm.newPassword) {
      errors.confirmPassword = '两次输入的密码不一致'
    }
    
    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateProfileForm()) return
    
    setProfileLoading(true)
    setProfileMessage(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(profileForm)
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '更新失败')
      }
      
      const updatedUser = await response.json()
      updateUser(updatedUser)
      setProfileMessage({ type: 'success', text: '个人信息更新成功' })
      
      // 3秒后清除消息
      setTimeout(() => setProfileMessage(null), 3000)
    } catch (error: any) {
      setProfileMessage({ type: 'error', text: error.message || '更新失败，请重试' })
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validatePasswordForm()) return
    
    setPasswordLoading(true)
    setPasswordMessage(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || '密码修改失败')
      }
      
      setPasswordMessage({ type: 'success', text: '密码修改成功' })
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      
      // 3秒后清除消息
      setTimeout(() => setPasswordMessage(null), 3000)
    } catch (error: any) {
      setPasswordMessage({ type: 'error', text: error.message || '密码修改失败，请检查当前密码是否正确' })
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleProfileChange = (field: keyof ProfileFormData, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }))
    if (profileErrors[field]) {
      setProfileErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handlePasswordChange = (field: keyof PasswordFormData, value: string) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }))
    if (passwordErrors[field]) {
      setPasswordErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <div className="space-y-6">
      {/* 个人信息 */}
      <SettingsSection
        icon={<User className="w-5 h-5" />}
        title="基本信息"
        description="管理您的个人资料和账户信息"
      >
        <form onSubmit={handleProfileSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 用户名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <AtSign className="w-4 h-4 text-gray-400" />
                  用户名
                </div>
              </label>
              <input
                type="text"
                value={profileForm.username}
                onChange={e => handleProfileChange('username', e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  profileErrors.username 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                    : 'border-gray-300 focus:border-gray-500 focus:ring-gray-200'
                }`}
                placeholder="输入用户名"
              />
              {profileErrors.username && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {profileErrors.username}
                </p>
              )}
            </div>

            {/* 显示名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-gray-400" />
                  显示名称
                </div>
              </label>
              <input
                type="text"
                value={profileForm.displayName}
                onChange={e => handleProfileChange('displayName', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:border-gray-500 focus:ring-gray-200 transition-all"
                placeholder="输入显示名称（可选）"
              />
            </div>

            {/* 邮箱 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  邮箱地址
                </div>
              </label>
              <input
                type="email"
                value={profileForm.email}
                onChange={e => handleProfileChange('email', e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  profileErrors.email 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                    : 'border-gray-300 focus:border-gray-500 focus:ring-gray-200'
                }`}
                placeholder="输入邮箱地址（可选）"
              />
              {profileErrors.email && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {profileErrors.email}
                </p>
              )}
            </div>
          </div>

          {/* 消息提示 */}
          {profileMessage && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
              profileMessage.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {profileMessage.type === 'success' ? (
                <Check className="w-4 h-4" />
              ) : (
                <X className="w-4 h-4" />
              )}
              {profileMessage.text}
            </div>
          )}

          {/* 保存按钮 */}
          <div className="flex justify-end mt-6">
            <button
              type="submit"
              disabled={profileLoading}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {profileLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  保存更改
                </>
              )}
            </button>
          </div>
        </form>
      </SettingsSection>

      {/* 密码修改 */}
      <SettingsSection
        icon={<Shield className="w-5 h-5" />}
        title="安全设置"
        description="更新您的登录密码"
      >
        <form onSubmit={handlePasswordSubmit}>
          <div className="space-y-5 max-w-md">
            {/* 当前密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-400" />
                  当前密码
                </div>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={e => handlePasswordChange('currentPassword', e.target.value)}
                  className={`w-full px-4 py-2.5 pr-12 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    passwordErrors.currentPassword 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                      : 'border-gray-300 focus:border-gray-500 focus:ring-gray-200'
                  }`}
                  placeholder="输入当前密码"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordErrors.currentPassword && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {passwordErrors.currentPassword}
                </p>
              )}
            </div>

            {/* 新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-400" />
                  新密码
                </div>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={e => handlePasswordChange('newPassword', e.target.value)}
                  className={`w-full px-4 py-2.5 pr-12 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    passwordErrors.newPassword 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                      : 'border-gray-300 focus:border-gray-500 focus:ring-gray-200'
                  }`}
                  placeholder="输入新密码"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordErrors.newPassword && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {passwordErrors.newPassword}
                </p>
              )}
              
              {/* 密码强度指示器 */}
              {passwordForm.newPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">密码强度</span>
                    <span className={`font-medium ${
                      passwordStrength.strength <= 1 ? 'text-red-500' :
                      passwordStrength.strength <= 2 ? 'text-yellow-500' :
                      passwordStrength.strength <= 3 ? 'text-blue-500' :
                      'text-green-500'
                    }`}>{passwordStrength.text}</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(level => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          level <= passwordStrength.strength 
                            ? passwordStrength.color 
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 确认新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-400" />
                  确认新密码
                </div>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={e => handlePasswordChange('confirmPassword', e.target.value)}
                  className={`w-full px-4 py-2.5 pr-12 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    passwordErrors.confirmPassword 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                      : 'border-gray-300 focus:border-gray-500 focus:ring-gray-200'
                  }`}
                  placeholder="再次输入新密码"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordErrors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {passwordErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          {/* 消息提示 */}
          {passwordMessage && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 max-w-md ${
              passwordMessage.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {passwordMessage.type === 'success' ? (
                <Check className="w-4 h-4" />
              ) : (
                <X className="w-4 h-4" />
              )}
              {passwordMessage.text}
            </div>
          )}

          {/* 更新按钮 */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={passwordLoading}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {passwordLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  更新中...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  更新密码
                </>
              )}
            </button>
          </div>
        </form>
      </SettingsSection>

    </div>
  )
}