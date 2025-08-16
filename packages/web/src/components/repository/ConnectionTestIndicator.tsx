import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Clock,
  Pause,
  RotateCcw,
  Play,
  Timer
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { Progress } from '../ui/progress'

interface TestResult {
  success: boolean
  message: string
  details?: {
    branches?: string[]
    defaultBranch?: string
    isGitRepo?: boolean
    errorType?: string
  }
  retryCount?: number
  duration?: number
  timestamp?: string
  retryDetails?: Array<{
    attempt: number
    success: boolean
    error?: string
    duration: number
    timestamp: string
  }>
}

interface TestState {
  state: 'idle' | 'testing' | 'success' | 'error' | 'cancelled'
  progress: number
  retryCount: number
  maxRetries: number
  currentAttempt: number
  startTime?: number
  duration?: number
  canRetry: boolean
  cancelled: boolean
  result?: TestResult
}

interface ConnectionTestIndicatorProps {
  testState: TestState
  onCancel?: () => void
  onRetry?: () => void
  className?: string
  variant?: 'default' | 'compact' | 'detailed'
  showProgressBar?: boolean
  showCircularProgress?: boolean
  animated?: boolean
}

export function ConnectionTestIndicator({
  testState,
  onCancel,
  onRetry,
  className,
  variant = 'default',
  showProgressBar = true,
  showCircularProgress = false,
  animated = true
}: ConnectionTestIndicatorProps) {
  const { state, progress, retryCount, maxRetries, currentAttempt, startTime, duration, canRetry, result } = testState

  // 计算预计剩余时间
  const getEstimatedRemainingTime = () => {
    if (!startTime || state !== 'testing') return null
    const elapsed = Date.now() - startTime
    const estimatedTotal = 15000 // 15秒预计总时间
    const remaining = Math.max(0, estimatedTotal - elapsed)
    return remaining
  }

  const remainingTime = getEstimatedRemainingTime()

  // 获取状态图标
  const getStatusIcon = () => {
    const iconClass = cn(
      'flex-shrink-0 transition-all duration-200',
      variant === 'compact' ? 'w-3 h-3' : 'w-4 h-4'
    )

    switch (state) {
      case 'testing':
        return (
          <Loader2
            className={cn(
              iconClass,
              'text-blue-500',
              animated && 'animate-spin'
            )}
          />
        )
      case 'success':
        return <CheckCircle className={cn(iconClass, 'text-green-500')} />
      case 'error':
        return <XCircle className={cn(iconClass, 'text-red-500')} />
      case 'cancelled':
        return <AlertCircle className={cn(iconClass, 'text-yellow-500')} />
      default:
        return null
    }
  }

  // 获取状态文本
  const getStatusText = () => {
    switch (state) {
      case 'testing':
        return '连接测试中...'
      case 'success':
        return '连接测试成功'
      case 'error':
        return '连接测试失败'
      case 'cancelled':
        return '测试已取消'
      default:
        return '等待测试'
    }
  }

  // 获取状态颜色
  const getStatusColor = () => {
    switch (state) {
      case 'testing':
        return 'text-blue-600'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'cancelled':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  // 获取进度条颜色
  const getProgressColor = () => {
    switch (state) {
      case 'testing':
        return 'bg-blue-500'
      case 'success':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      case 'cancelled':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-300'
    }
  }

  // 格式化时间显示
  const formatTime = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`
    }
    return `${(ms / 1000).toFixed(1)}s`
  }

  if (state === 'idle') {
    return null
  }

  // 紧凑模式
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {getStatusIcon()}
        <span className={cn('text-xs', getStatusColor())}>
          {getStatusText()}
        </span>
        {progress > 0 && state === 'testing' && (
          <span className="text-xs text-gray-500">
            {Math.round(progress)}%
          </span>
        )}
        {duration && state !== 'testing' && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(duration)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* 状态信息 */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className={getStatusColor()}>
            {getStatusText()}
          </span>
          
          {/* 重试信息 */}
          {state === 'testing' && currentAttempt > 1 && (
            <span className="text-gray-500 text-xs">
              (重试 {retryCount}/{maxRetries})
            </span>
          )}
        </div>

        {/* 时间信息 */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {/* 已用时间 */}
          {duration && state !== 'testing' && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatTime(duration)}</span>
            </div>
          )}
          
          {/* 剩余时间 */}
          {remainingTime && state === 'testing' && (
            <div className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              <span>约 {formatTime(remainingTime)}</span>
            </div>
          )}
          
          {/* 进度百分比 */}
          {progress > 0 && (
            <span>{Math.round(progress)}%</span>
          )}
        </div>
      </div>

      {/* 进度条 */}
      {showProgressBar && progress > 0 && (
        <div className="space-y-1">
          {variant === 'detailed' ? (
            <Progress
              value={progress}
              className="h-2 bg-gray-200"
            />
          ) : (
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  getProgressColor()
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* 圆形进度指示器 */}
      {showCircularProgress && state === 'testing' && (
        <div className="flex justify-center">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="4"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="175.929"
                strokeDashoffset={175.929 * (1 - progress / 100)}
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {/* 取消按钮 */}
        {state === 'testing' && onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-300 rounded-md hover:bg-red-50 transition-colors flex items-center gap-1.5"
          >
            <Pause className="w-3 h-3" />
            取消测试
          </button>
        )}

        {/* 重试按钮 */}
        {canRetry && state !== 'testing' && onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            重试测试
          </button>
        )}
      </div>

      {/* 详细信息 */}
      {variant === 'detailed' && result && (
        <div
          className={cn(
            'p-3 rounded-md text-xs border',
            result.success
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          )}
        >
          <div className="flex items-start gap-2">
            {result.success ? (
              <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1 space-y-1">
              <div>{result.message}</div>
              
              {/* 重试详情 */}
              {result.retryCount !== undefined && result.retryCount > 0 && (
                <div className="opacity-75">
                  重试次数: {result.retryCount}
                </div>
              )}
              
              {/* 分支信息 */}
              {result.details?.branches && result.details.branches.length > 0 && (
                <div className="opacity-75">
                  可用分支: {result.details.branches.slice(0, 3).join(', ')}
                  {result.details.branches.length > 3 && ` 等 ${result.details.branches.length} 个`}
                </div>
              )}
              
              {/* 错误建议 */}
              {!result.success && result.details?.errorType && (
                <div className="opacity-75 mt-1">
                  {result.details.errorType === 'auth' && '💡 建议: 检查认证凭据是否正确'}
                  {result.details.errorType === 'timeout' && '💡 建议: 检查网络连接或仓库服务器状态'}
                  {result.details.errorType === 'not_found' && '💡 建议: 确认仓库URL是否正确'}
                  {result.details.errorType === 'network' && '💡 建议: 检查网络连接，稍后重试'}
                  {result.details.errorType === 'permission_denied' && '💡 建议: 检查账户是否有访问权限'}
                  {result.details.errorType === 'cancelled' && '💡 测试已被用户取消'}
                  {result.details.errorType === 'connection_reset' && '💡 建议: 连接被重置，请检查防火墙设置'}
                  {result.details.errorType === 'dns_resolution' && '💡 建议: DNS解析失败，请检查域名是否正确'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 导出类型以供外部使用
export type { TestState, TestResult, ConnectionTestIndicatorProps }