import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

// 认证方式枚举
export enum AuthenticationType {
  NONE = 'none',
  GITHUB_PAT = 'github_pat',
  GITLAB_TOKEN = 'gitlab_token',
  BITBUCKET_APP_PASSWORD = 'bitbucket_app_password',
  GENERIC_CREDENTIALS = 'generic_credentials'
}

// 认证数据接口
export interface AuthenticationData {
  type: AuthenticationType
  token?: string
  username?: string
  password?: string
}

// 验证状态接口
export interface ValidationState {
  isValid: boolean
  error?: string
  suggestion?: string
}

// 组件 Props 接口
export interface AuthenticationFieldsProps {
  value: AuthenticationData
  onChange: (data: AuthenticationData) => void
  repositoryUrl?: string
  disabled?: boolean
  className?: string
  showValidation?: boolean
  onValidationChange?: (validation: ValidationState) => void
}

// 平台检测函数
function detectPlatformFromUrl(url: string): AuthenticationType {
  if (!url) return AuthenticationType.GENERIC_CREDENTIALS
  
  const lowerUrl = url.toLowerCase()
  
  if (lowerUrl.includes('github.com')) {
    return AuthenticationType.GITHUB_PAT
  }
  if (lowerUrl.includes('gitlab.com') || lowerUrl.includes('gitlab.')) {
    return AuthenticationType.GITLAB_TOKEN
  }
  if (lowerUrl.includes('bitbucket.org') || lowerUrl.includes('bitbucket.')) {
    return AuthenticationType.BITBUCKET_APP_PASSWORD
  }
  
  return AuthenticationType.GENERIC_CREDENTIALS
}

// 认证方式选项配置
const AUTH_TYPE_OPTIONS = [
  {
    value: AuthenticationType.NONE,
    label: '无需认证',
    description: '公开仓库或已配置 SSH 密钥',
    icon: '🔓'
  },
  {
    value: AuthenticationType.GITHUB_PAT,
    label: 'GitHub Personal Access Token',
    description: 'GitHub 个人访问令牌',
    icon: '🔑'
  },
  {
    value: AuthenticationType.GITLAB_TOKEN,
    label: 'GitLab Access Token',
    description: 'GitLab 个人或项目访问令牌',
    icon: '🗝️'
  },
  {
    value: AuthenticationType.BITBUCKET_APP_PASSWORD,
    label: 'Bitbucket App Password',
    description: 'Bitbucket 应用密码',
    icon: '🔐'
  },
  {
    value: AuthenticationType.GENERIC_CREDENTIALS,
    label: '用户名密码',
    description: '通用 Git 认证',
    icon: '👤'
  }
]

// Token/密码验证函数
function validateToken(type: AuthenticationType, token: string): ValidationState {
  if (!token.trim()) {
    return {
      isValid: false,
      error: '请输入认证信息'
    }
  }

  switch (type) {
    case AuthenticationType.GITHUB_PAT:
      if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
        return {
          isValid: false,
          error: 'GitHub PAT 格式不正确',
          suggestion: '应以 "ghp_" 或 "github_pat_" 开头，例如: ghp_xxxxxxxxxxxxxxxxxxxx'
        }
      }
      if (token.startsWith('ghp_') && token.length !== 40) {
        return {
          isValid: false,
          error: 'GitHub PAT 长度不正确',
          suggestion: 'Classic PAT 应为 40 字符长度'
        }
      }
      break

    case AuthenticationType.GITLAB_TOKEN:
      if (token.startsWith('glpat-') && token.length < 20) {
        return {
          isValid: false,
          error: 'GitLab Token 长度不正确',
          suggestion: 'Personal Access Token 通常为 20+ 字符'
        }
      }
      break

    case AuthenticationType.BITBUCKET_APP_PASSWORD:
      if (!token.includes(':')) {
        return {
          isValid: false,
          error: 'Bitbucket 认证格式不正确',
          suggestion: '应为 "用户名:应用密码" 格式，例如: username:app_password'
        }
      }
      const [username, password] = token.split(':')
      if (!username || !password) {
        return {
          isValid: false,
          error: '用户名或应用密码为空',
          suggestion: '确保格式为 "用户名:应用密码"'
        }
      }
      break

    case AuthenticationType.GENERIC_CREDENTIALS:
      // 对于通用凭据，我们在这里只检查 token 字段（当作密码使用）
      // 用户名会在另外的字段中验证
      break
  }

  return { isValid: true }
}

