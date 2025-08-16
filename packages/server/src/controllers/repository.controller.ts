import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common'
import { Request } from 'express'
import { RepositoryService } from '../services/repository.service'
import { SearchPaginationService } from '../services/search-pagination.service'
import { RepositoryEntity } from '../entities/repository.entity'
import { 
  CreateRepositoryDto, 
  UpdateRepositoryDto, 
  TestRepositoryDto, 
  SearchRepositoryDto, 
  PaginationDto,
  SearchSuggestionDto,
  AdvancedSearchDto,
  RetryConfigDto,
  BatchRetryTestDto,
  RetryStatisticsQueryDto
} from '../dto/repository.dto'
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard'
import { CurrentUser } from '../modules/auth/decorators/current-user.decorator'

@Controller('api/repositories')
@UseGuards(JwtAuthGuard)
export class RepositoryController {
  constructor(
    private readonly repositoryService: RepositoryService,
    private readonly searchPaginationService: SearchPaginationService
  ) {}
  
  /**
   * 从请求中提取上下文信息
   */
  private getRequestContext(req: Request) {
    return {
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    }
  }

  /**
   * 转换 DTO 到 Entity 格式（处理 settings 序列化）
   */
  private transformDtoToEntity(dto: any): any {
    const { settings, ...rest } = dto
    return {
      ...rest,
      settings: settings ? JSON.stringify(settings) : undefined
    }
  }

  @Post()
  async create(
    @Body() data: CreateRepositoryDto,
    @CurrentUser() user: any,
    @Req() req: Request
  ) {
    const context = this.getRequestContext(req)
    return this.repositoryService.create(this.transformDtoToEntity(data), user.id, context)
  }

  @Get()
  async findAll() {
    return this.repositoryService.findAll()
  }

  @Get('paginated-v2')
  async getPaginatedRepositories(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC'
  ) {
    return this.repositoryService.findAllPaginated(page, limit, sortBy, sortOrder)
  }

  // ===== 搜索相关端点 =====
  // 注意：具体路径的路由必须在参数路由之前定义
  
  @Get('search/suggestions')
  async getSearchSuggestions(@Query() suggestionDto: SearchSuggestionDto) {
    const { query, field, limit } = suggestionDto
    return this.searchPaginationService.getSearchSuggestions(
      query,
      field || 'name',
      limit || 10
    )
  }

  @Get('search/statistics')
  async getSearchStatistics(@Query() searchDto: Partial<SearchRepositoryDto>) {
    const { query, type, enabled } = searchDto
    
    const searchCriteria = Object.keys({ query, type, enabled }).length > 0 ? {
      query,
      type,
      enabled
    } : undefined
    
    return this.searchPaginationService.getSearchStatistics(searchCriteria)
  }

  @Get('search/fulltext')
  async fullTextSearch(
    @Query('q') searchText: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC'
  ) {
    const options = {
      page: page || 1,
      limit: limit || 20,
      sortBy: sortBy || 'updatedAt',
      sortOrder: sortOrder || 'DESC'
    }
    
    return this.searchPaginationService.fullTextSearch(searchText, options)
  }

  @Get('search/fuzzy')
  async fuzzySearch(
    @Query('q') searchText: string,
    @Query('threshold') threshold?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC'
  ) {
    const options = {
      page: page || 1,
      limit: limit || 20,
      sortBy: sortBy || 'updatedAt',
      sortOrder: sortOrder || 'DESC'
    }
    
    return this.searchPaginationService.fuzzySearch(
      searchText,
      threshold || 0.3,
      options
    )
  }

  @Get('search/advanced')
  async advancedSearchRepositories(@Query() advancedSearchDto: AdvancedSearchDto) {
    return this.repositoryService.advancedSearch(advancedSearchDto)
  }

