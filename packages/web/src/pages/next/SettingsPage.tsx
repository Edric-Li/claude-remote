import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  User,
  Database,
  Bot,
  Shield,
  Bell,
  Palette,
  Globe,
  Sparkles,
  Menu,
  X
} from 'lucide-react'
import { RepositoryManager } from '../../components/repository/RepositoryManager'
import { AgentSettings } from '../../components/settings/AgentSettings'
import { ProfileSettings } from '../../components/settings/ProfileSettings'
// import { AppearanceSettings } from '../../components/settings/AppearanceSettings'

interface SettingsNavItemProps {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
}

function SettingsNavItem({ icon, label, isActive, onClick }: SettingsNavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
        isActive
          ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      <div className="w-4 h-4">{icon}</div>
      {label}
    </button>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('profile')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const sections = [
    { id: 'profile', label: '个人资料', icon: <User className="w-4 h-4" /> },
    { id: 'repositories', label: '仓库管理', icon: <Database className="w-4 h-4" /> },
    { id: 'agents', label: 'Agent配置', icon: <Bot className="w-4 h-4" /> },
    { id: 'assistants', label: '助手管理', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'security', label: '安全设置', icon: <Shield className="w-4 h-4" /> },
    { id: 'notifications', label: '通知设置', icon: <Bell className="w-4 h-4" /> },
    { id: 'appearance', label: '外观设置', icon: <Palette className="w-4 h-4" /> }
  ]

  const renderProfileSettings = () => <ProfileSettings />

  const renderRepositorySettings = () => <RepositoryManager />

  const renderAgentSettings = () => <AgentSettings />

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSettings()
      case 'repositories':
        return renderRepositorySettings()
      case 'agents':
        return renderAgentSettings()
      case 'appearance':
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">外观设置功能正在开发中...</p>
          </div>
        )
      case 'assistants':
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">助手功能正在开发中...</p>
          </div>
        )
      default:
        return (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Globe className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">功能开发中</h3>
            <p className="text-gray-600">该设置功能正在开发中，敬请期待</p>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col lg:flex-row">
      {/* 移动端顶部导航栏 */}
      <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回主页
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute inset-x-0 top-14 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-lg">
          <nav className="p-4 space-y-1">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id)
                  setMobileMenuOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  activeSection === section.id
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* 桌面端左侧导航 */}
      <div className="hidden lg:block w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 h-screen sticky top-0 overflow-y-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回主页
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">设置</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">管理您的账户和系统配置</p>
        </div>

        <nav className="space-y-1">
          {sections.map(section => (
            <SettingsNavItem
              key={section.id}
              icon={section.icon}
              label={section.label}
              isActive={activeSection === section.id}
              onClick={() => setActiveSection(section.id)}
            />
          ))}
        </nav>
      </div>

      {/* 右侧内容 - 响应式 */}
      <div className="flex-1 p-4 lg:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {sections.find(s => s.id === activeSection)?.label}
            </h1>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
