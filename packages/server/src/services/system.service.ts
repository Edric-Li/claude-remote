import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import * as os from 'os'
import * as process from 'process'

export interface SystemOverview {
  platform: {
    name: string
    version: string
    arch: string
    hostname: string
    uptime: string
  }
  resources: {
    cpu: {
      cores: number
      usage: number
      model: string
    }
    memory: {
      total: string
      free: string
      used: string
      usage: number
    }
    disk: {
      total: string
      free: string
      used: string
      usage: number
    }
  }
  application: {
    version: string
    nodeVersion: string
    environment: string
    uptime: string
    port: number
  }
  statistics: {
    totalAgents: number
    connectedAgents: number
    totalWorkers: number
    activeWorkers: number
    totalTasks: number
    completedTasks: number
    failedTasks: number
    pendingTasks: number
  }
  recentActivity: Array<{
    id: string
    type:
      | 'agent_connected'
      | 'agent_disconnected'
      | 'task_created'
      | 'task_completed'
      | 'task_failed'
    message: string
    timestamp: string
  }>
}

@Injectable()
export class SystemService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource
  ) {}

  /**
   * 获取系统概览
   */
  async getSystemOverview(): Promise<SystemOverview> {
    const cpus = os.cpus()
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory

    // 计算 CPU 使用率
    const cpuUsage = this.calculateCPUUsage()

    // 获取统计数据
    const statistics = await this.getStatistics()

    // 获取最近活动
    const recentActivity = await this.getRecentActivity()

    return {
      platform: {
        name: os.platform(),
        version: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: this.formatUptime(os.uptime())
      },
      resources: {
        cpu: {
          cores: cpus.length,
          usage: cpuUsage,
          model: cpus[0]?.model || 'Unknown'
        },
        memory: {
          total: this.formatBytes(totalMemory),
          free: this.formatBytes(freeMemory),
          used: this.formatBytes(usedMemory),
          usage: Math.round((usedMemory / totalMemory) * 100)
        },
        disk: {
          total: '100 GB', // TODO: 实际获取磁盘信息
          free: '50 GB',
          used: '50 GB',
          usage: 50
        }
      },
      application: {
        version: '0.1.0',
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        uptime: this.formatUptime(process.uptime()),
        port: parseInt(process.env.PORT || '3000')
      },
      statistics,
      recentActivity
    }
  }

  /**
   * 获取统计数据
   */
  private async getStatistics() {
    try {
      // 获取 Agent 统计
      const agentStats = await this.dataSource.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as connected
        FROM agents
      `)

      const totalAgents = parseInt(agentStats[0]?.total) || 0
      const connectedAgents = parseInt(agentStats[0]?.connected) || 0

      // 计算 Worker 数量（基于连接的 Agent 的 maxWorkers）
      const workerStats = await this.dataSource.query(`
        SELECT SUM(maxWorkers) as totalWorkers
        FROM agents
        WHERE status = 'connected'
      `)

      const totalWorkers = parseInt(workerStats[0]?.totalWorkers) || 0

      return {
        totalAgents,
        connectedAgents,
        totalWorkers,
        activeWorkers: 0, // TODO: 实际统计活动的 Worker
        totalTasks: 0, // TODO: 实际统计任务
        completedTasks: 0,
        failedTasks: 0,
        pendingTasks: 0
      }
    } catch (error) {
      console.error('Failed to get statistics:', error)
      return {
        totalAgents: 0,
        connectedAgents: 0,
        totalWorkers: 0,
        activeWorkers: 0,
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        pendingTasks: 0
      }
    }
  }

  /**
   * 获取最近活动
   */
  private async getRecentActivity() {
    // TODO: 实际从活动日志中获取
    return [
      {
        id: '1',
        type: 'agent_connected' as const,
        message: 'Agent "生产环境 Agent" 已连接',
        timestamp: new Date().toISOString()
      },
      {
        id: '2',
        type: 'task_completed' as const,
        message: '任务 "代码重构" 已完成',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: '3',
        type: 'agent_disconnected' as const,
        message: 'Agent "测试 Agent" 已断开',
        timestamp: new Date(Date.now() - 7200000).toISOString()
      }
    ]
  }

  /**
   * 计算 CPU 使用率
   */
  private calculateCPUUsage(): number {
    const cpus = os.cpus()
    let totalIdle = 0
    let totalTick = 0

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type]
      }
      totalIdle += cpu.times.idle
    })

    const idle = totalIdle / cpus.length
    const total = totalTick / cpus.length
    const usage = 100 - ~~((100 * idle) / total)

    return usage
  }

  /**
   * 格式化字节
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 格式化运行时间
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    const parts = []
    if (days > 0) parts.push(`${days}天`)
    if (hours > 0) parts.push(`${hours}小时`)
    if (minutes > 0) parts.push(`${minutes}分钟`)

    return parts.join(' ') || '刚刚启动'
  }
}
