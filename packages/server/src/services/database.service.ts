import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface DatabaseInfo {
  type: string
  database: string
  status: 'connected' | 'disconnected' | 'error'
  version?: string
  size?: string
  tables?: TableInfo[]
  lastBackup?: string
  autoBackup: boolean
  backupInterval: string
}

export interface TableInfo {
  name: string
  rowCount: number
  size?: string
}

export interface BackupSettings {
  autoBackup: boolean
  backupInterval: string
  backupPath: string
  maxBackups: number
}

@Injectable()
export class DatabaseService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource
  ) {}

  /**
   * 获取数据库信息
   */
  async getDatabaseInfo(): Promise<DatabaseInfo> {
    try {
      const isConnected = this.dataSource.isInitialized

      if (!isConnected) {
        return {
          type: 'sqlite',
          database: 'ai-orchestra.db',
          status: 'disconnected',
          autoBackup: false,
          backupInterval: 'daily'
        }
      }

      // 获取数据库文件大小
      const dbPath = path.join(process.cwd(), 'data', 'ai-orchestra.db')
      let dbSize = '0 KB'

      try {
        const stats = await fs.stat(dbPath)
        dbSize = this.formatFileSize(stats.size)
      } catch (error) {
        console.error('Failed to get database file size:', error)
      }

      // 获取所有表的信息
      const tables = await this.getTablesInfo()

      // 获取 SQLite 版本
      const versionResult = await this.dataSource.query('SELECT sqlite_version() as version')
      const version = versionResult[0]?.version || 'Unknown'

      return {
        type: 'sqlite',
        database: 'ai-orchestra.db',
        status: 'connected',
        version,
        size: dbSize,
        tables,
        lastBackup: await this.getLastBackupTime(),
        autoBackup: false,
        backupInterval: 'daily'
      }
    } catch (error) {
      console.error('Failed to get database info:', error)
      return {
        type: 'sqlite',
        database: 'ai-orchestra.db',
        status: 'error',
        autoBackup: false,
        backupInterval: 'daily'
      }
    }
  }

  /**
   * 获取表信息
   */
  private async getTablesInfo(): Promise<TableInfo[]> {
    try {
      // 获取所有表名
      const tablesResult = await this.dataSource.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )

      const tables: TableInfo[] = []

      for (const table of tablesResult) {
        const tableName = table.name

        // 获取每个表的行数
        const countResult = await this.dataSource.query(
          `SELECT COUNT(*) as count FROM ${tableName}`
        )

        tables.push({
          name: tableName,
          rowCount: countResult[0]?.count || 0
        })
      }

      return tables
    } catch (error) {
      console.error('Failed to get tables info:', error)
      return []
    }
  }

  /**
   * 创建数据库备份
   */
  async createBackup(): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupDir = path.join(process.cwd(), 'backups')
      const backupFile = path.join(backupDir, `ai-orchestra-${timestamp}.db`)

      // 确保备份目录存在
      await fs.mkdir(backupDir, { recursive: true })

      // 复制数据库文件
      const dbPath = path.join(process.cwd(), 'data', 'ai-orchestra.db')
      await fs.copyFile(dbPath, backupFile)

      return {
        success: true,
        filename: `ai-orchestra-${timestamp}.db`
      }
    } catch (error) {
      console.error('Failed to create backup:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 恢复数据库
   */
  async restoreBackup(filename: string): Promise<{ success: boolean; error?: string }> {
    try {
      const backupFile = path.join(process.cwd(), 'backups', filename)
      const dbPath = path.join(process.cwd(), 'data', 'ai-orchestra.db')

      // 检查备份文件是否存在
      await fs.access(backupFile)

      // 关闭当前连接
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy()
      }

      // 恢复备份
      await fs.copyFile(backupFile, dbPath)

      // 重新初始化连接
      await this.dataSource.initialize()

      return { success: true }
    } catch (error) {
      console.error('Failed to restore backup:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 获取备份列表
   */
  async getBackupList(): Promise<Array<{ filename: string; size: string; createdAt: string }>> {
    try {
      const backupDir = path.join(process.cwd(), 'backups')

      // 确保备份目录存在
      await fs.mkdir(backupDir, { recursive: true })

      const files = await fs.readdir(backupDir)
      const backups = []

      for (const file of files) {
        if (file.endsWith('.db')) {
          const filePath = path.join(backupDir, file)
          const stats = await fs.stat(filePath)

          backups.push({
            filename: file,
            size: this.formatFileSize(stats.size),
            createdAt: stats.mtime.toISOString()
          })
        }
      }

      // 按创建时间降序排序
      backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      return backups
    } catch (error) {
      console.error('Failed to get backup list:', error)
      return []
    }
  }

  /**
   * 删除备份
   */
  async deleteBackup(filename: string): Promise<{ success: boolean; error?: string }> {
    try {
      const backupFile = path.join(process.cwd(), 'backups', filename)
      await fs.unlink(backupFile)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete backup:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 清理数据库（优化）
   */
  async optimizeDatabase(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.dataSource.query('VACUUM')
      await this.dataSource.query('ANALYZE')
      return { success: true }
    } catch (error) {
      console.error('Failed to optimize database:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 获取最后备份时间
   */
  private async getLastBackupTime(): Promise<string | undefined> {
    try {
      const backups = await this.getBackupList()
      if (backups.length > 0) {
        return backups[0].createdAt
      }
      return undefined
    } catch (error) {
      return undefined
    }
  }

  /**
   * 清除所有对话内容
   */
  async clearAllConversations(): Promise<{
    success: boolean
    deletedSessions?: number
    deletedMessages?: number
    error?: string
  }> {
    try {
      // 获取删除前的统计
      const sessionsCount = await this.dataSource.query('SELECT COUNT(*) as count FROM sessions')
      const messagesCount = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM session_messages'
      )

      const deletedSessions = sessionsCount[0]?.count || 0
      const deletedMessages = messagesCount[0]?.count || 0

      // 删除所有会话消息（由于外键约束，先删除消息）
      await this.dataSource.query('DELETE FROM session_messages')

      // 删除所有会话
      await this.dataSource.query('DELETE FROM sessions')

      return {
        success: true,
        deletedSessions,
        deletedMessages
      }
    } catch (error) {
      console.error('Failed to clear conversations:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 清除指定用户的对话内容
   */
  async clearUserConversations(
    userId: string
  ): Promise<{
    success: boolean
    deletedSessions?: number
    deletedMessages?: number
    error?: string
  }> {
    try {
      // 获取该用户的会话ID列表
      const userSessions = await this.dataSource.query('SELECT id FROM sessions WHERE userId = ?', [
        userId
      ])

      if (userSessions.length === 0) {
        return {
          success: true,
          deletedSessions: 0,
          deletedMessages: 0
        }
      }

      const sessionIds = userSessions.map(s => s.id)
      const placeholders = sessionIds.map(() => '?').join(',')

      // 获取删除前的消息统计
      const messagesCount = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM session_messages WHERE sessionId IN (${placeholders})`,
        sessionIds
      )

      const deletedMessages = messagesCount[0]?.count || 0

      // 删除消息（由于CASCADE设置，删除会话时消息会自动删除，但为了安全起见先删除消息）
      await this.dataSource.query(
        `DELETE FROM session_messages WHERE sessionId IN (${placeholders})`,
        sessionIds
      )

      // 删除会话
      await this.dataSource.query('DELETE FROM sessions WHERE userId = ?', [userId])

      return {
        success: true,
        deletedSessions: sessionIds.length,
        deletedMessages
      }
    } catch (error) {
      console.error('Failed to clear user conversations:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 清除指定会话的消息
   */
  async clearSessionMessages(
    sessionId: string
  ): Promise<{ success: boolean; deletedMessages?: number; error?: string }> {
    try {
      const messagesCount = await this.dataSource.query(
        'SELECT COUNT(*) as count FROM session_messages WHERE sessionId = ?',
        [sessionId]
      )

      const deletedMessages = messagesCount[0]?.count || 0

      await this.dataSource.query('DELETE FROM session_messages WHERE sessionId = ?', [sessionId])

      // 重置会话的统计信息
      await this.dataSource.query(
        'UPDATE sessions SET messageCount = 0, totalTokens = 0, totalCost = 0 WHERE id = ?',
        [sessionId]
      )

      return {
        success: true,
        deletedMessages
      }
    } catch (error) {
      console.error('Failed to clear session messages:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}
