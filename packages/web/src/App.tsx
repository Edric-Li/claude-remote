import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AdminPage } from './pages/AdminPage'
import { PrivateRoute } from './components/PrivateRoute'

// 现代化页面 (使用HTTP通信)
import { LoginPage } from './pages/next/LoginPage'
import { ModernHomePage } from './pages/next/ModernHomePage'
import { SettingsPage } from './pages/next/SettingsPage'

export function App() {
  // 设置暗色主题
  React.useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])
  
  return (
    <BrowserRouter>
      <Routes>
        {/* 主要路由 - 使用现代HTTP通信 */}
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<ModernHomePage />} />
          <Route path="/home" element={<ModernHomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        
        {/* 兼容性路由 */}
        <Route path="/next/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route path="/next/home" element={<ModernHomePage />} />
          <Route path="/next/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}