import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Label } from '../ui/label'
import { Button } from '../ui/button'
import { Moon, Sun, Monitor, Type, Palette, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

type Theme = 'light' | 'dark' | 'system'
type FontSize = 'small' | 'medium' | 'large'
type AccentColor = 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'pink'

interface AppearanceState {
  theme: Theme
  fontSize: FontSize
  accentColor: AccentColor
  compactMode: boolean
}

export function AppearanceSettings() {
  const [appearance, setAppearance] = useState<AppearanceState>(() => {
    const saved = localStorage.getItem('appearance-settings')
    if (saved) {
      return JSON.parse(saved)
    }
    return {
      theme: 'system',
      fontSize: 'medium',
      accentColor: 'blue',
      compactMode: false
    }
  })

  // 应用主题
  useEffect(() => {
    const applyTheme = (theme: Theme): void => {
      const root = document.documentElement
      
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (isDark) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      } else if (theme === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    applyTheme(appearance.theme)

    // 监听系统主题变化
    if (appearance.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme('system')
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    return undefined
  }, [appearance.theme])

  // 应用字体大小
  useEffect(() => {
    const root = document.documentElement
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
  }, [appearance.fontSize])

  // 应用强调色
  useEffect(() => {
    const root = document.documentElement
    const colors = ['blue', 'green', 'purple', 'red', 'orange', 'pink']
    
    colors.forEach(color => {
      root.classList.remove(`accent-${color}`)
    })
    
    root.classList.add(`accent-${appearance.accentColor}`)
  }, [appearance.accentColor])

  // 应用紧凑模式
  useEffect(() => {
    const root = document.documentElement
    if (appearance.compactMode) {
      root.classList.add('compact-mode')
    } else {
      root.classList.remove('compact-mode')
    }
  }, [appearance.compactMode])

  // 保存设置
  useEffect(() => {
    localStorage.setItem('appearance-settings', JSON.stringify(appearance))
  }, [appearance])

  const updateAppearance = (key: keyof AppearanceState, value: any) => {
    setAppearance(prev => ({ ...prev, [key]: value }))
  }

  const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: '浅色', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: '深色', icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: '跟随系统', icon: <Monitor className="w-4 h-4" /> }
  ]

  const fontSizes: { value: FontSize; label: string; preview: string }[] = [
    { value: 'small', label: '小', preview: 'text-sm' },
    { value: 'medium', label: '中', preview: 'text-base' },
    { value: 'large', label: '大', preview: 'text-lg' }
  ]

  const accentColors: { value: AccentColor; label: string; className: string }[] = [
    { value: 'blue', label: '蓝色', className: 'bg-blue-500' },
    { value: 'green', label: '绿色', className: 'bg-green-500' },
    { value: 'purple', label: '紫色', className: 'bg-purple-500' },
    { value: 'red', label: '红色', className: 'bg-red-500' },
    { value: 'orange', label: '橙色', className: 'bg-orange-500' },
    { value: 'pink', label: '粉色', className: 'bg-pink-500' }
  ]

  return (
    <div className="space-y-6">
      {/* 主题设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            主题设置
          </CardTitle>
          <CardDescription>
            自定义应用程序的外观和视觉效果
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 主题选择 */}
          <div className="space-y-3">
            <Label>主题模式</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themes.map(theme => (
                <button
                  key={theme.value}
                  onClick={() => updateAppearance('theme', theme.value)}
                  className={cn(
                    'flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all',
                    'hover:bg-gray-50 dark:hover:bg-gray-800',
                    appearance.theme === theme.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 dark:border-gray-700'
                  )}
                >
                  {theme.icon}
                  <span className="text-sm font-medium">{theme.label}</span>
                  {appearance.theme === theme.value && (
                    <Check className="w-4 h-4 ml-auto text-blue-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 强调色 */}
          <div className="space-y-3">
            <Label>强调色</Label>
            <div className="flex flex-wrap gap-3">
              {accentColors.map(color => (
                <button
                  key={color.value}
                  onClick={() => updateAppearance('accentColor', color.value)}
                  className={cn(
                    'relative w-12 h-12 rounded-full transition-transform hover:scale-110',
                    color.className,
                    appearance.accentColor === color.value && 'ring-4 ring-offset-2'
                  )}
                  title={color.label}
                >
                  {appearance.accentColor === color.value && (
                    <Check className="absolute inset-0 m-auto w-6 h-6 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 字体设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="w-5 h-5" />
            字体设置
          </CardTitle>
          <CardDescription>
            调整文字大小以获得最佳阅读体验
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>字体大小</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {fontSizes.map(size => (
                <button
                  key={size.value}
                  onClick={() => updateAppearance('fontSize', size.value)}
                  className={cn(
                    'p-4 rounded-lg border-2 transition-all',
                    'hover:bg-gray-50 dark:hover:bg-gray-800',
                    appearance.fontSize === size.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 dark:border-gray-700'
                  )}
                >
                  <div className={cn('font-medium mb-2', size.preview)}>
                    Aa
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {size.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 紧凑模式 */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div>
              <div className="font-medium">紧凑模式</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                减少元素间距，在屏幕上显示更多内容
              </div>
            </div>
            <button
              onClick={() => updateAppearance('compactMode', !appearance.compactMode)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                appearance.compactMode
                  ? 'bg-blue-500'
                  : 'bg-gray-300 dark:bg-gray-600'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform',
                  appearance.compactMode && 'translate-x-5'
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 预览区域 */}
      <Card>
        <CardHeader>
          <CardTitle>预览</CardTitle>
          <CardDescription>
            实时预览您的外观设置更改
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 rounded-lg bg-gray-50 dark:bg-gray-900 space-y-4">
            <h3 className="text-lg font-semibold">示例标题</h3>
            <p className="text-gray-600 dark:text-gray-400">
              这是一段示例文本，用于展示当前的字体大小和主题效果。
              您可以调整上方的设置来查看不同的视觉效果。
            </p>
            <div className="flex gap-2">
              <Button size="sm">主要按钮</Button>
              <Button size="sm" variant="outline">次要按钮</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 重置设置 */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setAppearance({
              theme: 'system',
              fontSize: 'medium',
              accentColor: 'blue',
              compactMode: false
            })
          }}
        >
          重置为默认设置
        </Button>
      </div>
    </div>
  )
}