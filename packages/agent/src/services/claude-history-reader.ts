import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

interface RawJsonEntry {
  type: string
  uuid?: string
  sessionId?: string
  parentUuid?: string
  timestamp?: string
  message?: any
  cwd?: string
  durationMs?: number
  summary?: string
  leafUuid?: string
}

interface ConversationMessage {
  uuid: string
  sessionId: string
  type: 'user' | 'assistant'
  timestamp: string
  message: any
  cwd?: string
  durationMs?: number
}

interface ConversationSummary {
  sessionId: string
  projectPath: string
  summary: string
  createdAt: string
  updatedAt: string
  messageCount: number
  totalDuration: number
  model?: string
}

/**
 * 读取 Claude 本地历史记录
 * 参考 CUI 的实现，但简化了一些功能
 */
export class ClaudeHistoryReader {
  private claudeHomePath: string

  constructor() {
    this.claudeHomePath = path.join(os.homedir(), '.claude')
  }

  /**
   * 获取指定会话的消息历史
   */
  async fetchConversation(sessionId: string): Promise<ConversationMessage[]> {
    try {
      const allEntries = await this.parseAllJsonlFiles()
      
      // 过滤出指定会话的消息
      const messages = allEntries
        .filter(entry => 
          entry.sessionId === sessionId && 
          (entry.type === 'user' || entry.type === 'assistant')
        )
        .map(entry => ({
          uuid: entry.uuid || '',
          sessionId: entry.sessionId || '',
          type: entry.type as 'user' | 'assistant',
          timestamp: entry.timestamp || new Date().toISOString(),
          message: entry.message,
          cwd: entry.cwd,
          durationMs: entry.durationMs
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      return messages
    } catch (error) {
      console.error(`Failed to fetch conversation ${sessionId}:`, error)
      return []
    }
  }

  /**
   * 获取所有会话列表
   */
  async listConversations(): Promise<ConversationSummary[]> {
    try {
      const allEntries = await this.parseAllJsonlFiles()
      
      // 按会话分组
      const sessionGroups = new Map<string, RawJsonEntry[]>()
      const summaries = new Map<string, string>()
      
      for (const entry of allEntries) {
        // 收集摘要
        if (entry.type === 'summary' && entry.leafUuid && entry.summary) {
          summaries.set(entry.leafUuid, entry.summary)
        }
        
        // 收集消息
        if ((entry.type === 'user' || entry.type === 'assistant') && entry.sessionId) {
          if (!sessionGroups.has(entry.sessionId)) {
            sessionGroups.set(entry.sessionId, [])
          }
          sessionGroups.get(entry.sessionId)!.push(entry)
        }
      }
      
      // 构建会话摘要
      const conversations: ConversationSummary[] = []
      
      for (const [sessionId, entries] of sessionGroups) {
        if (entries.length === 0) continue
        
        // 按时间排序
        const sortedEntries = entries.sort((a, b) => 
          new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
        )
        
        const firstEntry = sortedEntries[0]
        const lastEntry = sortedEntries[sortedEntries.length - 1]
        
        // 查找摘要
        const lastLeafUuid = lastEntry.uuid
        const summary = (lastLeafUuid && summaries.get(lastLeafUuid)) || 
                       this.generateSummaryFromMessages(sortedEntries)
        
        // 计算总时长
        const totalDuration = entries.reduce((sum, e) => sum + (e.durationMs || 0), 0)
        
        conversations.push({
          sessionId,
          projectPath: firstEntry.cwd || '',
          summary,
          createdAt: firstEntry.timestamp || new Date().toISOString(),
          updatedAt: lastEntry.timestamp || new Date().toISOString(),
          messageCount: entries.length,
          totalDuration
        })
      }
      
      // 按更新时间倒序排序
      return conversations.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    } catch (error) {
      console.error('Failed to list conversations:', error)
      return []
    }
  }

  /**
   * 获取会话的工作目录
   */
  async getConversationWorkingDirectory(sessionId: string): Promise<string | null> {
    try {
      const allEntries = await this.parseAllJsonlFiles()
      
      // 查找该会话的第一条消息，获取工作目录
      const sessionEntry = allEntries.find(entry => 
        entry.sessionId === sessionId && 
        entry.cwd &&
        (entry.type === 'user' || entry.type === 'assistant')
      )
      
      return sessionEntry?.cwd || null
    } catch (error) {
      console.error(`Failed to get working directory for session ${sessionId}:`, error)
      return null
    }
  }

  /**
   * 解析所有 JSONL 文件
   */
  private async parseAllJsonlFiles(): Promise<RawJsonEntry[]> {
    const projectsPath = path.join(this.claudeHomePath, 'projects')
    const allEntries: RawJsonEntry[] = []
    
    try {
      const projects = await this.readDirectory(projectsPath)
      
      for (const project of projects) {
        const projectPath = path.join(projectsPath, project)
        const stats = await fs.stat(projectPath)
        
        if (!stats.isDirectory()) continue
        
        const files = await this.readDirectory(projectPath)
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'))
        
        for (const file of jsonlFiles) {
          const filePath = path.join(projectPath, file)
          const entries = await this.parseJsonlFile(filePath)
          allEntries.push(...entries)
        }
      }
    } catch (error) {
      console.error('Failed to parse JSONL files:', error)
    }
    
    return allEntries
  }

  /**
   * 解析单个 JSONL 文件
   */
  private async parseJsonlFile(filePath: string): Promise<RawJsonEntry[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())
      const entries: RawJsonEntry[] = []
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as RawJsonEntry
          entries.push(entry)
        } catch (parseError) {
          console.warn(`Failed to parse line in ${filePath}:`, parseError)
        }
      }
      
      return entries
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error)
      return []
    }
  }

  /**
   * 读取目录（容错）
   */
  private async readDirectory(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  /**
   * 从消息生成摘要
   */
  private generateSummaryFromMessages(entries: RawJsonEntry[]): string {
    const userMessages = entries
      .filter(e => e.type === 'user')
      .slice(0, 3) // 取前3条用户消息
    
    if (userMessages.length === 0) return 'Empty conversation'
    
    // 提取第一条用户消息的文本内容
    const firstMessage = userMessages[0].message
    if (typeof firstMessage === 'string') {
      return firstMessage.substring(0, 100) + (firstMessage.length > 100 ? '...' : '')
    } else if (firstMessage?.content) {
      const content = Array.isArray(firstMessage.content) 
        ? firstMessage.content[0]?.text || ''
        : firstMessage.content
      return content.substring(0, 100) + (content.length > 100 ? '...' : '')
    }
    
    return 'Conversation'
  }
}