  @Post('search/batch')
  async batchSearchRepositories(@Body() searchQueries: SearchRepositoryDto[]) {
    if (!Array.isArray(searchQueries) || searchQueries.length === 0) {
      return { error: '请提供搜索查询数组' }
    }

    if (searchQueries.length > 10) {
      return { error: '批量搜索最多支持10个查询' }
    }

    const results = await Promise.all(
      searchQueries.map(async (searchDto, index) => {
        try {
          const { query, type, enabled, page, limit, sortBy, sortOrder } = searchDto
          
          const searchCriteria = {
            query,
            type,
            enabled
          }
          
          const options = {
            page: page || 1,
            limit: limit || 20,
            sortBy: sortBy || 'updatedAt',
            sortOrder: sortOrder || 'DESC',
            searchCriteria
          }
          
          const result = await this.searchPaginationService.searchRepositories(options)
          
          return {
            index,
            query: searchDto,
            result,
            success: true
          }
        } catch (error) {
          return {
            index,
            query: searchDto,
            error: error.message,
            success: false
          }
        }
      })
    )

    return {
      success: true,
      results,
      totalQueries: searchQueries.length,
      successfulQueries: results.filter(r => r.success).length,
      failedQueries: results.filter(r => !r.success).length
    }
  }

  @Get('search')
  async searchRepositories(@Query() searchDto: SearchRepositoryDto) {
    const { query, type, enabled, page, limit, sortBy, sortOrder } = searchDto
    
    const searchCriteria = {
      query,
      type,
      enabled
    }
    
    const options = {
      page: page || 1,
      limit: limit || 20,
      sortBy: sortBy || 'updatedAt',
      sortOrder: sortOrder || 'DESC',
      searchCriteria
    }
    
    return this.searchPaginationService.searchRepositories(options)
  }

  // 保持向后兼容的备用搜索端点
  @Get('search-v2')
  async searchRepositoriesV2(
    @Query('query') query?: string,
    @Query('type') type?: string,
    @Query('enabled') enabled?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC'
  ) {
    // 转换 enabled 参数
    let enabledBoolean: boolean | undefined
    if (enabled === 'true') enabledBoolean = true
    else if (enabled === 'false') enabledBoolean = false

    return this.repositoryService.searchPaginated({
      query,
      type,
      enabled: enabledBoolean,
      page,
      limit,
      sortBy,
      sortOrder
    })
  }

  // ===== 分页相关端点 =====

  @Get('paginated')
  async getPaginatedList(@Query() paginationDto: PaginationDto) {
    const { page, limit, sortBy, sortOrder } = paginationDto
    
    const options = {
      page: page || 1,
      limit: limit || 20,
      sortBy: sortBy || 'updatedAt',
      sortOrder: sortOrder || 'DESC'
    }
    
    return this.searchPaginationService.getPaginatedList(options)
  }

  // ===== 测试相关端点 =====

  @Post('test-config')
  async testConfig(@Body() data: TestRepositoryDto) {
    // 直接测试配置，不保存到数据库
    return this.repositoryService.testConfig(this.transformDtoToEntity(data))
  }

  @Post('test-config-with-retry')
  async testConfigWithRetry(
    @Body() body: { data: TestRepositoryDto; retryConfig?: any }
  ) {
    // 带重试机制的配置测试
    return this.repositoryService.testConfigWithRetry(this.transformDtoToEntity(body.data), body.retryConfig)
  }

  @Post('batch/test-with-retry')
  async batchRetryTest(
    @Body() batchDto: BatchRetryTestDto,
    @CurrentUser() user: any,
    @Req() req: Request
  ) {
    const context = this.getRequestContext(req)
    return this.repositoryService.batchRetryTest(
      batchDto.repositoryIds,
      batchDto.retryConfig,
      batchDto.stopOnFirstFailure,
      user.id,
      context
    )
  }

  @Get('retry/statistics')
  async getRetryStatistics(@Query() queryDto: RetryStatisticsQueryDto) {
    return this.repositoryService.getRetryStatistics(
      queryDto.repositoryId,
      queryDto.startDate,
      queryDto.endDate,
      queryDto.limit
    )
  }

  @Get('retry/config')
  async getDefaultRetryConfig() {
    return this.repositoryService.getDefaultRetryConfig()
  }

  @Put('retry/config')
  async updateDefaultRetryConfig(@Body() config: RetryConfigDto) {
    return this.repositoryService.updateDefaultRetryConfig(config)
  }

