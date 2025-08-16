import { useState, useEffect } from 'react'
import ConnectionTestIndicator, { type TestState } from './ConnectionTestIndicator'

/**
 * ConnectionTestIndicator 组件示例
 * 展示不同状态和变体的使用方式
 */
export function ConnectionTestIndicatorExample() {
  const [testStates, setTestStates] = useState<{ [key: string]: TestState }>({
    testing: {
      state: 'testing',
      progress: 45,
      retryCount: 1,
      maxRetries: 3,
      currentAttempt: 2,
      startTime: Date.now() - 5000,
      duration: 5000,
      canRetry: false,
      cancelled: false
    },
    success: {
      state: 'success',
      progress: 100,
      retryCount: 1,
      maxRetries: 3,
      currentAttempt: 2,
      startTime: Date.now() - 8000,
      duration: 8000,
      canRetry: false,
      cancelled: false,
      result: {
        success: true,
        message: '连接测试成功',
        details: {
          branches: ['main', 'develop', 'feature/auth', 'hotfix/bug-123'],
          defaultBranch: 'main',
          isGitRepo: true
        },
        retryCount: 1,
        duration: 8000
      }
    },
    error: {
      state: 'error',
      progress: 100,
      retryCount: 3,
      maxRetries: 3,
      currentAttempt: 3,
      startTime: Date.now() - 12000,
      duration: 12000,
      canRetry: true,
      cancelled: false,
      result: {
        success: false,
        message: '认证失败：无效的访问令牌',
        details: {
          errorType: 'auth'
        },
        retryCount: 3,
        duration: 12000
      }
    },
    cancelled: {
      state: 'cancelled',
      progress: 60,
      retryCount: 0,
      maxRetries: 3,
      currentAttempt: 1,
      startTime: Date.now() - 3000,
      duration: 3000,
      canRetry: true,
      cancelled: true,
      result: {
        success: false,
        message: '测试已取消',
        details: {
          errorType: 'cancelled'
        }
      }
    }
  })

  // 模拟进度更新
  useEffect(() => {
    const interval = setInterval(() => {
      setTestStates(prev => ({
        ...prev,
        testing: {
          ...prev.testing,
          progress: Math.min(prev.testing.progress + 2, 95),
          duration: Date.now() - prev.testing.startTime!
        }
      }))
    }, 200)

    return () => clearInterval(interval)
  }, [])

  const handleCancel = (key: string) => {
    console.log(`取消测试: ${key}`)
    setTestStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        state: 'cancelled',
        cancelled: true,
        canRetry: true
      }
    }))
  }

  const handleRetry = (key: string) => {
    console.log(`重试测试: ${key}`)
    setTestStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        state: 'testing',
        progress: 0,
        startTime: Date.now(),
        cancelled: false,
        canRetry: false,
        currentAttempt: prev[key].currentAttempt + 1,
        retryCount: prev[key].retryCount + 1
      }
    }))
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ConnectionTestIndicator 组件示例
        </h1>
        <p className="text-gray-600">
          展示连接测试进度指示器的不同状态和变体
        </p>
      </div>

      {/* 默认变体 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">默认变体 (default)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(testStates).map(([key, state]) => (
            <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3 capitalize">
                {key} 状态
              </h3>
              <ConnectionTestIndicator
                testState={state}
                onCancel={() => handleCancel(key)}
                onRetry={() => handleRetry(key)}
                variant="default"
              />
            </div>
          ))}
        </div>
      </section>

      {/* 紧凑变体 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">紧凑变体 (compact)</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          {Object.entries(testStates).map(([key, state]) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <span className="text-sm font-medium text-gray-700 capitalize w-20">
                {key}:
              </span>
              <div className="flex-1">
                <ConnectionTestIndicator
                  testState={state}
                  onCancel={() => handleCancel(key)}
                  onRetry={() => handleRetry(key)}
                  variant="compact"
                  showProgressBar={false}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 详细变体 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">详细变体 (detailed)</h2>
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">测试成功状态</h3>
            <ConnectionTestIndicator
              testState={testStates.success}
              onRetry={() => handleRetry('success')}
              variant="detailed"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">测试失败状态</h3>
            <ConnectionTestIndicator
              testState={testStates.error}
              onRetry={() => handleRetry('error')}
              variant="detailed"
            />
          </div>
        </div>
      </section>

      {/* 圆形进度指示器 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">圆形进度指示器</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <ConnectionTestIndicator
            testState={testStates.testing}
            onCancel={() => handleCancel('testing')}
            variant="default"
            showCircularProgress={true}
            showProgressBar={false}
          />
        </div>
      </section>

      {/* 功能说明 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">功能特性</h2>
        <div className="bg-gray-50 rounded-lg p-6">
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• <strong>多种变体</strong>：支持 default、compact、detailed 三种显示模式</li>
            <li>• <strong>实时进度</strong>：显示测试进度、耗时和预计剩余时间</li>
            <li>• <strong>重试机制</strong>：显示重试次数，支持手动重试操作</li>
            <li>• <strong>取消功能</strong>：支持取消正在进行的测试</li>
            <li>• <strong>状态指示</strong>：清晰的图标和颜色表示不同状态</li>
            <li>• <strong>错误建议</strong>：基于错误类型提供解决建议</li>
            <li>• <strong>响应式设计</strong>：适配不同屏幕尺寸</li>
            <li>• <strong>无障碍访问</strong>：支持键盘导航和屏幕阅读器</li>
          </ul>
        </div>
      </section>
    </div>
  )
}