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
  Key,
  Save,
  Sparkles
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { RepositoryManager } from '../../components/repository/RepositoryManager'
import { AgentSettings } from '../../components/settings/AgentSettings'

interface SettingsSectionProps {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}

function SettingsSection({ icon, title, description, children }: SettingsSectionProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

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
          ? 'bg-gray-100 text-gray-900 font-medium'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      <div className="w-4 h-4">{icon}</div>
      {label}
    </button>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeSection, setActiveSection] = useState('profile')

  const sections = [
    { id: 'profile', label: '个人资料', icon: <User className="w-4 h-4" /> },
    { id: 'repositories', label: '仓库管理', icon: <Database className="w-4 h-4" /> },
    { id: 'agents', label: 'Agent配置', icon: <Bot className="w-4 h-4" /> },
    { id: 'assistants', label: '助手管理', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'security', label: '安全设置', icon: <Shield className="w-4 h-4" /> },
    { id: 'notifications', label: '通知设置', icon: <Bell className="w-4 h-4" /> },
    { id: 'appearance', label: '外观设置', icon: <Palette className="w-4 h-4" /> }
  ]

  const renderProfileSettings = () => (
    <div className="space-y-6">
      <SettingsSection
        icon={<User className="w-4 h-4" />}
        title="基本信息"
        description="管理您的个人资料和账户信息"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
            <input
              type="text"
              defaultValue={user?.username}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder="输入用户名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">显示名称</label>
            <input
              type="text"
              defaultValue={user?.nickname}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder="输入显示名称"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
            <input
              type="email"
              defaultValue={user?.email}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder="输入邮箱地址"
            />
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2">
            <Save className="w-4 h-4" />
            保存更改
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={<Key className="w-4 h-4" />}
        title="密码修改"
        description="更新您的登录密码"
      >
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">当前密码</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder="输入当前密码"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder="输入新密码"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">确认新密码</label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder="再次输入新密码"
            />
          </div>
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
            更新密码
          </button>
        </div>
      </SettingsSection>
    </div>
  )

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
    <div className="min-h-screen bg-gray-50 flex">
      {/* 左侧导航 */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <div className="mb-6">
          <button
            onClick={() => navigate('/next/home')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回主页
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">设置</h2>
          <p className="text-sm text-gray-600">管理您的账户和系统配置</p>
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

      {/* 右侧内容 */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {sections.find(s => s.id === activeSection)?.label}
            </h1>
          </div>

          {renderContent()}
        </div>
      </div>
    </div>
  )
}
