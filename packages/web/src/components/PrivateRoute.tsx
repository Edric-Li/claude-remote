import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { Loader2 } from 'lucide-react'

export function PrivateRoute() {
  const { isAuthenticated, isLoading, accessToken, hasHydrated } = useAuthStore()
  const location = useLocation()

  // 开发模式：检查localStorage中是否有测试token，如果有就直接通过
  const authStorage = localStorage.getItem('auth-storage')
  if (authStorage) {
    try {
      const parsed = JSON.parse(authStorage)
      if (parsed.state?.accessToken === 'test-token-for-development') {
        console.log('🔧 开发模式：使用测试token绕过认证检查')
        return <Outlet />
      }
    } catch (e) {
      // 忽略解析错误
    }
  }

  // 等待 store 从 localStorage 恢复数据
  if (!hasHydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
          <p className="text-sm text-gray-500">加载中...</p>
        </div>
      </div>
    )
  }

  // 加载中状态
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
          <p className="text-sm text-gray-500">验证登录状态...</p>
        </div>
      </div>
    )
  }

  // 未登录，重定向到登录页，并保存当前路径
  if (!isAuthenticated || !accessToken) {
    // 根据当前路径决定重定向到哪个登录页面
    const loginPath = location.pathname.startsWith('/next/') ? '/next/login' : '/login'
    return <Navigate to={loginPath} state={{ from: location }} replace />
  }

  return <Outlet />
}