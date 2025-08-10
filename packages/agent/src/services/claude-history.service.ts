import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import chalk from 'chalk'

interface MessageEntry {
  type: string
  uuid?: string
  sessionId?: string
  parentUuid?: string
  timestamp?: string
  message?: any
  cwd?: string
  durationMs?: number
  role?: string
  content?: any
}

interface ConversationMessage {
  uuid: string
  type: 'user' | 'assistant' | 'system'
  message: any
  timestamp: string
  sessionId: string
  parentUuid?: string
  cwd?: string
  durationMs?: number
}

/**
 * Service for reading Claude conversation history from local JSONL files
 * Based on CUI's implementation
 */
export class ClaudeHistoryService {
  private claudeHomePath: string
  private cache: Map<string, ConversationMessage[]> = new Map()
  
  constructor() {
    this.claudeHomePath = path.join(os.homedir(), '.claude')
  }
  
  /**
   * Get conversation history for a specific session
   */
  async getConversationHistory(sessionId: string): Promise<ConversationMessage[]> {
    console.log(chalk.blue(`📖 Reading history for session: ${sessionId}`))
    
    // Check cache first
    if (this.cache.has(sessionId)) {
      console.log(chalk.green(`✅ Found cached history for session: ${sessionId}`))
      return this.cache.get(sessionId)!
    }
    
    try {
      // Find the JSONL file for this session
      const messages = await this.parseSessionHistory(sessionId)
      
      // Cache the result
      this.cache.set(sessionId, messages)
      
      console.log(chalk.green(`✅ Loaded ${messages.length} messages for session: ${sessionId}`))
      return messages
    } catch (error) {
      console.error(chalk.red(`❌ Failed to read history: ${error}`))
      return []
    }
  }
  
  /**
   * Parse JSONL files to find messages for a specific session
   */
  private async parseSessionHistory(sessionId: string): Promise<ConversationMessage[]> {
    const projectsPath = path.join(this.claudeHomePath, 'projects')
    
    try {
      const projects = await this.readDirectory(projectsPath)
      const allMessages: ConversationMessage[] = []
      
      // Search through all project directories
      for (const project of projects) {
        const projectPath = path.join(projectsPath, project)
        const stats = await fs.stat(projectPath)
        
        if (!stats.isDirectory()) continue
        
        const files = await this.readDirectory(projectPath)
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'))
        
        // Parse each JSONL file
        for (const file of jsonlFiles) {
          const filePath = path.join(projectPath, file)
          const fileMessages = await this.parseJsonlFile(filePath, sessionId)
          allMessages.push(...fileMessages)
        }
      }
      
      // Sort messages by timestamp
      allMessages.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime()
        const timeB = new Date(b.timestamp || 0).getTime()
        return timeA - timeB
      })
      
      return allMessages
    } catch (error) {
      console.error(chalk.red(`Failed to parse session history: ${error}`))
      return []
    }
  }
  
  /**
   * Parse a single JSONL file and extract messages for a session
   */
  private async parseJsonlFile(filePath: string, targetSessionId: string): Promise<ConversationMessage[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())
      const messages: ConversationMessage[] = []
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as MessageEntry
          
          // Filter by sessionId and message types
          if (entry.sessionId === targetSessionId && 
              (entry.type === 'user' || entry.type === 'assistant' || entry.type === 'system')) {
            
            messages.push({
              uuid: entry.uuid || `${Date.now()}-${Math.random()}`,
              type: entry.type as 'user' | 'assistant' | 'system',
              message: entry.message || { role: entry.role, content: entry.content },
              timestamp: entry.timestamp || new Date().toISOString(),
              sessionId: entry.sessionId,
              parentUuid: entry.parentUuid,
              cwd: entry.cwd,
              durationMs: entry.durationMs
            })
          }
        } catch (parseError) {
          // Skip invalid lines
          continue
        }
      }
      
      return messages
    } catch (error) {
      // File read error, return empty array
      return []
    }
  }
  
  /**
   * Read directory with error handling
   */
  private async readDirectory(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath)
    } catch (error) {
      // Directory doesn't exist
      return []
    }
  }
  
  /**
   * Clear cache for a specific session or all sessions
   */
  clearCache(sessionId?: string): void {
    if (sessionId) {
      this.cache.delete(sessionId)
      console.log(chalk.yellow(`🔄 Cleared cache for session: ${sessionId}`))
    } else {
      this.cache.clear()
      console.log(chalk.yellow(`🔄 Cleared all history cache`))
    }
  }
  
  /**
   * Get the latest Claude session ID from JSONL files
   * This helps recover the session after a restart
   */
  async findClaudeSessionId(workerId: string): Promise<string | null> {
    const projectsPath = path.join(this.claudeHomePath, 'projects')
    
    try {
      const projects = await this.readDirectory(projectsPath)
      
      // Search through recent files to find the session
      for (const project of projects) {
        const projectPath = path.join(projectsPath, project)
        const stats = await fs.stat(projectPath)
        
        if (!stats.isDirectory()) continue
        
        const files = await this.readDirectory(projectPath)
        const jsonlFiles = files
          .filter(f => f.endsWith('.jsonl'))
          .sort((a, b) => b.localeCompare(a)) // Sort by name (usually includes timestamp)
        
        // Check recent files
        for (const file of jsonlFiles.slice(0, 5)) {
          const filePath = path.join(projectPath, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const lines = content.split('\n').filter(line => line.trim())
          
          // Check last few lines for session info
          for (const line of lines.slice(-10)) {
            try {
              const entry = JSON.parse(line)
              if (entry.sessionId || entry.session_id) {
                const sessionId = entry.sessionId || entry.session_id
                console.log(chalk.green(`✅ Found Claude session: ${sessionId}`))
                return sessionId
              }
            } catch {
              continue
            }
          }
        }
      }
      
      return null
    } catch (error) {
      console.error(chalk.red(`Failed to find Claude session: ${error}`))
      return null
    }
  }
}