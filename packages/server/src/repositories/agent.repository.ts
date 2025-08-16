import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, SelectQueryBuilder, In } from 'typeorm'
import { Agent } from '../entities/agent.entity'
import { BaseRepository } from './base.repository'

export interface AgentFilters {
  search?: string
  status?: 'pending' | 'connected' | 'offline'
  tags?: string[]
  createdBy?: string
  platform?: string
  lastSeenAfter?: Date
  lastSeenBefore?: Date
  createdAfter?: Date
  createdBefore?: Date
  hasValidationResult?: boolean
  monitoringEnabled?: boolean
}

export interface PaginationOptions {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface PaginatedResult<T> {
  items: T[]
  totalCount: number
  page: number
  limit: number
  totalPages: number
}

export interface BatchUpdateOptions {
  ids: string[]
  updates: Partial<Agent>
  userId?: string
}

@Injectable()
export class AgentRepository extends BaseRepository<Agent> {
  constructor(
    @InjectRepository(Agent)
    repository: Repository<Agent>
  ) {
    super(repository)
  }

  async findBySecretKey(secretKey: string): Promise<Agent | null> {
    return this.repository.findOne({
      where: { secretKey }
    })
  }

  async findByName(name: string): Promise<Agent | null> {
    return this.repository.findOne({
      where: { name }
    })
  }

  async findByStatus(status: 'pending' | 'connected' | 'offline'): Promise<Agent[]> {
    return this.repository.find({
      where: { status },
      order: {
        createdAt: 'DESC'
      }
    })
  }

  async findConnectedAgents(): Promise<Agent[]> {
    return this.findByStatus('connected')
  }

  async updateStatus(id: string, status: 'pending' | 'connected' | 'offline'): Promise<void> {
    await this.repository.update(id, {
      status,
      lastSeenAt: status === 'connected' ? new Date() : undefined
    })
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.repository.update(id, {
      lastSeenAt: new Date(),
      status: 'connected'
    })
  }

  async setOffline(id: string): Promise<void> {
    await this.updateStatus(id, 'offline')
  }

  async isSecretKeyUnique(secretKey: string, excludeId?: string): Promise<boolean> {
    const query = this.repository
      .createQueryBuilder('agent')
      .where('agent.secretKey = :secretKey', { secretKey })

    if (excludeId) {
      query.andWhere('agent.id != :excludeId', { excludeId })
    }

    const count = await query.getCount()
    return count === 0
  }

  async findByCreator(createdBy: string): Promise<Agent[]> {
    return this.repository.find({
      where: { createdBy },
      order: {
        createdAt: 'DESC'
      }
    })
  }

  /**
   * 高级筛选和搜索
   */
  async findWithFilters(
    filters: AgentFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Agent>> {
    const queryBuilder = this.createFilteredQueryBuilder(filters)

    // 应用排序
    if (pagination?.sortBy) {
      const sortField = pagination.sortBy === 'lastSeenAt' ? 'agent.lastSeenAt' :
                       pagination.sortBy === 'createdAt' ? 'agent.createdAt' :
                       pagination.sortBy === 'name' ? 'agent.name' :
                       pagination.sortBy === 'status' ? 'agent.status' :
                       `agent.${pagination.sortBy}`
      
      queryBuilder.orderBy(sortField, pagination.sortOrder || 'DESC')
    } else {
      queryBuilder.orderBy('agent.createdAt', 'DESC')
    }

    // 应用分页
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit
      queryBuilder.skip(offset).take(pagination.limit)
    }

    const [items, totalCount] = await queryBuilder.getManyAndCount()

    return {
      items,
      totalCount,
      page: pagination?.page || 1,
      limit: pagination?.limit || totalCount,
      totalPages: pagination ? Math.ceil(totalCount / pagination.limit) : 1
    }
  }

  /**
   * 创建筛选查询构建器
   */
  private createFilteredQueryBuilder(filters: AgentFilters): SelectQueryBuilder<Agent> {
    const queryBuilder = this.repository.createQueryBuilder('agent')

    // 文本搜索
    if (filters.search) {
      queryBuilder.andWhere(
        '(agent.name ILIKE :search OR agent.description ILIKE :search OR agent.hostname ILIKE :search)',
        { search: `%${filters.search}%` }
      )
    }

    // 状态筛选
    if (filters.status) {
      queryBuilder.andWhere('agent.status = :status', { status: filters.status })
    }

    // 创建者筛选
    if (filters.createdBy) {
      queryBuilder.andWhere('agent.createdBy = :createdBy', { createdBy: filters.createdBy })
    }

    // 平台筛选
    if (filters.platform) {
      queryBuilder.andWhere('agent.platform = :platform', { platform: filters.platform })
    }

    // 标签筛选
    if (filters.tags && filters.tags.length > 0) {
      // PostgreSQL JSONB 查询，检查是否包含任一标签
      queryBuilder.andWhere('agent.tags ?| array[:...tags]', { tags: filters.tags })
    }

    // 时间范围筛选
    if (filters.lastSeenAfter) {
      queryBuilder.andWhere('agent.lastSeenAt >= :lastSeenAfter', { lastSeenAfter: filters.lastSeenAfter })
    }

    if (filters.lastSeenBefore) {
      queryBuilder.andWhere('agent.lastSeenAt <= :lastSeenBefore', { lastSeenBefore: filters.lastSeenBefore })
    }

    if (filters.createdAfter) {
      queryBuilder.andWhere('agent.createdAt >= :createdAfter', { createdAfter: filters.createdAfter })
    }

    if (filters.createdBefore) {
      queryBuilder.andWhere('agent.createdAt <= :createdBefore', { createdBefore: filters.createdBefore })
    }

    // 验证结果筛选
    if (filters.hasValidationResult !== undefined) {
      if (filters.hasValidationResult) {
        queryBuilder.andWhere("agent.metadata->>'lastValidationResult' IS NOT NULL")
      } else {
        queryBuilder.andWhere("agent.metadata->>'lastValidationResult' IS NULL")
      }
    }

    // 监控配置筛选
    if (filters.monitoringEnabled !== undefined) {
      queryBuilder.andWhere(
        "agent.metadata->'monitoringConfig'->>'enabled' = :monitoringEnabled",
        { monitoringEnabled: filters.monitoringEnabled.toString() }
      )
    }

    return queryBuilder
  }

