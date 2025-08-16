import React from 'react'
import { 
  Activity, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp,
  Monitor,
  Cpu
} from 'lucide-react'
import type { AgentStatistics as AgentStatsType } from '../../../types/agent.types'

interface AgentStatisticsProps {
  statistics: AgentStatsType
  loading?: boolean
}

export function AgentStatistics({ statistics, loading }: AgentStatisticsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  const stats = [
    {
      label: '总Agent数',
      value: statistics.total || 0,
      icon: <Users className="w-5 h-5 text-blue-500" />,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700'
    },
    {
      label: '已连接',
      value: statistics.connected || 0,
      icon: <CheckCircle className="w-5 h-5 text-green-500" />,
      bgColor: 'bg-green-50',
      textColor: 'text-green-700'
    },
    {
      label: '离线',
      value: statistics.offline || 0,
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      bgColor: 'bg-red-50',
      textColor: 'text-red-700'
    },
    {
      label: '平均响应时间',
      value: `${statistics.avgResponseTime || 0}ms`,
      icon: <Activity className="w-5 h-5 text-purple-500" />,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <div 
          key={index}
          className={`${stat.bgColor} border border-gray-200 rounded-lg p-4`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.textColor}`}>
                {stat.value}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              {stat.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}