  // ===== 单个仓库操作端点 =====

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.repositoryService.findOne(id)
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateRepositoryDto,
    @CurrentUser() user: any,
    @Req() req: Request
  ) {
    const context = this.getRequestContext(req)
    return this.repositoryService.update(id, this.transformDtoToEntity(data), user.id, context)
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request
  ) {
    const context = this.getRequestContext(req)
    await this.repositoryService.delete(id, user.id, context)
    return { success: true, message: '仓库删除成功' }
  }

  @Post(':id/test')
  async testConnection(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request
  ) {
    const context = this.getRequestContext(req)
    return this.repositoryService.testConnection(id, user.id, context)
  }

  @Post(':id/test-with-retry')
  async testConnectionWithRetry(
    @Param('id') id: string,
    @Body() retryConfig: any,
    @CurrentUser() user: any,
    @Req() req: Request
  ) {
    const context = this.getRequestContext(req)
    return this.repositoryService.testConnectionWithRetry(id, user.id, context, retryConfig)
  }

  @Get(':id/retry/history')
  async getRepositoryRetryHistory(
    @Param('id') id: string,
    @Query() queryDto: RetryStatisticsQueryDto
  ) {
    return this.repositoryService.getRetryStatistics(
      id,
      queryDto.startDate,
      queryDto.endDate,
      queryDto.limit
    )
  }

  @Get(':id/branches')
  async getBranches(@Param('id') id: string) {
    return this.repositoryService.getBranches(id)
  }

  @Post(':id/workspace')
  async createWorkspace(
    @Param('id') id: string,
    @Body('workerId') workerId: string,
    @CurrentUser() user: any,
    @Req() req: Request
  ) {
    const context = this.getRequestContext(req)
    const workspaceDir = await this.repositoryService.createWorkspace(id, workerId, user.id, context)
    return { success: true, workspaceDir }
  }
  
  @Post(':id/clone')
  async cloneRepository(
    @Param('id') id: string,
    @Body('targetPath') targetPath: string,
    @CurrentUser() user: any,
    @Req() req: Request
  ) {
    const context = this.getRequestContext(req)
    return this.repositoryService.cloneRepository(id, targetPath, user.id, context)
  }
  
  // ===== 批量操作端点 =====

  @Post('batch/validate')
  async batchValidateRepositories(@Query() batchDto: any) {
    return this.repositoryService.batchValidateRepositories({
      page: batchDto.page,
      limit: batchDto.limit,
      filter: batchDto.filter as 'enabled' | 'all',
      sortBy: batchDto.sortBy,
      sortOrder: batchDto.sortOrder
    })
  }

  // ===== 分页配置和工具端点 =====

  @Get('pagination/config')
  async getPaginationConfig() {
    return this.repositoryService.getPaginationConfig()
  }

  @Get('recent')
  async getRecentRepositories(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('hours') hours?: number
  ) {
    return this.repositoryService.getRecentRepositories({
      page,
      limit,
      sortBy,
      sortOrder,
      hours
    })
  }

  // ===== 审计日志相关端点 (已禁用) =====
  
  // @Get('audit-logs')
  // async getAuditLogs(@Query() query: QueryAuditLogDto) {
  //   return this.auditLogService.getAuditLog(query)
  // }
  
  // @Get(':id/audit-logs')
  // async getRepositoryAuditLogs(
  //   @Param('id') id: string,
  //   @Query('limit') limit?: number
  // ) {
  //   return this.auditLogService.getRepositoryAuditLog(id, limit)
  // }

  // @Get(':id/audit-logs-paginated')
  // async getRepositoryAuditLogsPaginated(
  //   @Param('id') id: string,
  //   @Query() params: RepositoryAuditLogDto
  // ) {
  //   return this.auditLogService.getRepositoryAuditLogPaginated(id, params)
  // }
  
  // @Get('audit-logs/statistics')
  // async getAuditStatistics(@Query('repositoryId') repositoryId?: string) {
  //   return this.auditLogService.getStatistics(repositoryId)
  // }
  
  // @Delete('audit-logs/cleanup')
  // async cleanupAuditLogs(@Query('retentionDays') retentionDays?: number) {
  //   const deletedCount = await this.auditLogService.cleanupOldLogs(retentionDays)
  //   return { success: true, deletedCount, message: `已清理 ${deletedCount} 条审计日志` }
  // }
}