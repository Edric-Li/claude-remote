import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, SelectQueryBuilder } from 'typeorm'
import { RepositoryEntity } from '../entities/repository.entity'
import {
  SearchCriteria,
  PaginationOptions,
  PaginatedResult,
  SearchPaginationOptions,
  SortField,
  SUPPORTED_SORT_FIELDS,
  DEFAULT_PAGINATION_CONFIG
} from '../types/repository.types'

@Injectable()
export class SearchPaginationService {
  private searchCache = new Map<string, { result: any; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

  constructor(
    @InjectRepository(RepositoryEntity)
    private repositoryRepo: Repository<RepositoryEntity>
  ) {
    // 定期清理过期缓存
    setInterval(() => {
      this.cleanExpiredCache()
    }, 60 * 1000) // 每分钟清理一次
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    this.searchCache.forEach((value, key) => {
      if (now - value.timestamp > this.CACHE_TTL) {
        expiredKeys.push(key)
      }
    })
    
    expiredKeys.forEach(key => {
      this.searchCache.delete(key)
    })
  }

  /**
   * 生成缓存键
   * @param options 搜索选项
   * @returns 缓存键
   */
  private generateCacheKey(options: any): string {
    return JSON.stringify(options)
  }

  /**
   * 从缓存获取结果
   * @param cacheKey 缓存键
   * @returns 缓存的结果或undefined
   */
  private getCachedResult(cacheKey: string): any | undefined {
    const cached = this.searchCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result
    }
    return undefined
  }

