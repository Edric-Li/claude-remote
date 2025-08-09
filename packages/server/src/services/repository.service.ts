import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RepositoryEntity } from '../entities/repository.entity'
import * as crypto from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)

@Injectable()
export class RepositoryService {
  private readonly algorithm = 'aes-256-cbc'
  private readonly key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32)
  private readonly iv = crypto.randomBytes(16)

  constructor(
    @InjectRepository(RepositoryEntity)
    private repositoryRepo: Repository<RepositoryEntity>
  ) {}

  async create(data: Partial<RepositoryEntity>) {
    // 如果有凭据，加密存储
    if (data.credentials) {
      data.credentials = this.encrypt(data.credentials)
    }
    
    const repository = this.repositoryRepo.create(data)
    return this.repositoryRepo.save(repository)
  }

  async findAll() {
    const repos = await this.repositoryRepo.find()
    // 不返回凭据
    return repos.map(repo => ({
      ...repo,
      credentials: repo.credentials ? '******' : null
    }))
  }

  async findOne(id: string) {
    const repo = await this.repositoryRepo.findOne({ where: { id } })
    if (repo && repo.credentials) {
      // 不返回真实凭据
      repo.credentials = '******'
    }
    return repo
  }

  async update(id: string, data: Partial<RepositoryEntity>) {
    // 如果更新凭据，需要加密
    if (data.credentials && data.credentials !== '******') {
      data.credentials = this.encrypt(data.credentials)
    } else if (data.credentials === '******') {
      // 如果是掩码，不更新凭据字段
      delete data.credentials
    }
    
    await this.repositoryRepo.update(id, data)
    return this.findOne(id)
  }

  async delete(id: string) {
    await this.repositoryRepo.delete(id)
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string; details?: any }> {
    const repo = await this.repositoryRepo.findOne({ where: { id } })
    if (!repo) {
      return { success: false, message: '仓库不存在' }
    }

    try {
      if (repo.type === 'git') {
        // 验证URL格式
        if (!this.isValidGitUrl(repo.url)) {
          return { success: false, message: 'Git仓库URL格式不正确' }
        }

        // 构建带认证的URL或使用SSH
        let testUrl = repo.url
        let gitCommand = ''
        
        if (repo.credentials) {
          const credentials = this.decrypt(repo.credentials)
          
          // 判断是SSH还是HTTPS
          if (repo.url.startsWith('git@') || repo.url.includes('ssh://')) {
            // SSH方式，需要配置SSH key（后续实现）
            return { 
              success: false, 
              message: 'SSH认证方式暂未实现，请使用HTTPS方式',
              details: { type: 'ssh' }
            }
          } else if (repo.url.startsWith('http://') || repo.url.startsWith('https://')) {
            // HTTPS方式，支持token或用户名密码
            const urlObj = new URL(repo.url)
            
            // 判断凭据格式
            if (credentials.includes(':')) {
              // username:password 格式
              const [username, password] = credentials.split(':')
              urlObj.username = encodeURIComponent(username)
              urlObj.password = encodeURIComponent(password)
            } else {
              // 纯token格式（如GitHub Personal Access Token）
              urlObj.username = encodeURIComponent(credentials)
              urlObj.password = 'x-oauth-basic'
            }
            
            testUrl = urlObj.toString()
          }
        }

        // 设置Git环境变量，禁用交互式认证提示
        const env = {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: 'echo',
          GCM_INTERACTIVE: 'false'
        }

        // 测试连接（只获取引用信息，不克隆）
        gitCommand = `git ls-remote --heads "${testUrl}"`
        
        const { stdout, stderr } = await execAsync(gitCommand, {
          timeout: 15000,
          env
        })

        // 解析返回的分支信息
        const branches = stdout.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [hash, ref] = line.split('\t')
            return ref ? ref.replace('refs/heads/', '') : null
          })
          .filter(Boolean)

        return { 
          success: true, 
          message: '连接成功，仓库验证通过',
          details: {
            branches,
            defaultBranch: branches.includes('main') ? 'main' : 
                          branches.includes('master') ? 'master' : 
                          branches[0] || 'main'
          }
        }
      } else if (repo.type === 'local') {
        // 测试本地路径
        await fs.access(repo.localPath)
        
        // 检查是否是git仓库
        const isGitRepo = await fs.access(path.join(repo.localPath, '.git'))
          .then(() => true)
          .catch(() => false)
        
        return { 
          success: true, 
          message: '路径存在且可访问',
          details: { isGitRepo }
        }
      }
      
      return { success: false, message: '不支持的仓库类型' }
    } catch (error) {
      // 分析错误类型，提供更详细的错误信息
      let message = '连接失败'
      let details = {}
      
      if (error.message.includes('Authentication failed')) {
        message = '认证失败：用户名密码或Token不正确'
        details = { errorType: 'auth' }
      } else if (error.message.includes('Could not resolve host')) {
        message = '无法解析主机：请检查URL是否正确'
        details = { errorType: 'host' }
      } else if (error.message.includes('Repository not found')) {
        message = '仓库不存在或无权访问'
        details = { errorType: 'not_found' }
      } else if (error.message.includes('timeout')) {
        message = '连接超时：请检查网络或代理设置'
        details = { errorType: 'timeout' }
      } else if (error.message.includes('ENOENT')) {
        message = '路径不存在'
        details = { errorType: 'path_not_found' }
      } else {
        message = `连接失败：${error.message}`
        details = { errorType: 'unknown', error: error.message }
      }
      
      return { success: false, message, details }
    }
  }

  private isValidGitUrl(url: string): boolean {
    // 支持的Git URL格式
    const patterns = [
      /^https?:\/\/.+$/,                        // HTTP(S)
      /^git@.+:.+\.git$/,                       // SSH (git@github.com:user/repo.git)
      /^ssh:\/\/.+$/,                           // SSH URL
      /^git:\/\/.+$/,                           // Git protocol
      /^file:\/\/.+$/,                          // Local file
      /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/      // GitHub shorthand (user/repo)
    ]
    
    return patterns.some(pattern => pattern.test(url))
  }

  // 直接测试配置，不需要保存到数据库
  async testConfig(data: Partial<RepositoryEntity>): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      if (data.type === 'git') {
        // 验证URL格式
        if (!data.url || !this.isValidGitUrl(data.url)) {
          return { success: false, message: 'Git仓库URL格式不正确或为空' }
        }

        // 构建测试URL
        let testUrl = data.url
        
        if (data.credentials) {
          // 判断是SSH还是HTTPS
          if (data.url.startsWith('git@') || data.url.includes('ssh://')) {
            return { 
              success: false, 
              message: 'SSH认证方式暂未实现，请使用HTTPS方式',
              details: { type: 'ssh' }
            }
          } else if (data.url.startsWith('http://') || data.url.startsWith('https://')) {
            const urlObj = new URL(data.url)
            
            // 判断凭据格式
            if (data.credentials.includes(':')) {
              const [username, password] = data.credentials.split(':')
              
              // 如果 URL 中已经有用户名，检查是否匹配
              if (urlObj.username && urlObj.username !== username) {
                console.log(`URL中的用户名 ${urlObj.username} 与凭据中的 ${username} 不匹配`)
              }
              
              // 设置认证信息（注意：不要对用户名和密码进行 URL 编码，URL 对象会自动处理）
              urlObj.username = username
              urlObj.password = password
            } else {
              // 纯token格式（GitHub PAT 等）
              urlObj.username = data.credentials
              urlObj.password = 'x-oauth-basic'
            }
            
            testUrl = urlObj.toString()
          }
        }

        // 设置Git环境变量
        const env = {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: 'echo',
          GCM_INTERACTIVE: 'false'
        }

        // 调试：打印实际的URL（隐藏密码）
        const debugUrl = testUrl.replace(/:([^@]+)@/, ':****@')
        console.log(`测试Git连接: ${debugUrl}`)

        // 测试连接
        const gitCommand = `git ls-remote --heads "${testUrl}"`
        const { stdout } = await execAsync(gitCommand, {
          timeout: 15000,
          env
        })

        // 解析分支信息
        const branches = stdout.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [hash, ref] = line.split('\t')
            return ref ? ref.replace('refs/heads/', '') : null
          })
          .filter(Boolean)

        return { 
          success: true, 
          message: '连接成功，仓库验证通过',
          details: {
            branches,
            defaultBranch: branches.includes('main') ? 'main' : 
                          branches.includes('master') ? 'master' : 
                          branches[0] || 'main'
          }
        }
      } else if (data.type === 'local') {
        // 测试本地路径
        if (!data.localPath) {
          return { success: false, message: '请提供本地路径' }
        }
        
        await fs.access(data.localPath)
        
        // 检查是否是git仓库
        const isGitRepo = await fs.access(path.join(data.localPath, '.git'))
          .then(() => true)
          .catch(() => false)
        
        return { 
          success: true, 
          message: '路径存在且可访问',
          details: { isGitRepo }
        }
      }
      
      return { success: false, message: '不支持的仓库类型' }
    } catch (error) {
      // 分析错误类型
      let message = '连接失败'
      let details = {}
      
      console.error('Git连接错误:', error.message)
      
      if (error.message.includes('Authentication failed') || 
          error.message.includes('Invalid username or password') ||
          error.message.includes('fatal: Authentication failed')) {
        message = '认证失败：用户名密码或Token不正确'
        details = { errorType: 'auth', hint: 'Bitbucket需要使用App Password，不是账户密码' }
      } else if (error.message.includes('Could not resolve host')) {
        message = '无法解析主机：请检查URL是否正确'
        details = { errorType: 'host' }
      } else if (error.message.includes('Repository not found') || 
                 error.message.includes('does not exist')) {
        message = '仓库不存在或无权访问'
        details = { errorType: 'not_found' }
      } else if (error.message.includes('timeout')) {
        message = '连接超时：请检查网络或代理设置'
        details = { errorType: 'timeout' }
      } else if (error.message.includes('ENOENT')) {
        message = '路径不存在'
        details = { errorType: 'path_not_found' }
      } else {
        message = `连接失败：${error.message}`
        details = { errorType: 'unknown', error: error.message }
      }
      
      return { success: false, message, details }
    }
  }

  async createWorkspace(repositoryId: string, workerId: string): Promise<string> {
    const repo = await this.repositoryRepo.findOne({ where: { id: repositoryId } })
    if (!repo) {
      throw new Error('仓库不存在')
    }

    const timestamp = Date.now()
    const workspaceDir = path.join(
      process.cwd(),
      'workspaces',
      `workspace-${workerId}-${timestamp}`
    )

    // 创建工作区目录
    await fs.mkdir(workspaceDir, { recursive: true })

    if (repo.type === 'git') {
      // 克隆仓库
      const credentials = repo.credentials ? this.decrypt(repo.credentials) : ''
      let cloneUrl = repo.url
      
      // 如果有凭据，构建带认证的 URL
      if (credentials) {
        const [username, password] = credentials.split(':')
        const urlObj = new URL(repo.url)
        urlObj.username = username
        urlObj.password = password
        cloneUrl = urlObj.toString()
      }

      const branch = repo.branch || 'main'
      await execAsync(`git clone -b ${branch} ${cloneUrl} .`, {
        cwd: workspaceDir,
        timeout: 60000
      })
    } else if (repo.type === 'local') {
      // 复制本地目录
      await execAsync(`cp -r ${repo.localPath}/* ${workspaceDir}/`, {
        timeout: 30000
      })
    }

    return workspaceDir
  }

  async cleanupWorkspace(workspaceDir: string) {
    try {
      await fs.rm(workspaceDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to cleanup workspace:', error)
    }
  }

  private encrypt(text: string): string {
    const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv)
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return this.iv.toString('hex') + ':' + encrypted
  }

  private decrypt(text: string): string {
    const [ivHex, encrypted] = text.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }
}