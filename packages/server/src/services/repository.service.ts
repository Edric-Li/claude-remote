import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RepositoryEntity } from '../entities/repository.entity'
import { EncryptionService } from './encryption.service'
import { TestResult, ErrorType, RetryConfig, RetryDetails, BranchValidationResult, RETRYABLE_ERROR_TYPES, NON_RETRYABLE_ERROR_TYPES, PaginatedResult, PaginatedSearchResult, RepositoryPaginationOptions, RepositorySearchPaginationOptions, DEFAULT_PAGINATION_CONFIG, RepositorySettings, RepositoryMetadata } from '../types/repository.types'
import * as crypto from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)

@Injectable()
export class RepositoryService {
  // 保留旧的IV用于向后兼容
  private readonly legacyIv = crypto.randomBytes(16)

  // JSON序列化和反序列化辅助方法（SQLite兼容性）
  private serializeJSON(obj: any): string | undefined {
    if (!obj) return undefined
    try {
      return JSON.stringify(obj)
    } catch {
      return undefined
    }
  }

  private deserializeJSON<T>(jsonStr: string | undefined): T | undefined {
    if (!jsonStr) return undefined
    try {
      return JSON.parse(jsonStr)
    } catch {
      return undefined
    }
  }

  constructor(
    @InjectRepository(RepositoryEntity)
    private repositoryRepo: Repository<RepositoryEntity>,
    private encryptionService: EncryptionService
  ) {}

  /**
   * 通用的指数退避重试方法
   * @param operation 要重试的操作
   * @param config 重试配置
   * @returns 操作结果
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 15000,
      totalTimeout = 15000,
      retryableErrors = RETRYABLE_ERROR_TYPES
    } = config

    const startTime = Date.now()
    const retryDetails: RetryDetails[] = []
    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 检查总超时时间
        if (Date.now() - startTime > totalTimeout) {
          throw new Error(`操作超时，总计用时 ${Date.now() - startTime}ms`)
        }

        const result = await operation()
        return result
      } catch (error) {
        lastError = error
        
        // 记录重试详情
        if (attempt > 0) {
          retryDetails.push({
            attempt,
            error: error.message,
            duration: Date.now() - startTime,
            timestamp: new Date()
          })
        }

        // 如果是最后一次尝试，直接抛出错误
        if (attempt === maxRetries) {
          break
        }

        // 分析错误类型决定是否重试
        const errorType = this.analyzeErrorType(error.message)
        if (!retryableErrors.includes(errorType)) {
          // 不可重试的错误，直接抛出
          break
        }

        // 计算延迟时间（指数退避）
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        
        console.log(`重试第 ${attempt + 1} 次，延迟 ${delay}ms，错误: ${error.message}`)
        
        // 等待指定时间后重试
        await this.sleep(delay)
      }
    }

    // 所有重试都失败，抛出最后的错误
    const finalError = new Error(lastError.message)
    // 将重试详情附加到错误对象上
    ;(finalError as any).retryDetails = retryDetails
    throw finalError
  }

  /**
   * 睡眠方法
   * @param ms 毫秒
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 解析 git ls-remote 输出，提取分支列表
   * @param gitOutput git ls-remote 命令的原始输出
   * @returns 清理后的分支名称数组
   */
  private parseBranchList(gitOutput: string): string[] {
    if (!gitOutput || typeof gitOutput !== 'string') {
      return []
    }

    try {
      const branches = gitOutput
        .split('\n')
        .filter(line => {
          const trimmedLine = line.trim()
          // 只保留非空行且包含 tab 分隔符的行
          return trimmedLine && trimmedLine.includes('\t')
        })
        .map(line => {
          // git ls-remote 输出格式: <hash>\t<ref>
          const parts = line.split('\t')
          if (parts.length < 2) {
            return null
          }
          
          const ref = parts[1].trim()
          
          // 只保留分支引用，过滤掉其他类型的引用
          if (ref.startsWith('refs/heads/')) {
            // 移除 refs/heads/ 前缀，保留分支名称
            return ref.replace('refs/heads/', '')
          }
          
          // 过滤掉以下类型的引用:
          // - refs/tags/ (标签)
          // - HEAD (HEAD 引用)
          // - refs/pull/ (Pull Request 引用，GitHub)
          // - refs/merge-requests/ (Merge Request 引用，GitLab)
          return null
        })
        .filter(branch => {
          // 过滤掉空值和无效分支名称
          if (!branch || typeof branch !== 'string') {
            return false
          }
          
          // 基本的分支名称验证
          // 分支名称不能为空，不能只包含空白字符
          const trimmedBranch = branch.trim()
          if (!trimmedBranch) {
            return false
          }
          
          // 过滤掉一些常见的无效引用模式
          const invalidPatterns = [
            /^HEAD$/, // HEAD 引用
            /^\s*$/, // 空白字符
          ]
          
          return !invalidPatterns.some(pattern => pattern.test(trimmedBranch))
        })
        .map(branch => branch.trim()) // 确保分支名称没有前后空白
        .filter((branch, index, array) => {
          // 去重：过滤掉重复的分支名称
          return array.indexOf(branch) === index
        })
        .sort() // 按字母顺序排序，便于查找和展示

      return branches
    } catch (error) {
      console.warn('Failed to parse git ls-remote output:', error.message)
      console.warn('Git output was:', gitOutput)
      return []
    }
  }

  /**
   * 根据分支列表确定默认分支
   * 优先级: main > master > 第一个可用分支
   * @param branches 分支列表
   * @returns 默认分支名称
   */
  private determineDefaultBranch(branches: string[]): string | undefined {
    if (!branches || branches.length === 0) {
      return undefined
    }

    // 优先选择 main 分支
    if (branches.includes('main')) {
      return 'main'
    }

    // 其次选择 master 分支
    if (branches.includes('master')) {
      return 'master'
    }

    // 如果既没有 main 也没有 master，选择第一个可用分支
    return branches[0]
  }

  /**
   * 验证指定分支是否存在于可用分支列表中
   * @param branchName 要验证的分支名称
   * @param availableBranches 可用分支列表
   * @returns 分支验证结果
   */
  private validateBranch(branchName: string, availableBranches: string[]): BranchValidationResult {
    if (!branchName || typeof branchName !== 'string') {
      return {
        isValid: false,
        message: '分支名称不能为空',
        suggestedBranch: this.determineDefaultBranch(availableBranches),
        availableBranches
      }
    }

    const trimmedBranch = branchName.trim()
    if (!trimmedBranch) {
      return {
        isValid: false,
        message: '分支名称不能为空',
        suggestedBranch: this.determineDefaultBranch(availableBranches),
        availableBranches
      }
    }

    if (!availableBranches || availableBranches.length === 0) {
      return {
        isValid: false,
        message: '无可用分支信息，请先测试连接',
        availableBranches: []
      }
    }

    // 检查分支是否存在
    if (availableBranches.includes(trimmedBranch)) {
      return {
        isValid: true,
        message: '分支验证成功',
        availableBranches
      }
    }

    // 分支不存在，尝试提供建议
    const suggestions = this.findSimilarBranches(trimmedBranch, availableBranches)
    const suggestedBranch = suggestions.length > 0 ? suggestions[0] : this.determineDefaultBranch(availableBranches)

    let message = `分支 '${trimmedBranch}' 不存在`
    if (suggestedBranch) {
      message += `，建议使用 '${suggestedBranch}'`
    }

    return {
      isValid: false,
      message,
      suggestedBranch,
      availableBranches
    }
  }

