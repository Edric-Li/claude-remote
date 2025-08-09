import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { NewSimplifiedHomePage } from './pages/NewSimplifiedHomePage'
import { AdminPage } from './pages/AdminPage'
import { LoginPage } from './pages/LoginPage'
import { PrivateRoute } from './components/PrivateRoute'

export function App() {
  // 设置暗色主题
  React.useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])
  
  return (
    <BrowserRouter>
      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* 需要登录的路由 */}
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<NewSimplifiedHomePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}