  /**
   * 批量更新Agent
   */
  async batchUpdate(options: BatchUpdateOptions): Promise<{
    successCount: number
    failureCount: number
    results: Array<{ id: string; success: boolean; error?: string }>
  }> {
    const results = []
    let successCount = 0
    let failureCount = 0

    for (const id of options.ids) {
      try {
        await this.repository.update(id, {
          ...options.updates,
          updatedAt: new Date()
        })
        results.push({ id, success: true })
        successCount++
      } catch (error) {
        results.push({ id, success: false, error: error.message })
        failureCount++
      }
    }

    return { successCount, failureCount, results }
  }

  /**
   * 批量删除Agent
   */
  async batchDelete(ids: string[]): Promise<{
    successCount: number
    failureCount: number
    results: Array<{ id: string; success: boolean; error?: string }>
  }> {
    const results = []
    let successCount = 0
    let failureCount = 0

    // 首先检查哪些Agent可以删除（不是connected状态）
    const agents = await this.repository.find({
      where: { id: In(ids) },
      select: ['id', 'status', 'name']
    })

    for (const agent of agents) {
      try {
        if (agent.status === 'connected') {
          results.push({ 
            id: agent.id, 
            success: false, 
            error: 'Cannot delete connected agent' 
          })
          failureCount++
        } else {
          await this.repository.delete(agent.id)
          results.push({ id: agent.id, success: true })
          successCount++
        }
      } catch (error) {
        results.push({ id: agent.id, success: false, error: error.message })
        failureCount++
      }
    }

    // 处理不存在的IDs
    const existingIds = agents.map(a => a.id)
    const missingIds = ids.filter(id => !existingIds.includes(id))
    for (const id of missingIds) {
      results.push({ id, success: false, error: 'Agent not found' })
      failureCount++
    }

    return { successCount, failureCount, results }
  }

  /**
   * 获取Agent统计信息
   */
  async getStatistics(): Promise<{
    total: number
    byStatus: Record<string, number>
    byPlatform: Record<string, number>
    recentlyActive: number
    withMonitoring: number
  }> {
    const total = await this.repository.count()

    // 按状态统计
    const statusStats = await this.repository
      .createQueryBuilder('agent')
      .select('agent.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('agent.status')
      .getRawMany()

    const byStatus = statusStats.reduce((acc, item) => {
      acc[item.status] = parseInt(item.count)
      return acc
    }, {})

    // 按平台统计
    const platformStats = await this.repository
      .createQueryBuilder('agent')
      .select('agent.platform', 'platform')
      .addSelect('COUNT(*)', 'count')
      .where('agent.platform IS NOT NULL')
      .groupBy('agent.platform')
      .getRawMany()

    const byPlatform = platformStats.reduce((acc, item) => {
      acc[item.platform] = parseInt(item.count)
      return acc
    }, {})

    // 最近活跃的Agent（24小时内）
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentlyActive = await this.repository
      .createQueryBuilder('agent')
      .where('agent.lastSeenAt >= :date', { date: twentyFourHoursAgo })
      .getCount()

    // 启用监控的Agent数量
    const withMonitoring = await this.repository
      .createQueryBuilder('agent')
      .where("agent.metadata->'monitoringConfig'->>'enabled' = 'true'")
      .getCount()

    return {
      total,
      byStatus,
      byPlatform,
      recentlyActive,
      withMonitoring
    }
  }

  /**
   * 根据标签查找Agent
   */
  async findByTags(tags: string[]): Promise<Agent[]> {
    return this.repository
      .createQueryBuilder('agent')
      .where('agent.tags ?| array[:...tags]', { tags })
      .orderBy('agent.createdAt', 'DESC')
      .getMany()
  }

  /**
   * 获取需要验证的Agent
   */
  async findAgentsNeedingValidation(olderThanMinutes: number = 30): Promise<Agent[]> {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000)
    
    return this.repository
      .createQueryBuilder('agent')
      .where('agent.status = :status', { status: 'connected' })
      .andWhere(
        '(agent.lastValidatedAt IS NULL OR agent.lastValidatedAt < :cutoffTime)',
        { cutoffTime }
      )
      .orderBy('agent.lastValidatedAt', 'ASC', 'NULLS FIRST')
      .getMany()
  }
}