  /**
   * 查找相似的分支名称
   * @param targetBranch 目标分支名称
   * @param availableBranches 可用分支列表
   * @returns 相似分支列表，按相似度排序
   */
  private findSimilarBranches(targetBranch: string, availableBranches: string[]): string[] {
    if (!targetBranch || !availableBranches) {
      return []
    }

    const target = targetBranch.toLowerCase()
    const similarities: { branch: string; score: number }[] = []

    for (const branch of availableBranches) {
      const branchLower = branch.toLowerCase()
      let score = 0

      // 完全匹配（不区分大小写）
      if (branchLower === target) {
        score = 100
      }
      // 包含关系
      else if (branchLower.includes(target) || target.includes(branchLower)) {
        score = 80
      }
      // 开头匹配
      else if (branchLower.startsWith(target) || target.startsWith(branchLower)) {
        score = 60
      }
      // Levenshtein 距离计算相似度
      else {
        const distance = this.calculateLevenshteinDistance(target, branchLower)
        const maxLength = Math.max(target.length, branchLower.length)
        score = Math.max(0, (maxLength - distance) * 100 / maxLength)
      }

      if (score > 30) { // 只保留相似度超过 30% 的分支
        similarities.push({ branch, score })
      }
    }

    // 按相似度降序排序
    similarities.sort((a, b) => b.score - a.score)

    return similarities.slice(0, 3).map(item => item.branch) // 最多返回3个建议
  }

  /**
   * 计算两个字符串的 Levenshtein 距离
   * @param str1 字符串1
   * @param str2 字符串2
   * @returns 编辑距离
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * 分析错误类型
   * @param errorMessage 错误消息
   * @returns 错误类型
   */
  private analyzeErrorType(errorMessage: string): ErrorType {
    const message = errorMessage.toLowerCase()

    // 认证相关错误
    if (
      message.includes('authentication failed') ||
      message.includes('invalid username or password') ||
      message.includes('fatal: authentication failed') ||
      message.includes('invalid credentials') ||
      message.includes('unauthorized')
    ) {
      return 'auth'
    }

    // 权限拒绝错误
    if (
      message.includes('permission denied') ||
      message.includes('access denied') ||
      message.includes('forbidden')
    ) {
      return 'permission_denied'
    }

    // 主机解析错误
    if (
      message.includes('could not resolve host') ||
      message.includes('name or service not known') ||
      message.includes('nodename nor servname provided')
    ) {
      return 'dns_resolution'
    }

    // 仓库不存在或找不到
    if (
      message.includes('repository not found') ||
      message.includes('does not exist') ||
      message.includes('not found') ||
      message.includes('enoent')
    ) {
      return 'not_found'
    }

    // 网络连接问题
    if (
      message.includes('connection timed out') ||
      message.includes('timeout') ||
      message.includes('connection refused') ||
      message.includes('network is unreachable')
    ) {
      return 'timeout'
    }

    // 连接重置错误
    if (
      message.includes('connection reset') ||
      message.includes('connection aborted') ||
      message.includes('broken pipe')
    ) {
      return 'connection_reset'
    }

    // 网络相关错误
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('socket')
    ) {
      return 'network'
    }

    // URL格式错误
    if (
      message.includes('invalid url') ||
      message.includes('malformed') ||
      message.includes('invalid format')
    ) {
      return 'invalid_format'
    }

    // 主机相关错误
    if (message.includes('host')) {
      return 'host'
    }