// 用户名验证函数
function validateUsername(username: string): ValidationState {
  if (!username.trim()) {
    return {
      isValid: false,
      error: '请输入用户名'
    }
  }

  if (username.length < 2) {
    return {
      isValid: false,
      error: '用户名至少需要2个字符'
    }
  }

  return { isValid: true }
}

// 主组件
export const AuthenticationFields: React.FC<AuthenticationFieldsProps> = ({
  value,
  onChange,
  repositoryUrl,
  disabled = false,
  className,
  showValidation = true,
  onValidationChange
}) => {
  const [showPassword, setShowPassword] = React.useState(false)
  const [tokenValidation, setTokenValidation] = React.useState<ValidationState>({ isValid: true })
  const [usernameValidation, setUsernameValidation] = React.useState<ValidationState>({ isValid: true })

  // 根据仓库 URL 自动检测平台
  React.useEffect(() => {
    if (repositoryUrl && value.type === AuthenticationType.NONE) {
      const detectedType = detectPlatformFromUrl(repositoryUrl)
      if (detectedType !== AuthenticationType.GENERIC_CREDENTIALS) {
        onChange({
          ...value,
          type: detectedType
        })
      }
    }
  }, [repositoryUrl, value, onChange])

  // 认证类型变更处理
  const handleTypeChange = (newType: AuthenticationType) => {
    onChange({
      type: newType,
      token: '',
      username: '',
      password: ''
    })
    
    // 重置验证状态
    setTokenValidation({ isValid: true })
    setUsernameValidation({ isValid: true })
  }

  // Token/密码变更处理
  const handleTokenChange = (newToken: string) => {
    const newData = { ...value, token: newToken }
    
    // 对于 Bitbucket，自动解析用户名和密码
    if (value.type === AuthenticationType.BITBUCKET_APP_PASSWORD && newToken.includes(':')) {
      const [username, password] = newToken.split(':')
      newData.username = username
      newData.password = password
    }
    
    onChange(newData)

    // 实时验证
    if (showValidation && newToken) {
      const validation = validateToken(value.type, newToken)
      setTokenValidation(validation)
    } else {
      setTokenValidation({ isValid: true })
    }
  }

  // 用户名变更处理
  const handleUsernameChange = (newUsername: string) => {
    onChange({
      ...value,
      username: newUsername
    })

    // 实时验证
    if (showValidation && newUsername) {
      const validation = validateUsername(newUsername)
      setUsernameValidation(validation)
    } else {
      setUsernameValidation({ isValid: true })
    }
  }

  // 密码变更处理
  const handlePasswordChange = (newPassword: string) => {
    onChange({
      ...value,
      password: newPassword
    })
  }

  // 总体验证状态
  React.useEffect(() => {
    if (onValidationChange) {
      const isFormValid = 
        value.type === AuthenticationType.NONE ||
        (value.type === AuthenticationType.GENERIC_CREDENTIALS 
          ? usernameValidation.isValid && tokenValidation.isValid && value.username && value.password
          : tokenValidation.isValid && value.token)

      onValidationChange({
        isValid: Boolean(isFormValid),
        error: tokenValidation.error || usernameValidation.error
      })
    }
  }, [value, tokenValidation, usernameValidation, onValidationChange])

  // 获取当前认证类型的配置
  const currentAuthOption = AUTH_TYPE_OPTIONS.find(option => option.value === value.type)

  // 获取占位符文本
  const getPlaceholder = (): string => {
    switch (value.type) {
      case AuthenticationType.GITHUB_PAT:
        return 'ghp_xxxxxxxxxxxxxxxxxxxx'
      case AuthenticationType.GITLAB_TOKEN:
        return 'glpat-xxxxxxxxxxxxxxxxxxxx'
      case AuthenticationType.BITBUCKET_APP_PASSWORD:
        return 'username:app_password'
      case AuthenticationType.GENERIC_CREDENTIALS:
        return '输入密码'
      default:
        return ''
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 认证方式选择 */}
      <div className="space-y-2">
        <Label htmlFor="auth-type">认证方式</Label>
        <Select
          value={value.type}
          onValueChange={handleTypeChange}
          disabled={disabled}
        >
          <SelectTrigger id="auth-type">
            <SelectValue placeholder="选择认证方式">
              {currentAuthOption && (
                <div className="flex items-center gap-2">
                  <span>{currentAuthOption.icon}</span>
                  <span>{currentAuthOption.label}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {AUTH_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <span>{option.icon}</span>
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 无需认证说明 */}
      {value.type === AuthenticationType.NONE && (
        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <CheckCircle className="h-4 w-4" />
            <span>此仓库无需认证即可访问</span>
          </div>
        </div>
      )}

      {/* 通用凭据输入字段 */}
      {value.type === AuthenticationType.GENERIC_CREDENTIALS && (
        <div className="space-y-3">
          {/* 用户名字段 */}
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              type="text"
              value={value.username || ''}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="输入用户名"
              disabled={disabled}
              className={cn(
                usernameValidation.error && 'border-red-500 focus-visible:ring-red-500'
              )}
            />
            {showValidation && usernameValidation.error && (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-3 w-3" />
                <span>{usernameValidation.error}</span>
              </div>
            )}
          </div>

          {/* 密码字段 */}
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={value.password || ''}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="输入密码"
                disabled={disabled}
                className={cn(
                  'pr-10',
                  tokenValidation.error && 'border-red-500 focus-visible:ring-red-500'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={disabled}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Token/App Password 输入字段 */}
      {value.type !== AuthenticationType.NONE && value.type !== AuthenticationType.GENERIC_CREDENTIALS && (
        <div className="space-y-2">
          <Label htmlFor="token">
            {value.type === AuthenticationType.GITHUB_PAT && 'Personal Access Token'}
            {value.type === AuthenticationType.GITLAB_TOKEN && 'Access Token'}
            {value.type === AuthenticationType.BITBUCKET_APP_PASSWORD && 'App Password'}
          </Label>
          <div className="relative">
            <Input
              id="token"
              type={showPassword ? 'text' : 'password'}
              value={value.token || ''}
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder={getPlaceholder()}
              disabled={disabled}
              className={cn(
                'pr-10',
                tokenValidation.error && 'border-red-500 focus-visible:ring-red-500'
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={disabled}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* 验证错误信息 */}
          {showValidation && tokenValidation.error && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-3 w-3" />
                <span>{tokenValidation.error}</span>
              </div>
              {tokenValidation.suggestion && (
                <div className="text-xs text-gray-600 dark:text-gray-400 ml-4">
                  {tokenValidation.suggestion}
                </div>
              )}
            </div>
          )}

          {/* Bitbucket 自动解析的用户名显示 */}
          {value.type === AuthenticationType.BITBUCKET_APP_PASSWORD && value.username && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">用户名:</span> {value.username}
            </div>
          )}
        </div>
      )}

      {/* 帮助信息 */}
      {value.type !== AuthenticationType.NONE && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <div className="font-medium mb-1">如何获取认证信息：</div>
            {value.type === AuthenticationType.GITHUB_PAT && (
              <div>
                前往 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
              </div>
            )}
            {value.type === AuthenticationType.GITLAB_TOKEN && (
              <div>
                前往 GitLab → User Settings → Access Tokens → Add new token
              </div>
            )}
            {value.type === AuthenticationType.BITBUCKET_APP_PASSWORD && (
              <div>
                前往 Bitbucket → Personal settings → App passwords → Create app password
              </div>
            )}
            {value.type === AuthenticationType.GENERIC_CREDENTIALS && (
              <div>
                使用您的 Git 服务提供商的用户名和密码
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

AuthenticationFields.displayName = 'AuthenticationFields'

// 导出相关类型和工具函数
export { detectPlatformFromUrl, validateToken, validateUsername }