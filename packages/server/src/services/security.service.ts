import { Injectable } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'

export interface SecuritySettings {
  authentication: {
    enabled: boolean
    method: 'none' | 'basic' | 'token' | 'oauth'
    sessionTimeout: number // 分钟
  }
  ipWhitelist: {
    enabled: boolean
    ips: string[]
  }
  rateLimit: {
    enabled: boolean
    maxRequests: number
    windowMs: number
  }
  encryption: {
    enabled: boolean
    algorithm: string
  }
  audit: {
    enabled: boolean
    logLevel: 'error' | 'warn' | 'info' | 'debug'
    retentionDays: number
  }
  cors: {
    enabled: boolean
    origins: string[]
  }
}

export interface SecurityLog {
  id: string
  type: 'login' | 'logout' | 'access_denied' | 'rate_limit' | 'ip_blocked' | 'error'
  message: string
  ip?: string
  user?: string
  timestamp: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface AccessToken {
  id: string
  name: string
  token: string
  createdAt: string
  lastUsed?: string
  expiresAt?: string
  permissions: string[]
}

@Injectable()
export class SecurityService {
  private settings: SecuritySettings = {
    authentication: {
      enabled: false,
      method: 'none',
      sessionTimeout: 60
    },
    ipWhitelist: {
      enabled: false,
      ips: []
    },
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000
    },
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm'
    },
    audit: {
      enabled: true,
      logLevel: 'info',
      retentionDays: 30
    },
    cors: {
      enabled: true,
      origins: ['http://localhost:5173', 'http://localhost:3000']
    }
  }

  private securityLogs: SecurityLog[] = []
  private accessTokens: AccessToken[] = []

  /**
   * 获取安全设置
   */
  getSecuritySettings(): SecuritySettings {
    return this.settings
  }

  /**
   * 更新安全设置
   */
  updateSecuritySettings(settings: Partial<SecuritySettings>): SecuritySettings {
    this.settings = {
      ...this.settings,
      ...settings
    }
    
    // 记录设置更改
    this.addSecurityLog({
      type: 'access_denied',
      message: '安全设置已更新',
      severity: 'medium'
    })

    return this.settings
  }

  /**
   * 获取安全日志
   */
  getSecurityLogs(limit: number = 100): SecurityLog[] {
    return this.securityLogs.slice(-limit)
  }

  /**
   * 添加安全日志
   */
  private addSecurityLog(log: Omit<SecurityLog, 'id' | 'timestamp'>): void {
    const newLog: SecurityLog = {
      ...log,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    }
    
    this.securityLogs.push(newLog)
    
    // 保持日志数量在合理范围内
    if (this.securityLogs.length > 1000) {
      this.securityLogs = this.securityLogs.slice(-500)
    }
  }

  /**
   * 生成访问令牌
   */
  async generateAccessToken(name: string, permissions: string[] = []): Promise<AccessToken> {
    const token = crypto.randomBytes(32).toString('hex')
    const hashedToken = await bcrypt.hash(token, 10)
    
    const accessToken: AccessToken = {
      id: crypto.randomUUID(),
      name,
      token: hashedToken,
      createdAt: new Date().toISOString(),
      permissions
    }
    
    this.accessTokens.push(accessToken)
    
    // 记录令牌生成
    this.addSecurityLog({
      type: 'access_denied',
      message: `访问令牌 "${name}" 已生成`,
      severity: 'low'
    })
    
    // 返回原始令牌（只在创建时显示一次）
    return {
      ...accessToken,
      token
    }
  }

  /**
   * 获取所有访问令牌
   */
  getAccessTokens(): Omit<AccessToken, 'token'>[] {
    return this.accessTokens.map(({ token, ...rest }) => rest)
  }

  /**
   * 撤销访问令牌
   */
  revokeAccessToken(tokenId: string): boolean {
    const index = this.accessTokens.findIndex(t => t.id === tokenId)
    
    if (index !== -1) {
      const token = this.accessTokens[index]
      this.accessTokens.splice(index, 1)
      
      // 记录令牌撤销
      this.addSecurityLog({
        type: 'access_denied',
        message: `访问令牌 "${token.name}" 已撤销`,
        severity: 'medium'
      })
      
      return true
    }
    
    return false
  }

  /**
   * 验证访问令牌
   */
  async validateAccessToken(token: string): Promise<boolean> {
    for (const accessToken of this.accessTokens) {
      const isValid = await bcrypt.compare(token, accessToken.token)
      if (isValid) {
        // 更新最后使用时间
        accessToken.lastUsed = new Date().toISOString()
        return true
      }
    }
    
    // 记录无效令牌访问
    this.addSecurityLog({
      type: 'access_denied',
      message: '使用了无效的访问令牌',
      severity: 'high'
    })
    
    return false
  }

  /**
   * 检查 IP 白名单
   */
  checkIPWhitelist(ip: string): boolean {
    if (!this.settings.ipWhitelist.enabled) {
      return true
    }
    
    const isAllowed = this.settings.ipWhitelist.ips.includes(ip)
    
    if (!isAllowed) {
      this.addSecurityLog({
        type: 'ip_blocked',
        message: `IP ${ip} 被阻止访问`,
        ip,
        severity: 'high'
      })
    }
    
    return isAllowed
  }

  /**
   * 添加 IP 到白名单
   */
  addIPToWhitelist(ip: string): void {
    if (!this.settings.ipWhitelist.ips.includes(ip)) {
      this.settings.ipWhitelist.ips.push(ip)
      
      this.addSecurityLog({
        type: 'access_denied',
        message: `IP ${ip} 已添加到白名单`,
        severity: 'low'
      })
    }
  }

  /**
   * 从白名单移除 IP
   */
  removeIPFromWhitelist(ip: string): void {
    const index = this.settings.ipWhitelist.ips.indexOf(ip)
    if (index !== -1) {
      this.settings.ipWhitelist.ips.splice(index, 1)
      
      this.addSecurityLog({
        type: 'access_denied',
        message: `IP ${ip} 已从白名单移除`,
        severity: 'low'
      })
    }
  }

  /**
   * 清理过期日志
   */
  cleanupLogs(): number {
    if (!this.settings.audit.enabled) {
      return 0
    }
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.settings.audit.retentionDays)
    
    const initialLength = this.securityLogs.length
    this.securityLogs = this.securityLogs.filter(
      log => new Date(log.timestamp) > cutoffDate
    )
    
    const deletedCount = initialLength - this.securityLogs.length
    
    if (deletedCount > 0) {
      this.addSecurityLog({
        type: 'access_denied',
        message: `已清理 ${deletedCount} 条过期日志`,
        severity: 'low'
      })
    }
    
    return deletedCount
  }
}