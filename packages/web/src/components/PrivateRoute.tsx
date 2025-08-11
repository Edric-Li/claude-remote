import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export function PrivateRoute() {
  const { isAuthenticated, isLoading, accessToken } = useAuthStore()
  const location = useLocation()

  // 检查localStorage中的token
  useEffect(() => {
    // 如果没有token，直接跳转到登录页
    if (!accessToken && !isLoading) {
      console.log('No access token found, redirecting to login')
    }
  }, [accessToken, isLoading])

  // 加载中状态
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <p className="text-sm text-muted-foreground">验证登录状态...</p>
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