    return 'unknown'
  }

  /**
   * 检查错误是否可重试
   * @param errorType 错误类型
   * @returns 是否可重试
   */
  private isRetryableError(errorType: ErrorType): boolean {
    return RETRYABLE_ERROR_TYPES.includes(errorType)
  }

  /**
   * 带重试机制的连接测试
   * @param id 仓库ID
   * @param userId 用户ID
   * @param context 上下文信息
   * @param retryConfig 重试配置
   * @returns 测试结果
   */
  async testConnectionWithRetry(
    id: string,
    userId?: string,
    context?: { ipAddress?: string; userAgent?: string },
    retryConfig?: RetryConfig
  ): Promise<TestResult> {
    const startTime = Date.now()
    const repo = await this.repositoryRepo.findOne({ where: { id } })
    if (!repo) {
      return {
        success: false,
        message: '仓库不存在',
        timestamp: new Date(),
        details: { errorType: 'not_found' as ErrorType }
      }
    }

    // 配置重试参数
    const repoSettings = this.deserializeJSON<RepositorySettings>(repo.settings)
    const config: RetryConfig = {
      maxRetries: repoSettings?.retryCount || retryConfig?.maxRetries || 3,
      baseDelay: retryConfig?.baseDelay || 1000,
      maxDelay: retryConfig?.maxDelay || 4000,
      totalTimeout: repoSettings?.connectionTimeout || retryConfig?.totalTimeout || 15000,
      retryableErrors: retryConfig?.retryableErrors || RETRYABLE_ERROR_TYPES
    }

    let testResult: TestResult
    let retryDetails: RetryDetails[] = []

    try {
      // 使用重试机制执行连接测试
      const result = await this.retryWithBackoff(async () => {
        return await this.performSingleConnectionTest(repo)
      }, config)

      testResult = {
        success: true,
        message: result.message,
        timestamp: new Date(),
        retryCount: 0,
        retryDetails: [],
        details: result.details
      }

      // 更新仓库元数据
      if (result.details?.branches) {
        await this.updateRepositoryMetadata(id, testResult, result.details.branches, result.details.defaultBranch)
      } else {
        await this.updateRepositoryMetadata(id, testResult)
      }

    } catch (error) {
      // 提取重试详情
      retryDetails = (error as any).retryDetails || []
      const errorType = this.analyzeErrorType(error.message)
      
      let message = '连接失败'
      
      // 根据错误类型提供详细的错误信息
      switch (errorType) {
        case 'auth':
          message = '认证失败：用户名密码或Token不正确'
          break
        case 'host':
        case 'dns_resolution':
          message = '无法解析主机：请检查URL是否正确'
          break
        case 'not_found':
          message = '仓库不存在或无权访问'
          break
        case 'timeout':
        case 'network':
        case 'connection_reset':
          message = `连接超时：请检查网络或代理设置（已重试${retryDetails.length}次）`
          break
        case 'permission_denied':
          message = '权限拒绝：无权访问此仓库'
          break
        case 'invalid_format':
          message = 'URL格式不正确'
          break
        default:
          message = `连接失败：${error.message}（已重试${retryDetails.length}次）`
      }

      testResult = {
        success: false,
        message,
        timestamp: new Date(),
        retryCount: retryDetails.length,
        retryDetails,
        details: {
          errorType,
          error: error.message
        }
      }

      await this.updateRepositoryMetadata(id, testResult)
    }

    // 记录审计日志
    if (userId) {
      const durationMs = Date.now() - startTime
      // await this.auditLogService.logRepositoryTest(
      //   id,
      //   userId,
      //   testResult,
      //   { 
      //     ...context, 
      //     durationMs
      //   }
      // ).catch(error => {
      //   console.warn('审计日志记录失败:', error.message)
      // })
    }

    return testResult
  }

  /**
   * 增强的智能分支选择逻辑
   * @param userSpecifiedBranch 用户指定的分支名称
   * @param availableBranches 可用分支列表
   * @returns 分支选择结果
   */
  private getOptimalBranch(userSpecifiedBranch: string | undefined, availableBranches: string[]): {
    selectedBranch: string
    branchValidation?: BranchValidationResult
    isUserSpecified: boolean
  } {
    // 如果用户指定了分支，优先验证用户指定的分支
    if (userSpecifiedBranch && userSpecifiedBranch.trim()) {
      const validation = this.validateBranch(userSpecifiedBranch, availableBranches)
      
      if (validation.isValid) {
        return {
          selectedBranch: userSpecifiedBranch.trim(),
          branchValidation: validation,
          isUserSpecified: true
        }
      } else {
        // 用户指定的分支不存在，返回验证结果和建议分支
        const fallbackBranch = validation.suggestedBranch || this.determineDefaultBranch(availableBranches) || 'main'
        return {
          selectedBranch: fallbackBranch,
          branchValidation: validation,
          isUserSpecified: false
        }
      }
    }

    // 用户未指定分支，使用智能默认选择
    const defaultBranch = this.determineDefaultBranch(availableBranches) || 'main'
    return {
      selectedBranch: defaultBranch,
      isUserSpecified: false
    }
  }

  /**
   * 执行单次连接测试
   * @param repo 仓库实体
   * @returns 测试结果
   */
  private async performSingleConnectionTest(repo: RepositoryEntity): Promise<{
    success: boolean
    message: string
    details?: any
  }> {
    if (repo.type === 'git') {
      // 验证URL格式
      if (!this.isValidGitUrl(repo.url)) {
        throw new Error('Git仓库URL格式不正确')
      }

      // 构建带认证的URL或使用SSH
      let testUrl = repo.url

      if (repo.credentials) {
        const credentials = this.safeDecrypt(repo.credentials)

        // 判断是SSH还是HTTPS
        if (repo.url.startsWith('git@') || repo.url.includes('ssh://')) {
          throw new Error('SSH认证方式暂未实现，请使用HTTPS方式')
        } else if (repo.url.startsWith('http://') || repo.url.startsWith('https://')) {
          const urlObj = new URL(repo.url)

          // 判断凭据格式
          if (credentials.includes(':')) {
            const [username, password] = credentials.split(':')
            urlObj.username = encodeURIComponent(username)
            urlObj.password = encodeURIComponent(password)
          } else {
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
      const gitCommand = `git ls-remote --heads "${testUrl}"`
      const repoSettings = this.deserializeJSON<RepositorySettings>(repo.settings)
      const connectionTimeout = repoSettings?.connectionTimeout || 10000

      const { stdout } = await execAsync(gitCommand, {
        timeout: connectionTimeout,
        env
      })

      // 使用专用方法解析分支信息
      const branches = this.parseBranchList(stdout)
      
      // 使用增强的智能分支选择逻辑
      const branchSelection = this.getOptimalBranch(repo.branch, branches)
      
      let message = '连接成功，仓库验证通过'
      if (branchSelection.branchValidation && !branchSelection.branchValidation.isValid) {
        message += `。${branchSelection.branchValidation.message}`
      }

      return {
        success: true,
        message,
        details: {
          branches,
          defaultBranch: branchSelection.selectedBranch,
          actualBranch: branchSelection.selectedBranch,
          branchValidation: branchSelection.branchValidation,
          isGitRepo: true
        }
      }
    } else if (repo.type === 'local') {
      // 测试本地路径
      await fs.access(repo.localPath)

      // 检查是否是git仓库
      const isGitRepo = await fs
        .access(path.join(repo.localPath, '.git'))
        .then(() => true)
        .catch(() => false)

      return {
        success: true,
        message: '路径存在且可访问',
        details: { isGitRepo }
      }
    }

    throw new Error('不支持的仓库类型')
  }

  async create(data: Partial<RepositoryEntity>, userId?: string, context?: { ipAddress?: string; userAgent?: string }) {
    const startTime = Date.now()
    
    try {
      // 如果有凭据，使用新的加密服务加密存储
      if (data.credentials) {
        data.credentials = this.encryptionService.encrypt(data.credentials)
      }

      const repository = this.repositoryRepo.create(data)
      const savedRepository = await this.repositoryRepo.save(repository)
      
      // 记录审计日志
      if (userId) {
        const durationMs = Date.now() - startTime
        // await this.auditLogService.logRepositoryCreate(
        //   savedRepository.id,
        //   userId,
        //   { name: data.name, url: data.url, type: data.type },
        //   { ...context, durationMs }
        // ).catch(error => {
        //   console.warn('审计日志记录失败:', error.message)
        // })
      }
      
      return savedRepository
    } catch (error) {
      // 记录失败的审计日志
      if (userId) {
        const durationMs = Date.now() - startTime
        // await this.auditLogService.logOperation(
        //   AuditAction.CREATE,
        //   'unknown',
        //   userId,
        //   { errorMessage: error.message },
        //   { ...context, success: false, durationMs }
        // ).catch(auditError => {
        //   console.warn('审计日志记录失败:', auditError.message)
        // })
      }
      throw error
    }
  }

  async findAll() {
    const repos = await this.repositoryRepo.find()
    // 不返回凭据
    return repos.map(repo => ({
      ...repo,
      credentials: repo.credentials ? '******' : null
    }))
  }

  /**
   * 分页查询仓库列表
   * @param page 页码（从1开始）
   * @param limit 每页数量（默认20，最大100）
   * @param sortBy 排序字段
   * @param sortOrder 排序方向
   * @returns 分页结果
   */
  async findAllPaginated(
    page: number = DEFAULT_PAGINATION_CONFIG.DEFAULT_PAGE,
    limit: number = DEFAULT_PAGINATION_CONFIG.DEFAULT_LIMIT,
    sortBy: string = DEFAULT_PAGINATION_CONFIG.DEFAULT_SORT_BY,
    sortOrder: 'ASC' | 'DESC' = DEFAULT_PAGINATION_CONFIG.DEFAULT_SORT_ORDER
  ): Promise<PaginatedResult<RepositoryEntity>> {
    // 参数验证和规范化
    const normalizedPage = Math.max(1, Math.floor(page))
    const normalizedLimit = Math.min(DEFAULT_PAGINATION_CONFIG.MAX_LIMIT, Math.max(1, Math.floor(limit)))
    
    // 支持的排序字段
    const supportedSortFields = ['name', 'createdAt', 'updatedAt', 'type', 'enabled']
    const normalizedSortBy = supportedSortFields.includes(sortBy) ? sortBy : 'updatedAt'
    const normalizedSortOrder = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC'
    
    // 计算偏移量
    const offset = (normalizedPage - 1) * normalizedLimit
    
    // 执行查询
    const [repos, total] = await this.repositoryRepo.findAndCount({
      order: { [normalizedSortBy]: normalizedSortOrder },
      skip: offset,
      take: normalizedLimit
    })
    
    // 隐藏敏感信息
    const sanitizedRepos = repos.map(repo => ({
      ...repo,
      credentials: repo.credentials ? '******' : null
    }))
    
    // 计算分页信息
    const totalPages = Math.ceil(total / normalizedLimit)
    
    return {
      data: sanitizedRepos,
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages,
      hasNext: normalizedPage < totalPages,
      hasPrev: normalizedPage > 1
    }
  }

  /**
   * 搜索并分页查询仓库
   * @param options 搜索和分页选项
   * @returns 分页搜索结果
   */
  async searchPaginated(options: RepositorySearchPaginationOptions): Promise<PaginatedSearchResult<RepositoryEntity>> {
    const {
      query,
      type,
      enabled,
      page = DEFAULT_PAGINATION_CONFIG.DEFAULT_PAGE,
      limit = DEFAULT_PAGINATION_CONFIG.DEFAULT_LIMIT,
      sortBy = DEFAULT_PAGINATION_CONFIG.DEFAULT_SORT_BY,
      sortOrder = DEFAULT_PAGINATION_CONFIG.DEFAULT_SORT_ORDER
    } = options
    
    // 参数验证和规范化
    const normalizedPage = Math.max(1, Math.floor(page))
    const normalizedLimit = Math.min(DEFAULT_PAGINATION_CONFIG.MAX_LIMIT, Math.max(1, Math.floor(limit)))
    
    // 支持的排序字段
    const supportedSortFields = ['name', 'createdAt', 'updatedAt', 'type', 'enabled']
    const normalizedSortBy = supportedSortFields.includes(sortBy) ? sortBy : 'updatedAt'
    const normalizedSortOrder = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC'
    
    // 构建查询条件
    const queryBuilder = this.repositoryRepo.createQueryBuilder('repository')
    
    // 应用搜索条件
    if (query && query.trim()) {
      queryBuilder.andWhere(
        '(LOWER(repository.name) LIKE LOWER(:query) OR LOWER(repository.description) LIKE LOWER(:query) OR LOWER(repository.url) LIKE LOWER(:query))',
        { query: `%${query.trim()}%` }
      )
    }
    
    // 按类型过滤
    if (type && ['git', 'local', 'svn'].includes(type)) {
      queryBuilder.andWhere('repository.type = :type', { type })
    }
    
    // 按启用状态过滤
    if (typeof enabled === 'boolean') {
      queryBuilder.andWhere('repository.enabled = :enabled', { enabled })
    }
    
    // 应用排序
    queryBuilder.orderBy(`repository.${normalizedSortBy}`, normalizedSortOrder)
    
    // 获取总数
    const total = await queryBuilder.getCount()
    
    // 应用分页
    const offset = (normalizedPage - 1) * normalizedLimit
    queryBuilder.skip(offset).take(normalizedLimit)
    
    // 执行查询
    const repos = await queryBuilder.getMany()
    
    // 隐藏敏感信息
    const sanitizedRepos = repos.map(repo => ({
      ...repo,
      credentials: repo.credentials ? '******' : null
    }))
    
    // 计算分页信息
    const totalPages = Math.ceil(total / normalizedLimit)
    
    return {
      data: sanitizedRepos,
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages,
      hasNext: normalizedPage < totalPages,
      hasPrev: normalizedPage > 1,
      searchCriteria: {
        query: query?.trim(),
        type,
        enabled
      }
    }
  }

  /**
   * 高级搜索仓库
   * @param searchOptions 高级搜索选项
   * @returns 搜索结果
   */
  async advancedSearch(searchOptions: any): Promise<PaginatedSearchResult<RepositoryEntity>> {
    const {
      query,
      type,
      enabled,
      branch,
      excludeQuery,
      types,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
      hasCredentials,
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'DESC'
    } = searchOptions

    // 参数验证和规范化
    const normalizedPage = Math.max(1, Math.floor(page))
    const normalizedLimit = Math.min(100, Math.max(1, Math.floor(limit)))
    
    // 支持的排序字段
    const supportedSortFields = ['name', 'createdAt', 'updatedAt', 'type', 'enabled']
    const normalizedSortBy = supportedSortFields.includes(sortBy) ? sortBy : 'updatedAt'
    const normalizedSortOrder = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC'
    
    // 构建查询条件
    const queryBuilder = this.repositoryRepo.createQueryBuilder('repository')
    
    // 基础搜索条件
    if (query && query.trim()) {
      queryBuilder.andWhere(
        '(LOWER(repository.name) LIKE LOWER(:query) OR LOWER(repository.description) LIKE LOWER(:query) OR LOWER(repository.url) LIKE LOWER(:query))',
        { query: `%${query.trim()}%` }
      )
    }

    // 排除搜索条件
    if (excludeQuery && excludeQuery.trim()) {
      queryBuilder.andWhere(
        'NOT (LOWER(repository.name) LIKE LOWER(:excludeQuery) OR LOWER(repository.description) LIKE LOWER(:excludeQuery) OR LOWER(repository.url) LIKE LOWER(:excludeQuery))',
        { excludeQuery: `%${excludeQuery.trim()}%` }
      )
    }
    
    // 按单个类型过滤
    if (type && ['git', 'local', 'svn'].includes(type)) {
      queryBuilder.andWhere('repository.type = :type', { type })
    }

    // 按多个类型过滤
    if (types && Array.isArray(types) && types.length > 0) {
      const validTypes = types.filter(t => ['git', 'local', 'svn'].includes(t))
      if (validTypes.length > 0) {
        queryBuilder.andWhere('repository.type IN (:...types)', { types: validTypes })
      }
    }
    
    // 按启用状态过滤
    if (typeof enabled === 'boolean') {
      queryBuilder.andWhere('repository.enabled = :enabled', { enabled })
    }

    // 按分支过滤
    if (branch && branch.trim()) {
      queryBuilder.andWhere('LOWER(repository.branch) LIKE LOWER(:branch)', { branch: `%${branch.trim()}%` })
    }

    // 按凭据存在性过滤
    if (typeof hasCredentials === 'boolean') {
      if (hasCredentials) {
        queryBuilder.andWhere('repository.credentials IS NOT NULL AND repository.credentials != \'\'')
      } else {
        queryBuilder.andWhere('(repository.credentials IS NULL OR repository.credentials = \'\')')
      }
    }

    // 时间范围过滤
    if (createdAfter) {
      try {
        const date = new Date(createdAfter)
        if (!isNaN(date.getTime())) {
          queryBuilder.andWhere('repository.createdAt >= :createdAfter', { createdAfter: date })
        }
      } catch (e) {
        // 忽略无效日期
      }
    }

    if (createdBefore) {
      try {
        const date = new Date(createdBefore)
        if (!isNaN(date.getTime())) {
          queryBuilder.andWhere('repository.createdAt <= :createdBefore', { createdBefore: date })
        }
      } catch (e) {
        // 忽略无效日期
      }
    }

    if (updatedAfter) {
      try {
        const date = new Date(updatedAfter)
        if (!isNaN(date.getTime())) {
          queryBuilder.andWhere('repository.updatedAt >= :updatedAfter', { updatedAfter: date })
        }
      } catch (e) {
        // 忽略无效日期
      }
    }

    if (updatedBefore) {
      try {
        const date = new Date(updatedBefore)
        if (!isNaN(date.getTime())) {
          queryBuilder.andWhere('repository.updatedAt <= :updatedBefore', { updatedBefore: date })
        }
      } catch (e) {
        // 忽略无效日期
      }
    }
    
    // 应用排序
    queryBuilder.orderBy(`repository.${normalizedSortBy}`, normalizedSortOrder)
    
    // 获取总数
    const total = await queryBuilder.getCount()
    
    // 应用分页
    const offset = (normalizedPage - 1) * normalizedLimit
    queryBuilder.skip(offset).take(normalizedLimit)
    
    // 执行查询
    const repos = await queryBuilder.getMany()
    
    // 隐藏敏感信息
    const sanitizedRepos = repos.map(repo => ({
      ...repo,
      credentials: repo.credentials ? '******' : null
    }))
    
    // 计算分页信息
    const totalPages = Math.ceil(total / normalizedLimit)
    
    return {
      data: sanitizedRepos,
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages,
      hasNext: normalizedPage < totalPages,
      hasPrev: normalizedPage > 1,
      searchCriteria: {
        query: query?.trim(),
        type,
        enabled,
        branch,
        excludeQuery,
        types,
        createdAfter,
        createdBefore,
        updatedAfter,
        updatedBefore,
        hasCredentials
      }
    }
  }

  async findOne(id: string) {
    const repo = await this.repositoryRepo.findOne({ where: { id } })
    if (repo && repo.credentials) {
      // 不返回真实凭据
      repo.credentials = '******'
    }
    return repo
  }

  async findOneWithCredentials(id: string) {
    // 内部使用，返回包含真实凭据的仓库信息
    return await this.repositoryRepo.findOne({ where: { id } })
  }

  async update(id: string, data: Partial<RepositoryEntity>, userId?: string, context?: { ipAddress?: string; userAgent?: string }) {
    const startTime = Date.now()
    
    try {
      // 获取原始数据用于审计
      const originalRepo = await this.repositoryRepo.findOne({ where: { id } })
      if (!originalRepo) {
        throw new Error('仓库不存在')
      }
      
      // 记录变更内容
      const changes: Record<string, any> = {}
      Object.keys(data).forEach(key => {
        if (key !== 'credentials' && data[key] !== originalRepo[key]) {
          changes[key] = { from: originalRepo[key], to: data[key] }
        }
      })
      
      // 如果更新凭据，需要使用新的加密服务加密
      if (data.credentials && data.credentials !== '******') {
        data.credentials = this.encryptionService.encrypt(data.credentials)
        changes.credentials = { from: '已更新', to: '已更新' }
      } else if (data.credentials === '******') {
        // 如果是掩码，不更新凭据字段
        delete data.credentials
      }

      await this.repositoryRepo.update(id, data)
      const updatedRepo = await this.findOne(id)
      
      // 记录审计日志
      if (userId && Object.keys(changes).length > 0) {
        const durationMs = Date.now() - startTime
        // await this.auditLogService.logRepositoryUpdate(
        //   id,
        //   userId,
        //   changes,
        //   { ...context, durationMs }
        // ).catch(error => {
        //   console.warn('审计日志记录失败:', error.message)
        // })
      }
      
      return updatedRepo
    } catch (error) {
      // 记录失败的审计日志
      if (userId) {
        const durationMs = Date.now() - startTime
        // await this.auditLogService.logOperation(
        //   AuditAction.UPDATE,
        //   id,
        //   userId,
        //   { errorMessage: error.message },
        //   { ...context, success: false, durationMs }
        // ).catch(auditError => {
        //   console.warn('审计日志记录失败:', auditError.message)
        // })
      }
      throw error
    }
  }

  async delete(id: string, userId?: string, context?: { ipAddress?: string; userAgent?: string }) {
    const startTime = Date.now()
    
    try {
      // 获取要删除的仓库信息用于审计
      const repo = await this.repositoryRepo.findOne({ where: { id } })
      if (!repo) {
        throw new Error('仓库不存在')
      }
      
      await this.repositoryRepo.delete(id)
      
      // 记录审计日志
      if (userId) {
        const durationMs = Date.now() - startTime
        // await this.auditLogService.logRepositoryDelete(
        //   id,
        //   userId,
        //   { name: repo.name, url: repo.url },
        //   { ...context, durationMs }
        // ).catch(error => {
        //   console.warn('审计日志记录失败:', error.message)
        // })
      }
    } catch (error) {
      // 记录失败的审计日志
      if (userId) {
        const durationMs = Date.now() - startTime
        // await this.auditLogService.logOperation(
        //   AuditAction.DELETE,
        //   id,
        //   userId,
        //   { errorMessage: error.message },
        //   { ...context, success: false, durationMs }
        // ).catch(auditError => {
        //   console.warn('审计日志记录失败:', auditError.message)
        // })
      }
      throw error
    }
  }

  /**
   * 更新仓库元数据
   */
  private async updateRepositoryMetadata(
    id: string,
    testResult: TestResult,
    branches?: string[],
    defaultBranch?: string
  ): Promise<void> {
    const repo = await this.repositoryRepo.findOne({ where: { id } })
    if (!repo) return

    const existingMetadata = this.deserializeJSON<RepositoryMetadata>(repo.metadata) || {}
    const metadata = {
      ...existingMetadata,
      lastTestDate: new Date(),
      lastTestResult: testResult
    }

    // 准备更新的数据
    const updateData: Partial<RepositoryEntity> = { 
      metadata: this.serializeJSON(metadata)
    }

    // 如果成功获取到分支信息，则更新
    if (testResult.success && branches) {
      metadata.availableBranches = branches
    }

    if (testResult.success && defaultBranch) {
      metadata.defaultBranch = defaultBranch
    }

    // 自动更新仓库的分支字段
    if (testResult.success && testResult.details?.actualBranch) {
      const actualBranch = testResult.details.actualBranch
      
      // 如果当前仓库没有设置分支，或者需要更新为新的推荐分支
      if (!repo.branch || 
          (testResult.details.branchValidation && !testResult.details.branchValidation.isValid)) {
        updateData.branch = actualBranch
        console.log(`自动更新仓库 ${id} 的分支从 '${repo.branch || '未设置'}' 到 '${actualBranch}'`)
      }
    }

    // 重新序列化 metadata 以确保最新的更改被保存
    updateData.metadata = this.serializeJSON(metadata)

    await this.repositoryRepo.update(id, updateData)
  }

  /**
   * 获取仓库分支信息
   */
  async getBranches(id: string): Promise<{ branches: string[]; defaultBranch?: string }> {
    const repo = await this.repositoryRepo.findOne({ where: { id } })
    if (!repo) {
      throw new Error('仓库不存在')
    }

    // 如果有缓存的分支信息且最近测试成功，直接返回
    const repoMetadata = this.deserializeJSON<RepositoryMetadata>(repo.metadata)
    if (
      repoMetadata?.availableBranches &&
      repoMetadata?.lastTestResult?.success &&
      repoMetadata?.lastTestDate
    ) {
      const timeDiff = Date.now() - new Date(repoMetadata.lastTestDate).getTime()
      const oneHour = 60 * 60 * 1000
      
      // 如果分支信息是1小时内获取的，直接返回缓存
      if (timeDiff < oneHour) {
        return {
          branches: repoMetadata.availableBranches,
          defaultBranch: repoMetadata.defaultBranch
        }
      }
    }

    // 否则重新测试连接获取最新分支信息
    const testResult = await this.testConnection(id)
    
    if (testResult.success && testResult.details?.branches) {
      return {
        branches: testResult.details.branches,
        defaultBranch: testResult.details.defaultBranch
      }
    }

    // 如果测试失败，返回缓存的信息（如果有）
    if (repoMetadata?.availableBranches) {
      return {
        branches: repoMetadata.availableBranches,
        defaultBranch: repoMetadata.defaultBranch
      }
    }

    return { branches: [] }
  }

  async testConnection(id: string, userId?: string, context?: { ipAddress?: string; userAgent?: string }): Promise<{ success: boolean; message: string; details?: any }> {
    // 使用新的带重试机制的连接测试
    const testResult = await this.testConnectionWithRetry(id, userId, context)
    
    return {
      success: testResult.success,
      message: testResult.message,
      details: testResult.details
    }
  }

  private isValidGitUrl(url: string): boolean {
    // 支持的Git URL格式
    const patterns = [
      /^https?:\/\/.+$/, // HTTP(S)
      /^git@.+:.+\.git$/, // SSH (git@github.com:user/repo.git)
      /^ssh:\/\/.+$/, // SSH URL
      /^git:\/\/.+$/, // Git protocol
      /^file:\/\/.+$/, // Local file
      /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/ // GitHub shorthand (user/repo)
    ]

    return patterns.some(pattern => pattern.test(url))
  }

  /**
   * 带重试的配置测试方法
   * @param data 仓库配置数据
   * @param retryConfig 重试配置
   * @returns 测试结果
   */
  async testConfigWithRetry(
    data: Partial<RepositoryEntity>,
    retryConfig?: RetryConfig
  ): Promise<TestResult> {
    const config: RetryConfig = {
      maxRetries: retryConfig?.maxRetries || 3,
      baseDelay: retryConfig?.baseDelay || 1000,
      maxDelay: retryConfig?.maxDelay || 4000,
      totalTimeout: retryConfig?.totalTimeout || 15000,
      retryableErrors: retryConfig?.retryableErrors || RETRYABLE_ERROR_TYPES
    }

    let retryDetails: RetryDetails[] = []

    try {
      const result = await this.retryWithBackoff(async () => {
        return await this.performSingleConfigTest(data)
      }, config)

      return {
        success: true,
        message: result.message,
        timestamp: new Date(),
        retryCount: 0,
        retryDetails: [],
        details: result.details
      }
    } catch (error) {
      retryDetails = (error as any).retryDetails || []
      const errorType = this.analyzeErrorType(error.message)
      
      let message = '连接失败'
      
      // 根据错误类型提供详细的错误信息
      switch (errorType) {
        case 'auth':
          message = '认证失败：用户名密码或Token不正确'
          break
        case 'host':
        case 'dns_resolution':
          message = '无法解析主机：请检查URL是否正确'
          break
        case 'not_found':
          message = '仓库不存在或无权访问'
          break
        case 'timeout':
        case 'network':
        case 'connection_reset':
          message = `连接超时：请检查网络或代理设置（已重试${retryDetails.length}次）`
          break
        case 'permission_denied':
          message = '权限拒绝：无权访问此仓库'
          break
        case 'invalid_format':
          message = 'URL格式不正确'
          break
        default:
          message = `连接失败：${error.message}（已重试${retryDetails.length}次）`
      }

      return {
        success: false,
        message,
        timestamp: new Date(),
        retryCount: retryDetails.length,
        retryDetails,
        details: {
          errorType,
          error: error.message
        }
      }
    }
  }

  /**
   * 执行单次配置测试
   * @param data 仓库配置数据
   * @returns 测试结果
   */
  private async performSingleConfigTest(data: Partial<RepositoryEntity>): Promise<{
    success: boolean
    message: string
    details?: any
  }> {
    if (data.type === 'git') {
      // 验证URL格式
      if (!data.url || !this.isValidGitUrl(data.url)) {
        throw new Error('Git仓库URL格式不正确或为空')
      }

      // 构建测试URL
      let testUrl = data.url

      if (data.credentials) {
        // 判断是SSH还是HTTPS
        if (data.url.startsWith('git@') || data.url.includes('ssh://')) {
          throw new Error('SSH认证方式暂未实现，请使用HTTPS方式')
        } else if (data.url.startsWith('http://') || data.url.startsWith('https://')) {
          const urlObj = new URL(data.url)

          // 判断凭据格式
          if (data.credentials.includes(':')) {
            const [username, password] = data.credentials.split(':')
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

      // 测试连接
      const gitCommand = `git ls-remote --heads "${testUrl}"`
      const { stdout } = await execAsync(gitCommand, {
        timeout: 10000, // 单次测试超时时间较短
        env
      })

      // 使用专用方法解析分支信息
      const branches = this.parseBranchList(stdout)
      
      // 使用增强的智能分支选择逻辑
      const branchSelection = this.getOptimalBranch(data.branch, branches)
      
      let message = '连接成功，仓库验证通过'
      if (branchSelection.branchValidation && !branchSelection.branchValidation.isValid) {
        message += `。${branchSelection.branchValidation.message}`
      }

      return {
        success: true,
        message,
        details: {
          branches,
          defaultBranch: branchSelection.selectedBranch,
          actualBranch: branchSelection.selectedBranch,
          branchValidation: branchSelection.branchValidation,
          isGitRepo: true
        }
      }
    } else if (data.type === 'local') {
      // 测试本地路径
      if (!data.localPath) {
        throw new Error('请提供本地路径')
      }

      await fs.access(data.localPath)

      // 检查是否是git仓库
      const isGitRepo = await fs
        .access(path.join(data.localPath, '.git'))
        .then(() => true)
        .catch(() => false)

      return {
        success: true,
        message: '路径存在且可访问',
        details: { isGitRepo }
      }
    }

    throw new Error('不支持的仓库类型')
  }

  // 直接测试配置，不需要保存到数据库
  async testConfig(
    data: Partial<RepositoryEntity>
  ): Promise<TestResult> {
    // 使用新的带重试机制的配置测试
    return await this.testConfigWithRetry(data)
  }

  /**
   * 批量重试测试仓库连接
   * @param repositoryIds 仓库ID列表
   * @param retryConfig 重试配置
   * @param stopOnFirstFailure 是否在第一个失败时停止
   * @param userId 用户ID
   * @param context 上下文信息
   * @returns 批量测试结果
   */
  async batchRetryTest(
    repositoryIds: string[],
    retryConfig?: RetryConfig,
    stopOnFirstFailure: boolean = false,
    userId?: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<{
    success: boolean
    results: Array<{
      repositoryId: string
      repositoryName: string
      success: boolean
      result?: TestResult
      error?: string
    }>
    summary: {
      total: number
      successful: number
      failed: number
      skipped: number
    }
  }> {
    const results = []
    const summary = {
      total: repositoryIds.length,
      successful: 0,
      failed: 0,
      skipped: 0
    }

    for (const repositoryId of repositoryIds) {
      try {
        const repo = await this.repositoryRepo.findOne({ where: { id: repositoryId } })
        if (!repo) {
          results.push({
            repositoryId,
            repositoryName: 'Unknown',
            success: false,
            error: '仓库不存在'
          })
          summary.failed++
          continue
        }

        const testResult = await this.testConnectionWithRetry(repositoryId, userId, context, retryConfig)
        
        results.push({
          repositoryId,
          repositoryName: repo.name,
          success: testResult.success,
          result: testResult
        })

        if (testResult.success) {
          summary.successful++
        } else {
          summary.failed++
          if (stopOnFirstFailure) {
            // 计算剩余未测试的仓库数
            summary.skipped = repositoryIds.length - results.length
            break
          }
        }
      } catch (error) {
        const repo = await this.repositoryRepo.findOne({ where: { id: repositoryId } })
        results.push({
          repositoryId,
          repositoryName: repo?.name || 'Unknown',
          success: false,
          error: error.message
        })
        summary.failed++

        if (stopOnFirstFailure) {
          summary.skipped = repositoryIds.length - results.length
          break
        }
      }
    }

    return {
      success: summary.failed === 0,
      results,
      summary
    }
  }

  /**
   * 获取重试统计信息
   * @param repositoryId 可选的仓库ID
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @param limit 限制结果数量
   * @returns 重试统计
   */
  async getRetryStatistics(
    repositoryId?: string,
    startDate?: string,
    endDate?: string,
    limit: number = 50
  ): Promise<{
    summary: {
      totalRetries: number
      successfulRetries: number
      failedRetries: number
      averageRetryCount: number
      mostCommonErrors: Array<{ errorType: string; count: number }>
    }
    recentRetries: Array<{
      repositoryId: string
      repositoryName: string
      timestamp: Date
      success: boolean
      retryCount: number
      errorType?: string
      duration: number
    }>
  }> {
    // 这里应该从审计日志或专门的重试日志表中获取数据
    // 为了演示，我们使用模拟数据
    const summary = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageRetryCount: 0,
      mostCommonErrors: [
        { errorType: 'timeout', count: 15 },
        { errorType: 'network', count: 8 },
        { errorType: 'auth', count: 5 }
      ]
    }

    const recentRetries = []

    // 如果指定了仓库ID，获取该仓库的重试历史
    if (repositoryId) {
      const repo = await this.repositoryRepo.findOne({ where: { id: repositoryId } })
      if (repo) {
        const repoMetadata = this.deserializeJSON<RepositoryMetadata>(repo.metadata)
        if (repoMetadata?.lastTestResult) {
          const lastTest = repoMetadata.lastTestResult
          if (lastTest.retryDetails && lastTest.retryDetails.length > 0) {
          recentRetries.push({
            repositoryId: repo.id,
            repositoryName: repo.name,
            timestamp: lastTest.timestamp,
            success: lastTest.success,
            retryCount: lastTest.retryCount || 0,
            errorType: lastTest.details?.errorType,
            duration: lastTest.retryDetails.reduce((total, retry) => total + retry.duration, 0)
          })
        }
      }
    }
    } else {
      // 获取所有仓库的重试统计
      const repos = await this.repositoryRepo.find({
        take: limit,
        order: { updatedAt: 'DESC' }
      })

      for (const repo of repos) {
        const repoMetadata = this.deserializeJSON<RepositoryMetadata>(repo.metadata)
        if (repoMetadata?.lastTestResult?.retryDetails?.length > 0) {
          const lastTest = repoMetadata.lastTestResult
          recentRetries.push({
            repositoryId: repo.id,
            repositoryName: repo.name,
            timestamp: lastTest.timestamp,
            success: lastTest.success,
            retryCount: lastTest.retryCount || 0,
            errorType: lastTest.details?.errorType,
            duration: lastTest.retryDetails.reduce((total, retry) => total + retry.duration, 0)
          })
        }
      }
    }

    // 计算统计数据
    summary.totalRetries = recentRetries.length
    summary.successfulRetries = recentRetries.filter(r => r.success).length
    summary.failedRetries = recentRetries.filter(r => !r.success).length
    summary.averageRetryCount = recentRetries.length > 0 
      ? recentRetries.reduce((sum, r) => sum + r.retryCount, 0) / recentRetries.length 
      : 0

    return {
      summary,
      recentRetries
    }
  }

  /**
   * 获取默认重试配置
   * @returns 默认重试配置
   */
  getDefaultRetryConfig(): RetryConfig {
    return {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 15000,
      totalTimeout: 15000,
      retryableErrors: RETRYABLE_ERROR_TYPES
    }
  }

  /**
   * 更新默认重试配置
   * @param config 新的重试配置
   * @returns 更新后的配置
   */
  async updateDefaultRetryConfig(config: Partial<RetryConfig>): Promise<RetryConfig> {
    // 在实际应用中，这应该保存到数据库或配置文件中
    // 这里我们返回合并后的配置
    const defaultConfig = this.getDefaultRetryConfig()
    return {
      ...defaultConfig,
      ...config
    }
  }

  async createWorkspace(repositoryId: string, workerId: string, userId?: string, context?: { ipAddress?: string; userAgent?: string }): Promise<string> {
    const startTime = Date.now()
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
      const credentials = repo.credentials ? this.safeDecrypt(repo.credentials) : ''
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

    // 记录克隆操作的审计日志
    if (userId) {
      const durationMs = Date.now() - startTime
      // await this.auditLogService.logRepositoryClone(
      //   repositoryId,
      //   userId,
      //   { success: true, localPath: workspaceDir },
      //   { ...context, durationMs }
      // ).catch(error => {
      //   console.warn('审计日志记录失败:', error.message)
      // })
    }
    
    return workspaceDir
  }
  
  /**
   * 克隆仓库到指定目录
   */
  async cloneRepository(repositoryId: string, targetPath: string, userId?: string, context?: { ipAddress?: string; userAgent?: string }): Promise<{ success: boolean; message: string; localPath?: string }> {
    const startTime = Date.now()
    
    try {
      const repo = await this.repositoryRepo.findOne({ where: { id: repositoryId } })
      if (!repo) {
        throw new Error('仓库不存在')
      }

      // 创建目标目录
      await fs.mkdir(targetPath, { recursive: true })

      if (repo.type === 'git') {
        // 克隆Git仓库
        const credentials = repo.credentials ? this.safeDecrypt(repo.credentials) : ''
        let cloneUrl = repo.url

        // 如果有凭据，构建带认证的 URL
        if (credentials) {
          const urlObj = new URL(repo.url)
          if (credentials.includes(':')) {
            const [username, password] = credentials.split(':')
            urlObj.username = encodeURIComponent(username)
            urlObj.password = encodeURIComponent(password)
          } else {
            urlObj.username = encodeURIComponent(credentials)
            urlObj.password = 'x-oauth-basic'
          }
          cloneUrl = urlObj.toString()
        }

        const branch = repo.branch || 'main'
        const env = {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: 'echo',
          GCM_INTERACTIVE: 'false'
        }
        
        await execAsync(`git clone -b ${branch} "${cloneUrl}" .`, {
          cwd: targetPath,
          timeout: 60000,
          env
        })
      } else if (repo.type === 'local') {
        // 复制本地目录
        await execAsync(`cp -r "${repo.localPath}"/* "${targetPath}"/`, {
          timeout: 30000
        })
      } else {
        throw new Error('不支持的仓库类型')
      }
      
      // 记录成功的审计日志
      if (userId) {
        const durationMs = Date.now() - startTime
        // await this.auditLogService.logRepositoryClone(
        //   repositoryId,
        //   userId,
        //   { success: true, localPath: targetPath },
        //   { ...context, durationMs }
        // ).catch(error => {
        //   console.warn('审计日志记录失败:', error.message)
        // })
      }
      
      return {
        success: true,
        message: '仓库克隆成功',
        localPath: targetPath
      }
    } catch (error) {
      // 记录失败的审计日志
      if (userId) {
        const durationMs = Date.now() - startTime
        // await this.auditLogService.logRepositoryClone(
        //   repositoryId,
        //   userId,
        //   { success: false, errorMessage: error.message },
        //   { ...context, durationMs }
        // ).catch(auditError => {
        //   console.warn('审计日志记录失败:', auditError.message)
        // })
      }
      
      return {
        success: false,
        message: `克隆失败: ${error.message}`
      }
    }
  }

  async cleanupWorkspace(workspaceDir: string) {
    try {
      await fs.rm(workspaceDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to cleanup workspace:', error)
    }
  }

  /**
   * 安全解密方法，支持向后兼容
   * 首先尝试使用新的解密服务，如果失败则尝试旧的解密方式
   * @param encryptedText 加密的文本
   * @returns 解密后的明文
   */
  private safeDecrypt(encryptedText: string): string {
    try {
      // 首先尝试使用新的加密服务解密
      return this.encryptionService.decrypt(encryptedText)
    } catch (error) {
      console.warn('New decryption failed, trying legacy decryption:', error.message)
      
      try {
        // 如果新方法失败，尝试使用旧的固定IV方式解密
        return this.encryptionService.decryptLegacy(encryptedText, this.legacyIv)
      } catch (legacyError) {
        console.error('Both new and legacy decryption failed:', legacyError.message)
        throw new Error('Failed to decrypt credentials')
      }
    }
  }

  /**
   * 迁移旧格式的加密数据到新格式
   * 这个方法可以在数据库迁移时使用
   * @param repositoryId 要迁移的仓库ID
   */
  async migrateCredentials(repositoryId: string): Promise<void> {
    const repo = await this.repositoryRepo.findOne({ where: { id: repositoryId } })
    if (!repo || !repo.credentials) {
      return
    }

    try {
      // 检查是否是旧格式
      if (this.encryptionService.isLegacyFormat(repo.credentials)) {
        // 重新加密
        const newEncrypted = this.encryptionService.reencrypt(repo.credentials, this.legacyIv)
        
        // 更新数据库
        await this.repositoryRepo.update(repositoryId, { credentials: newEncrypted })
        console.log(`Successfully migrated credentials for repository ${repositoryId}`)
      }
    } catch (error) {
      console.error(`Failed to migrate credentials for repository ${repositoryId}:`, error.message)
      throw error
    }
  }

  /**
   * 批量迁移所有仓库的凭据
   */
  async migrateAllCredentials(): Promise<{ success: number; failed: string[] }> {
    const repos = await this.repositoryRepo.find()
    const results = { success: 0, failed: [] as string[] }

    for (const repo of repos) {
      if (repo.credentials) {
        try {
          await this.migrateCredentials(repo.id)
          results.success++
        } catch (error) {
          results.failed.push(repo.id)
          console.error(`Failed to migrate repository ${repo.id}:`, error.message)
        }
      }
    }

    return results
  }

  /**
   * 批量验证仓库连接（分页）
   */
  async batchValidateRepositories(options: {
    page?: number
    limit?: number
    filter?: 'enabled' | 'all'
    sortBy?: string
    sortOrder?: 'ASC' | 'DESC'
  }) {
    const {
      page = 1,
      limit = 10,
      filter = 'enabled',
      sortBy = 'updatedAt',
      sortOrder = 'DESC'
    } = options

    // 参数验证
    const normalizedPage = Math.max(1, Math.floor(page))
    const normalizedLimit = Math.min(50, Math.max(1, Math.floor(limit)))
    const offset = (normalizedPage - 1) * normalizedLimit

    // 构建查询
    const queryBuilder = this.repositoryRepo.createQueryBuilder('repository')
    
    if (filter === 'enabled') {
      queryBuilder.where('repository.enabled = :enabled', { enabled: true })
    }

    // 排序
    const validSortFields = ['name', 'updatedAt', 'type']
    const normalizedSortBy = validSortFields.includes(sortBy) ? sortBy : 'updatedAt'
    queryBuilder.orderBy(`repository.${normalizedSortBy}`, sortOrder)

    // 获取总数
    const total = await queryBuilder.getCount()

    // 应用分页
    queryBuilder.skip(offset).take(normalizedLimit)
    const repositories = await queryBuilder.getMany()

    // 批量验证
    const validationResults = await Promise.all(
      repositories.map(async (repo) => {
        try {
          const result = await this.testConfig({
            url: repo.url,
            type: repo.type,
            credentials: repo.credentials ? 'present' : undefined
          })
          
          return {
            id: repo.id,
            name: repo.name,
            url: repo.url,
            type: repo.type,
            success: result.success,
            message: result.message,
            details: result.details,
            validated_at: new Date()
          }
        } catch (error) {
          return {
            id: repo.id,
            name: repo.name,
            url: repo.url,
            type: repo.type,
            success: false,
            message: error.message,
            details: null,
            validated_at: new Date()
          }
        }
      })
    )

    // 计算分页信息
    const totalPages = Math.ceil(total / normalizedLimit)

    return {
      data: validationResults,
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages,
      hasNext: normalizedPage < totalPages,
      hasPrev: normalizedPage > 1,
      summary: {
        totalChecked: validationResults.length,
        successful: validationResults.filter(r => r.success).length,
        failed: validationResults.filter(r => !r.success).length
      }
    }
  }

  /**
   * 获取最近活动的仓库（分页）
   */
  async getRecentRepositories(options: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'ASC' | 'DESC'
    hours?: number
  }) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'DESC',
      hours = 24
    } = options

    // 参数验证
    const normalizedPage = Math.max(1, Math.floor(page))
    const normalizedLimit = Math.min(100, Math.max(1, Math.floor(limit)))
    const offset = (normalizedPage - 1) * normalizedLimit

    // 计算时间范围
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    // 构建查询
    const queryBuilder = this.repositoryRepo.createQueryBuilder('repository')
      .where('repository.updatedAt >= :since', { since })

    // 排序
    const validSortFields = ['name', 'updatedAt', 'createdAt', 'type']
    const normalizedSortBy = validSortFields.includes(sortBy) ? sortBy : 'updatedAt'
    queryBuilder.orderBy(`repository.${normalizedSortBy}`, sortOrder)

    // 获取总数
    const total = await queryBuilder.getCount()

    // 应用分页
    queryBuilder.skip(offset).take(normalizedLimit)
    const repositories = await queryBuilder.getMany()

    // 隐藏敏感信息
    const sanitizedRepos = repositories.map(repo => ({
      ...repo,
      credentials: repo.credentials ? '******' : null
    }))

    // 计算分页信息
    const totalPages = Math.ceil(total / normalizedLimit)

    return {
      data: sanitizedRepos,
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages,
      hasNext: normalizedPage < totalPages,
      hasPrev: normalizedPage > 1,
      timeRange: {
        since,
        hours
      }
    }
  }

  /**
   * 获取分页配置信息
   */
  async getPaginationConfig() {
    return {
      defaults: {
        page: 1,
        limit: 20,
        maxLimit: 100,
        sortBy: 'updatedAt',
        sortOrder: 'DESC'
      },
      limits: {
        maxPageSize: 100,
        maxBatchValidate: 50,
        maxSearchResults: 1000
      },
      supportedSortFields: ['name', 'createdAt', 'updatedAt', 'type', 'enabled'],
      supportedFilters: {
        type: ['git', 'local', 'svn'],
        enabled: [true, false]
      }
    }
  }
}