  /**
   * 设置缓存结果
   * @param cacheKey 缓存键
   * @param result 结果
   */
  private setCachedResult(cacheKey: string, result: any): void {
    this.searchCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    })
  }

  /**
   * 搜索仓库并返回分页结果
   * @param options 搜索和分页选项
   * @returns 分页结果
   */
  async searchRepositories(options: SearchPaginationOptions): Promise<PaginatedResult<RepositoryEntity>> {
    // 生成缓存键
    const cacheKey = this.generateCacheKey({ method: 'searchRepositories', options })
    
    // 尝试从缓存获取结果
    const cachedResult = this.getCachedResult(cacheKey)
    if (cachedResult) {
      return cachedResult
    }

    // 验证和规范化参数
    const normalizedOptions = this.normalizeSearchPaginationOptions(options)
    
    // 创建查询构建器
    const queryBuilder = this.repositoryRepo.createQueryBuilder('repository')
    
    // 应用搜索条件
    this.applySearchCriteria(queryBuilder, normalizedOptions.searchCriteria)
    
    // 应用过滤条件
    this.applyFilters(queryBuilder, normalizedOptions.filters)
    
    // 应用排序
    this.applySorting(queryBuilder, normalizedOptions.sortBy, normalizedOptions.sortOrder)
    
    // 获取总数（在分页前）
    const total = await queryBuilder.getCount()
    
    // 应用分页
    this.applyPagination(queryBuilder, normalizedOptions.page, normalizedOptions.limit)
    
    // 执行查询
    const data = await queryBuilder.getMany()
    
    // 隐藏敏感信息（凭据）
    const sanitizedData = this.sanitizeRepositoryData(data)
    
    // 构建分页结果
    const result = this.buildPaginatedResult(
      sanitizedData,
      total,
      normalizedOptions.page,
      normalizedOptions.limit
    )

    // 缓存结果
    this.setCachedResult(cacheKey, result)
    
    return result
  }

  /**
   * 获取分页列表（无搜索条件）
   * @param options 分页选项
   * @returns 分页结果
   */
  async getPaginatedList(options: PaginationOptions & { filters?: Record<string, any> }): Promise<PaginatedResult<RepositoryEntity>> {
    const searchOptions: SearchPaginationOptions = {
      ...options,
      searchCriteria: undefined // 不使用搜索条件
    }
    
    return this.searchRepositories(searchOptions)
  }

  /**
   * 构建搜索查询
   * @param queryBuilder TypeORM 查询构建器
   * @param criteria 搜索条件
   * @returns 更新后的查询构建器
   */
  buildSearchQuery(
    queryBuilder: SelectQueryBuilder<RepositoryEntity>,
    criteria?: SearchCriteria
  ): SelectQueryBuilder<RepositoryEntity> {
    if (!criteria) {
      return queryBuilder
    }

    this.applySearchCriteria(queryBuilder, criteria)
    return queryBuilder
  }

  /**
   * 规范化搜索分页选项
   * @param options 原始选项
   * @returns 规范化后的选项
   */
  private normalizeSearchPaginationOptions(options: SearchPaginationOptions): Required<SearchPaginationOptions> {
    const {
      page = DEFAULT_PAGINATION_CONFIG.DEFAULT_PAGE,
      limit = DEFAULT_PAGINATION_CONFIG.DEFAULT_LIMIT,
      sortBy = DEFAULT_PAGINATION_CONFIG.DEFAULT_SORT_BY,
      sortOrder = DEFAULT_PAGINATION_CONFIG.DEFAULT_SORT_ORDER,
      searchCriteria,
      filters
    } = options

    // 验证和限制参数
    const normalizedPage = Math.max(1, Math.floor(page))
    const normalizedLimit = Math.min(
      DEFAULT_PAGINATION_CONFIG.MAX_LIMIT,
      Math.max(1, Math.floor(limit))
    )
    
    // 验证排序字段
    const normalizedSortBy = SUPPORTED_SORT_FIELDS.includes(sortBy as SortField) 
      ? sortBy 
      : DEFAULT_PAGINATION_CONFIG.DEFAULT_SORT_BY
    
    // 验证排序方向
    const normalizedSortOrder = ['ASC', 'DESC'].includes(sortOrder) 
      ? sortOrder 
      : DEFAULT_PAGINATION_CONFIG.DEFAULT_SORT_ORDER

    // 验证搜索条件
    const normalizedSearchCriteria = this.normalizeSearchCriteria(searchCriteria)

    return {
      page: normalizedPage,
      limit: normalizedLimit,
      sortBy: normalizedSortBy,
      sortOrder: normalizedSortOrder,
      searchCriteria: normalizedSearchCriteria,
      filters: filters || {}
    }
  }

  /**
   * 规范化搜索条件
   * @param criteria 原始搜索条件
   * @returns 规范化后的搜索条件
   */
  private normalizeSearchCriteria(criteria?: SearchCriteria): SearchCriteria | undefined {
    if (!criteria) {
      return undefined
    }

    const normalizedCriteria: SearchCriteria = {}

    // 验证搜索关键词
    if (criteria.query && typeof criteria.query === 'string') {
      const trimmedQuery = criteria.query.trim()
      if (trimmedQuery && trimmedQuery.length <= DEFAULT_PAGINATION_CONFIG.MAX_QUERY_LENGTH) {
        normalizedCriteria.query = trimmedQuery
      }
    }

    // 验证仓库类型
    if (criteria.type && ['git', 'local', 'svn'].includes(criteria.type)) {
      normalizedCriteria.type = criteria.type
    }

    // 验证启用状态
    if (typeof criteria.enabled === 'boolean') {
      normalizedCriteria.enabled = criteria.enabled
    }

    return Object.keys(normalizedCriteria).length > 0 ? normalizedCriteria : undefined
  }

  /**
   * 应用搜索条件到查询构建器
   * @param queryBuilder 查询构建器
   * @param criteria 搜索条件
   */
  private applySearchCriteria(
    queryBuilder: SelectQueryBuilder<RepositoryEntity>,
    criteria?: SearchCriteria
  ): void {
    if (!criteria) {
      return
    }

    // 搜索关键词（在名称、描述、URL中搜索）
    if (criteria.query) {
      queryBuilder.andWhere(
        '(LOWER(repository.name) LIKE LOWER(:query) OR LOWER(repository.description) LIKE LOWER(:query) OR LOWER(repository.url) LIKE LOWER(:query))',
        { query: `%${criteria.query}%` }
      )
    }

    // 仓库类型过滤
    if (criteria.type) {
      queryBuilder.andWhere('repository.type = :type', { type: criteria.type })
    }

    // 启用状态过滤
    if (typeof criteria.enabled === 'boolean') {
      queryBuilder.andWhere('repository.enabled = :enabled', { enabled: criteria.enabled })
    }
  }

  /**
   * 应用额外过滤条件
   * @param queryBuilder 查询构建器
   * @param filters 过滤条件
   */
  private applyFilters(
    queryBuilder: SelectQueryBuilder<RepositoryEntity>,
    filters?: Record<string, any>
  ): void {
    if (!filters || Object.keys(filters).length === 0) {
      return
    }

    // 可以根据需要扩展过滤条件
    // 例如：按创建时间范围过滤、按用户过滤等
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // 只处理安全的字段，防止SQL注入
        const safeFields = ['id', 'name', 'type', 'enabled', 'branch']
        if (safeFields.includes(key)) {
          queryBuilder.andWhere(`repository.${key} = :${key}`, { [key]: value })
        }
      }
    })
  }

  /**
   * 应用排序
   * @param queryBuilder 查询构建器
   * @param sortBy 排序字段
   * @param sortOrder 排序方向
   */
  private applySorting(
    queryBuilder: SelectQueryBuilder<RepositoryEntity>,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC'
  ): void {
    const field = sortBy || DEFAULT_PAGINATION_CONFIG.DEFAULT_SORT_BY
    const order = sortOrder || DEFAULT_PAGINATION_CONFIG.DEFAULT_SORT_ORDER
    
    // 确保排序字段是安全的
    if (SUPPORTED_SORT_FIELDS.includes(field as SortField)) {
      queryBuilder.orderBy(`repository.${field}`, order)
    } else {
      // 默认排序
      queryBuilder.orderBy(`repository.${DEFAULT_PAGINATION_CONFIG.DEFAULT_SORT_BY}`, order)
    }
  }

  /**
   * 应用分页
   * @param queryBuilder 查询构建器
   * @param page 页码
   * @param limit 每页数量
   */
  private applyPagination(
    queryBuilder: SelectQueryBuilder<RepositoryEntity>,
    page: number,
    limit: number
  ): void {
    const offset = (page - 1) * limit
    queryBuilder.skip(offset).take(limit)
  }

  /**
   * 清理仓库数据，隐藏敏感信息
   * @param repositories 仓库列表
   * @returns 清理后的仓库列表
   */
  private sanitizeRepositoryData(repositories: RepositoryEntity[]): RepositoryEntity[] {
    return repositories.map(repo => ({
      ...repo,
      credentials: repo.credentials ? '******' : null
    }))
  }

  /**
   * 构建分页结果
   * @param data 数据列表
   * @param total 总记录数
   * @param page 当前页码
   * @param limit 每页数量
   * @returns 分页结果
   */
  private buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / limit)
    
    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  }

  /**
   * 获取搜索建议（自动补全）
   * @param query 搜索关键词
   * @param field 搜索字段（name, description, url）
   * @param limit 返回数量限制
   * @returns 搜索建议列表
   */
  async getSearchSuggestions(
    query: string,
    field: 'name' | 'description' | 'url' = 'name',
    limit: number = 10
  ): Promise<string[]> {
    if (!query || query.trim().length < 2) {
      return []
    }

    const trimmedQuery = query.trim()
    const safeFields = ['name', 'description', 'url']
    
    if (!safeFields.includes(field)) {
      field = 'name'
    }

    const queryBuilder = this.repositoryRepo
      .createQueryBuilder('repository')
      .select(`DISTINCT repository.${field}`, 'value')
      .where(`LOWER(repository.${field}) LIKE LOWER(:query)`, { query: `%${trimmedQuery}%` })
      .andWhere(`repository.${field} IS NOT NULL`)
      .andWhere(`repository.${field} != ''`)
      .orderBy('repository.updatedAt', 'DESC')
      .limit(limit)

    const results = await queryBuilder.getRawMany()
    return results.map(result => result.value).filter(value => value && value.trim())
  }

  /**
   * 获取搜索统计信息
   * @param criteria 搜索条件
   * @returns 统计信息
   */
  async getSearchStatistics(criteria?: SearchCriteria): Promise<{
    total: number
    byType: Record<string, number>
    byEnabled: Record<string, number>
    recentSearches?: string[]
  }> {
    const queryBuilder = this.repositoryRepo.createQueryBuilder('repository')
    
    if (criteria) {
      this.applySearchCriteria(queryBuilder, criteria)
    }

    // 总数
    const total = await queryBuilder.getCount()

    // 按类型统计
    const typeStats = await this.repositoryRepo
      .createQueryBuilder('repository')
      .select('repository.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('repository.type')
      .getRawMany()

    const byType: Record<string, number> = {}
    typeStats.forEach(stat => {
      byType[stat.type] = parseInt(stat.count)
    })

    // 按启用状态统计
    const enabledStats = await this.repositoryRepo
      .createQueryBuilder('repository')
      .select('repository.enabled', 'enabled')
      .addSelect('COUNT(*)', 'count')
      .groupBy('repository.enabled')
      .getRawMany()

    const byEnabled: Record<string, number> = {}
    enabledStats.forEach(stat => {
      byEnabled[stat.enabled ? 'enabled' : 'disabled'] = parseInt(stat.count)
    })

    return {
      total,
      byType,
      byEnabled
    }
  }

  /**
   * 全文搜索（在所有文本字段中搜索）
   * @param searchText 搜索文本
   * @param options 分页选项
   * @returns 搜索结果
   */
  async fullTextSearch(
    searchText: string,
    options: PaginationOptions = {
      page: 1,
      limit: 20,
      sortBy: 'updatedAt',
      sortOrder: 'DESC'
    }
  ): Promise<PaginatedResult<RepositoryEntity & { relevanceScore?: number }>> {
    if (!searchText || searchText.trim().length < 2) {
      return this.getPaginatedList(options)
    }

    const trimmedText = searchText.trim()
    const words = trimmedText.split(/\s+/).filter(word => word.length > 1)

    // 构建查询
    const queryBuilder = this.repositoryRepo.createQueryBuilder('repository')

    // 计算相关性分数
    let relevanceSelect = '0'
    const parameters: any = {}

    words.forEach((word, index) => {
      const paramName = `word${index}`
      parameters[paramName] = `%${word.toLowerCase()}%`
      
      // 为每个字段设置不同的权重
      relevanceSelect += ` + 
        CASE WHEN LOWER(repository.name) LIKE :${paramName} THEN 10 ELSE 0 END +
        CASE WHEN LOWER(repository.description) LIKE :${paramName} THEN 5 ELSE 0 END +
        CASE WHEN LOWER(repository.url) LIKE :${paramName} THEN 3 ELSE 0 END +
        CASE WHEN LOWER(repository.branch) LIKE :${paramName} THEN 2 ELSE 0 END`
    })

    queryBuilder
      .select('repository.*')
      .addSelect(`(${relevanceSelect})`, 'relevanceScore')
      .where(
        words.map((_, index) => {
          const paramName = `word${index}`
          return `(
            LOWER(repository.name) LIKE :${paramName} OR 
            LOWER(repository.description) LIKE :${paramName} OR 
            LOWER(repository.url) LIKE :${paramName} OR 
            LOWER(repository.branch) LIKE :${paramName}
          )`
        }).join(' AND '),
        parameters
      )
      .having('relevanceScore > 0')
      .orderBy('relevanceScore', 'DESC')
      .addOrderBy(`repository.${options.sortBy || 'updatedAt'}`, options.sortOrder || 'DESC')

    // 获取总数
    const countQuery = this.repositoryRepo.createQueryBuilder('repository')
      .where(
        words.map((_, index) => {
          const paramName = `word${index}`
          return `(
            LOWER(repository.name) LIKE :${paramName} OR 
            LOWER(repository.description) LIKE :${paramName} OR 
            LOWER(repository.url) LIKE :${paramName} OR 
            LOWER(repository.branch) LIKE :${paramName}
          )`
        }).join(' AND '),
        parameters
      )
    
    const total = await countQuery.getCount()

    // 应用分页
    const offset = ((options.page || 1) - 1) * (options.limit || 20)
    queryBuilder.skip(offset).take(options.limit || 20)

    // 执行查询
    const rawResults = await queryBuilder.getRawAndEntities()
    
    // 合并实体和相关性分数
    const results = rawResults.entities.map((entity, index) => ({
      ...entity,
      credentials: entity.credentials ? '******' : null,
      relevanceScore: parseFloat(rawResults.raw[index].relevanceScore) || 0
    }))

    return this.buildPaginatedResult(
      results,
      total,
      options.page || 1,
      options.limit || 20
    )
  }

  /**
   * 模糊搜索（使用相似度匹配）
   * @param searchText 搜索文本
   * @param threshold 相似度阈值 (0-1)
   * @param options 分页选项
   * @returns 搜索结果
   */
  async fuzzySearch(
    searchText: string,
    threshold: number = 0.3,
    options: PaginationOptions = {
      page: 1,
      limit: 20,
      sortBy: 'updatedAt',
      sortOrder: 'DESC'
    }
  ): Promise<PaginatedResult<RepositoryEntity>> {
    if (!searchText || searchText.trim().length < 2) {
      return this.getPaginatedList(options)
    }

    const trimmedText = searchText.trim().toLowerCase()
    
    // 首先获取所有仓库
    const allRepos = await this.repositoryRepo.find()
    
    // 计算相似度并过滤
    const fuzzyResults = allRepos
      .map(repo => ({
        ...repo,
        similarity: this.calculateSimilarity(trimmedText, repo)
      }))
      .filter(repo => repo.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)

    // 应用分页
    const total = fuzzyResults.length
    const offset = ((options.page || 1) - 1) * (options.limit || 20)
    const paginatedResults = fuzzyResults.slice(offset, offset + (options.limit || 20))

    // 清理敏感信息
    const sanitizedResults = paginatedResults.map(repo => ({
      ...repo,
      credentials: repo.credentials ? '******' : null
    }))

    return this.buildPaginatedResult(
      sanitizedResults,
      total,
      options.page || 1,
      options.limit || 20
    )
  }

  /**
   * 计算字符串相似度
   * @param searchText 搜索文本
   * @param repo 仓库对象
   * @returns 相似度分数 (0-1)
   */
  private calculateSimilarity(searchText: string, repo: RepositoryEntity): number {
    const fields = [
      { text: repo.name?.toLowerCase() || '', weight: 0.4 },
      { text: repo.description?.toLowerCase() || '', weight: 0.3 },
      { text: repo.url?.toLowerCase() || '', weight: 0.2 },
      { text: repo.branch?.toLowerCase() || '', weight: 0.1 }
    ]

    let totalSimilarity = 0
    let totalWeight = 0

    fields.forEach(field => {
      if (field.text) {
        const similarity = this.levenshteinSimilarity(searchText, field.text)
        totalSimilarity += similarity * field.weight
        totalWeight += field.weight
      }
    })

    return totalWeight > 0 ? totalSimilarity / totalWeight : 0
  }

  /**
   * 计算两个字符串的 Levenshtein 相似度
   * @param a 字符串A
   * @param b 字符串B
   * @returns 相似度 (0-1)
   */
  private levenshteinSimilarity(a: string, b: string): number {
    if (a === b) return 1
    if (a.includes(b) || b.includes(a)) return 0.8
    
    const matrix = []
    const aLen = a.length
    const bLen = b.length

    if (aLen === 0) return bLen === 0 ? 1 : 0
    if (bLen === 0) return 0

    // 初始化矩阵
    for (let i = 0; i <= bLen; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= aLen; j++) {
      matrix[0][j] = j
    }

    // 计算编辑距离
    for (let i = 1; i <= bLen; i++) {
      for (let j = 1; j <= aLen; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // 替换
            matrix[i][j - 1] + 1,     // 插入
            matrix[i - 1][j] + 1      // 删除
          )
        }
      }
    }

    const maxLen = Math.max(aLen, bLen)
    return 1 - matrix[bLen][aLen] / maxLen
  }
}