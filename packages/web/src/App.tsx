import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AdminPage } from './pages/AdminPage'
import { PrivateRoute } from './components/PrivateRoute'

// 现代化页面 (使用HTTP通信)
import { LoginPage } from './pages/next/LoginPage'
import { ModernHomePage } from './pages/next/ModernHomePage'
import { SettingsPage } from './pages/next/SettingsPage'
import { ChatNewPage } from './pages/next/ChatNewPage'

// 测试页面
import { ComponentTestPage } from './pages/ComponentTestPage'

type Theme = 'light' | 'dark' | 'system'
type FontSize = 'small' | 'medium' | 'large'
type AccentColor = 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'pink'

interface AppearanceState {
  theme: Theme
  fontSize: FontSize
  accentColor: AccentColor
  compactMode: boolean
}

export function App() {
  // 初始化主题设置
  React.useEffect(() => {
    // 共用的主题应用函数
    const applyAppearance = (appearance: AppearanceState) => {
      const root = document.documentElement
      
      // 应用主题
      if (appearance.theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', isDark)
      } else {
        root.classList.toggle('dark', appearance.theme === 'dark')
      }

      // 应用字体大小
      root.classList.remove('text-sm', 'text-base', 'text-lg')
      switch (appearance.fontSize) {
        case 'small':
          root.classList.add('text-sm')
          break
        case 'large':
          root.classList.add('text-lg')
          break
        default:
          root.classList.add('text-base')
      }

      // 应用强调色
      const colors = ['blue', 'green', 'purple', 'red', 'orange', 'pink']
      colors.forEach(color => root.classList.remove(`accent-${color}`))
      root.classList.add(`accent-${appearance.accentColor}`)

      // 应用紧凑模式
      root.classList.toggle('compact-mode', appearance.compactMode)
    }

    const initializeTheme = () => {
      const saved = localStorage.getItem('appearance-settings')
      let appearance: AppearanceState
      
      if (saved) {
        appearance = JSON.parse(saved)
      } else {
        appearance = {
          theme: 'system',
          fontSize: 'medium',
          accentColor: 'blue',
          compactMode: false
        }
        localStorage.setItem('appearance-settings', JSON.stringify(appearance))
      }

      applyAppearance(appearance)

      // 监听系统主题变化
      let mediaQueryCleanup: (() => void) | undefined
      if (appearance.theme === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleSystemThemeChange = () => applyAppearance(appearance)
        mediaQuery.addEventListener('change', handleSystemThemeChange)
        mediaQueryCleanup = () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
      }
      
      return mediaQueryCleanup
    }

    const cleanup = initializeTheme()
    
    // 监听主题变化事件
    const handleThemeChange = (event: CustomEvent<AppearanceState>) => {
      applyAppearance(event.detail)
    }
    
    window.addEventListener('theme-changed', handleThemeChange as EventListener)
    
    return () => {
      if (cleanup) cleanup()
      window.removeEventListener('theme-changed', handleThemeChange as EventListener)
    }
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
          <Route path="/test" element={<ComponentTestPage />} />
        </Route>

        {/* 兼容性路由 */}
        <Route path="/next/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route path="/next/home" element={<ModernHomePage />} />
          <Route path="/next/settings" element={<SettingsPage />} />
          <Route path="/next/chat/new" element={<ChatNewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
