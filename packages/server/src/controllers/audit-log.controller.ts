import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Req,
  HttpStatus,
  HttpCode,
  Post,
  Body,
  Delete
} from '@nestjs/common'
import { Request } from 'express'
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard'
import { AuditLogService } from '../services/audit-log.service'
import { QueryAuditLogDto, AuditLogPageResponseDto, AuditLogResponseDto } from '../dto/audit-log.dto'

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  /**
   * 获取审计日志列表（分页）
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAuditLogs(@Query() query: QueryAuditLogDto): Promise<AuditLogPageResponseDto> {
    const result = await this.auditLogService.getAuditLog(query)
    
    return {
      logs: result.logs.map(log => this.transformToResponse(log)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasNext: result.hasNext || false,
      hasPrev: result.hasPrev || false
    }
  }

  /**
   * 获取指定仓库的审计日志
   */
  @Get('repository/:repositoryId')
  @HttpCode(HttpStatus.OK)
  async getRepositoryAuditLogs(
    @Param('repositoryId') repositoryId: string,
    @Query('limit') limit?: string
  ): Promise<AuditLogResponseDto[]> {
    const logs = await this.auditLogService.getRepositoryAuditLog(
      repositoryId,
      limit ? parseInt(limit) : 100
    )
    
    return logs.map(log => this.transformToResponse(log))
  }

  /**
   * 获取指定用户的审计日志
   */
  @Get('user/:userId')
  @HttpCode(HttpStatus.OK)
  async getUserAuditLogs(
    @Param('userId') userId: string,
    @Query('limit') limit?: string
  ): Promise<AuditLogResponseDto[]> {
    const logs = await this.auditLogService.getUserAuditLog(
      userId,
      limit ? parseInt(limit) : 100
    )
    
    return logs.map(log => this.transformToResponse(log))
  }

  /**
   * 获取审计统计信息
   */
  @Get('statistics')
  @HttpCode(HttpStatus.OK)
  async getStatistics(@Query('repositoryId') repositoryId?: string) {
    return this.auditLogService.getStatistics(repositoryId)
  }

  /**
   * 获取指定仓库的审计统计信息
   */
  @Get('statistics/repository/:repositoryId')
  @HttpCode(HttpStatus.OK)
  async getRepositoryStatistics(@Param('repositoryId') repositoryId: string) {
    return this.auditLogService.getStatistics(repositoryId)
  }

  /**
   * 清理旧的审计日志（仅管理员）
   */
  @Delete('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanupOldLogs(
    @Query('retentionDays') retentionDays?: string,
    @Req() req?: Request
  ) {
    // TODO: 添加管理员权限检查
    const deletedCount = await this.auditLogService.cleanupOldLogs(
      retentionDays ? parseInt(retentionDays) : 90
    )
    
    return {
      message: `已清理 ${deletedCount} 条审计日志`,
      deletedCount
    }
  }

  /**
   * 转换实体为响应 DTO
   */
  private transformToResponse(log: any): AuditLogResponseDto {
    return {
      id: log.id,
      repositoryId: log.repositoryId,
      userId: log.userId,
      action: log.action,
      details: log.details,
      timestamp: log.timestamp,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      success: log.success,
      durationMs: log.durationMs,
      repository: log.repository ? {
        id: log.repository.id,
        name: log.repository.name
      } : undefined,
      user: log.user ? {
        id: log.user.id,
        username: log.user.username,
        displayName: log.user.displayName
      } : undefined
    }
  }
}