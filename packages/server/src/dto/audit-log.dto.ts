import { IsOptional, IsString, IsEnum, IsDateString, IsNumber, Min, Max } from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { AuditAction } from '../types/audit.types'

/**
 * 创建审计日志 DTO
 */
export class CreateAuditLogDto {
  @IsString()
  repositoryId: string

  @IsString()
  userId: string

  @IsEnum(AuditAction)
  action: AuditAction

  @IsOptional()
  details?: any

  @IsOptional()
  @IsString()
  ipAddress?: string

  @IsOptional()
  @IsString()
  userAgent?: string

  @IsOptional()
  success?: boolean

  @IsOptional()
  @IsNumber()
  durationMs?: number
}

/**
 * 查询审计日志 DTO
 */
export class QueryAuditLogDto {
  @IsOptional()
  @IsString()
  repositoryId?: string

  @IsOptional()
  @IsString()
  userId?: string

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20
}

/**
 * 审计日志响应 DTO
 */
export class AuditLogResponseDto {
  id: string
  repositoryId: string
  userId: string
  action: AuditAction
  details?: any
  timestamp: Date
  ipAddress?: string
  userAgent?: string
  success: boolean
  durationMs?: number

  // 关联数据
  repository?: {
    id: string
    name: string
  }
  user?: {
    id: string
    username: string
    displayName?: string
  }
}

/**
 * 增强版审计日志查询 DTO - 包含完整分页和排序参数
 */
export class RepositoryAuditLogDto {
  @IsOptional()
  @IsString()
  repositoryId?: string

  @IsOptional()
  @IsString()
  userId?: string

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20

  @IsOptional()
  @IsEnum(['timestamp', 'action', 'success', 'durationMs'])
  sortBy?: string = 'timestamp'

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC'
}

/**
 * 批量验证仓库 DTO
 */
export class BatchValidateRepositoryDto {
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10

  @IsOptional()
  @IsEnum(['enabled', 'all'])
  filter?: string = 'enabled'

  @IsOptional()
  @IsEnum(['name', 'updatedAt'])
  sortBy?: string = 'updatedAt'

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC'
}

/**
 * 审计日志分页响应 DTO
 */
export class AuditLogPageResponseDto {
  logs: AuditLogResponseDto[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}