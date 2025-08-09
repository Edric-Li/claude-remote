import * as fs from 'fs-extra'
import * as path from 'path'
import * as crypto from 'crypto'
import { simpleGit, SimpleGit } from 'simple-git'
import chalk from 'chalk'

export interface RepositoryConfig {
  id: string
  name: string
  url: string
  branch?: string
  credentials?: string
  settings?: {
    autoUpdate?: boolean
    cachePath?: string
  }
}

export interface WorkspaceInfo {
  id: string
  path: string
  repositoryId: string
  createdAt: Date
}

export class RepositoryManager {
  private cacheDir: string
  private workspaceDir: string
  private activeWorkspaces: Map<string, WorkspaceInfo> = new Map()

  constructor(baseDir?: string) {
    const base = baseDir || path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.ai-orchestra')
    this.cacheDir = path.join(base, 'cache')
    this.workspaceDir = path.join(base, 'workspaces')
    
    // 确保目录存在
    fs.ensureDirSync(this.cacheDir)
    fs.ensureDirSync(this.workspaceDir)
  }

  /**
   * 获取仓库的缓存路径
   */
  private getCachePath(repositoryId: string): string {
    return path.join(this.cacheDir, `repo-${repositoryId}`)
  }

  /**
   * 解密凭据
   */
  private decryptCredentials(encrypted: string): string {
    const algorithm = 'aes-256-cbc'
    const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me', 'utf8')
    const keyBuffer = crypto.createHash('sha256').update(key).digest()
    
    const [ivHex, encryptedData] = encrypted.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv)
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }

  /**
   * 构建带认证的 Git URL
   */
  private buildAuthUrl(url: string, credentials?: string): string {
    if (!credentials) return url

    try {
      const decrypted = this.decryptCredentials(credentials)
      const urlObj = new URL(url)
      
      // 处理不同的认证格式
      if (decrypted.includes(':')) {
        // username:password 或 username:token
        const [username, password] = decrypted.split(':')
        urlObj.username = username
        urlObj.password = password
      } else {
        // 仅 token (GitHub PAT, GitLab token 等)
        urlObj.username = decrypted
        urlObj.password = ''
      }
      
      return urlObj.toString()
    } catch (error) {
      console.error(chalk.yellow('警告：凭据解密失败，使用原始 URL'))
      return url
    }
  }

  /**
   * 克隆或更新仓库到缓存
   */
  async ensureRepository(config: RepositoryConfig): Promise<string> {
    const cachePath = config.settings?.cachePath || this.getCachePath(config.id)
    const exists = await fs.pathExists(cachePath)
    
    if (!exists) {
      console.log(chalk.blue(`📦 克隆仓库 ${config.name} 到缓存...`))
      
      const authUrl = this.buildAuthUrl(config.url, config.credentials)
      const git: SimpleGit = simpleGit()
      
      try {
        await git.clone(authUrl, cachePath, [
          '--depth', '1',  // 浅克隆以节省空间
          '--branch', config.branch || 'main'
        ])
        
        console.log(chalk.green(`✅ 仓库克隆成功`))
      } catch (error) {
        // 如果主分支失败，尝试 master
        if (error.message.includes('branch') && !config.branch) {
          console.log(chalk.yellow('尝试使用 master 分支...'))
          await git.clone(authUrl, cachePath, [
            '--depth', '1',
            '--branch', 'master'
          ])
        } else {
          throw error
        }
      }
    } else if (config.settings?.autoUpdate !== false) {
      console.log(chalk.blue(`🔄 更新缓存的仓库 ${config.name}...`))
      
      const git: SimpleGit = simpleGit(cachePath)
      
      try {
        // 设置远程 URL（包含认证）
        const authUrl = this.buildAuthUrl(config.url, config.credentials)
        await git.remote(['set-url', 'origin', authUrl])
        
        // 拉取最新代码
        await git.fetch(['--depth', '1'])
        await git.reset(['--hard', `origin/${config.branch || 'main'}`])
        
        console.log(chalk.green(`✅ 仓库更新成功`))
      } catch (error) {
        console.error(chalk.yellow(`⚠️ 更新失败，使用现有缓存: ${error.message}`))
      }
    } else {
      console.log(chalk.gray(`📂 使用缓存的仓库 ${config.name}`))
    }
    
    return cachePath
  }

  /**
   * 创建独立的工作区
   */
  async createWorkspace(config: RepositoryConfig, taskId: string): Promise<WorkspaceInfo> {
    // 确保仓库在缓存中
    const cachePath = await this.ensureRepository(config)
    
    // 创建工作区 ID 和路径
    const workspaceId = `${taskId}-${Date.now()}`
    const workspacePath = path.join(this.workspaceDir, workspaceId)
    
    console.log(chalk.blue(`🏗️ 创建工作区 ${workspaceId}...`))
    
    // 复制缓存到工作区
    await fs.copy(cachePath, workspacePath, {
      filter: (src) => {
        // 排除 .git 目录以节省空间（如果不需要 git 操作）
        // return !src.includes('.git')
        return true  // 保留 .git 以支持 git 操作
      }
    })
    
    // 如果需要切换分支
    if (config.branch) {
      const git: SimpleGit = simpleGit(workspacePath)
      try {
        await git.checkout(config.branch)
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ 无法切换到分支 ${config.branch}: ${error.message}`))
      }
    }
    
    const workspace: WorkspaceInfo = {
      id: workspaceId,
      path: workspacePath,
      repositoryId: config.id,
      createdAt: new Date()
    }
    
    this.activeWorkspaces.set(workspaceId, workspace)
    console.log(chalk.green(`✅ 工作区创建成功: ${workspacePath}`))
    
    return workspace
  }

  /**
   * 清理工作区
   */
  async cleanupWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.activeWorkspaces.get(workspaceId)
    if (!workspace) {
      console.warn(chalk.yellow(`⚠️ 工作区不存在: ${workspaceId}`))
      return
    }
    
    console.log(chalk.blue(`🧹 清理工作区 ${workspaceId}...`))
    
    try {
      await fs.remove(workspace.path)
      this.activeWorkspaces.delete(workspaceId)
      console.log(chalk.green(`✅ 工作区清理成功`))
    } catch (error) {
      console.error(chalk.red(`❌ 清理失败: ${error.message}`))
    }
  }

  /**
   * 清理所有过期的工作区
   */
  async cleanupOldWorkspaces(maxAgeHours: number = 24): Promise<void> {
    const now = Date.now()
    const maxAge = maxAgeHours * 60 * 60 * 1000
    
    for (const [id, workspace] of this.activeWorkspaces) {
      const age = now - workspace.createdAt.getTime()
      if (age > maxAge) {
        await this.cleanupWorkspace(id)
      }
    }
  }

  /**
   * 获取所有活动工作区
   */
  getActiveWorkspaces(): WorkspaceInfo[] {
    return Array.from(this.activeWorkspaces.values())
  }

  /**
   * 清理所有缓存和工作区
   */
  async cleanAll(): Promise<void> {
    console.log(chalk.blue('🧹 清理所有缓存和工作区...'))
    
    // 清理所有工作区
    for (const id of this.activeWorkspaces.keys()) {
      await this.cleanupWorkspace(id)
    }
    
    // 清理缓存目录
    await fs.emptyDir(this.cacheDir)
    
    console.log(chalk.green('✅ 全部清理完成'))
  }
}