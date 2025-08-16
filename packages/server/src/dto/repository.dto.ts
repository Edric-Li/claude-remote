import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUrl,
  MinLength,
  MaxLength,
  IsObject,
  ValidateNested,
  IsNumber,
  IsArray,
  Min,
  Max
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { RepositoryType, RepositorySettings, SUPPORTED_SORT_FIELDS, RetryConfig, ErrorType } from '../types/repository.types'

export class RepositorySettingsDto {
  @IsOptional()
  @IsBoolean()
  autoUpdate?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cachePath?: string

  @IsOptional()
  @IsNumber()
  retryCount?: number

  @IsOptional()
  @IsNumber()
  connectionTimeout?: number
}

export class CreateRepositoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsUrl()
  url: string

  @IsEnum(['git', 'local', 'svn'])
  type: RepositoryType

  @IsOptional()
  @IsString()
  @MaxLength(100)
  branch?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  localPath?: string

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsString()
  credentials?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => RepositorySettingsDto)
  settings?: RepositorySettingsDto
}

export class UpdateRepositoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsOptional()
  @IsUrl()
  url?: string

  @IsOptional()
  @IsEnum(['git', 'local', 'svn'])
  type?: RepositoryType

  @IsOptional()
  @IsString()
  @MaxLength(100)
  branch?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  localPath?: string

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsString()
  credentials?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => RepositorySettingsDto)
  settings?: RepositorySettingsDto
}

export class TestRepositoryDto {
  @IsUrl()
  url: string

  @IsEnum(['git', 'local', 'svn'])
  type: RepositoryType

  @IsOptional()
  @IsString()
  credentials?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => RepositorySettingsDto)
  settings?: RepositorySettingsDto
}

export class SearchRepositoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string

  @IsOptional()
  @IsEnum(['git', 'local', 'svn'])
  type?: RepositoryType

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true
    if (value === 'false' || value === false) return false
    return undefined
  })
  enabled?: boolean

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20

  @IsOptional()
  @IsEnum(SUPPORTED_SORT_FIELDS)
  sortBy?: string = 'updatedAt'

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC'
}

export class PaginationDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number = 1

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20

  @IsOptional()
  @IsEnum(SUPPORTED_SORT_FIELDS)
  sortBy?: string = 'updatedAt'

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC'
}

export class SearchSuggestionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  query: string

  @IsOptional()
  @IsEnum(['name', 'description', 'url'])
  field?: 'name' | 'description' | 'url' = 'name'

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 10
}

export class AdvancedSearchDto extends SearchRepositoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  branch?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  excludeQuery?: string

  @IsOptional()
  @IsArray()
  @IsEnum(['git', 'local', 'svn'], { each: true })
  types?: string[]

  @IsOptional()
  @IsString()
  createdAfter?: string

  @IsOptional()
  @IsString()
  createdBefore?: string

  @IsOptional()
  @IsString()
  updatedAfter?: string

  @IsOptional()
  @IsString()
  updatedBefore?: string

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true
    if (value === 'false' || value === false) return false
    return undefined
  })
  hasCredentials?: boolean
}

export class RetryConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries?: number

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(30000)
  baseDelay?: number

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  maxDelay?: number

  @IsOptional()
  @IsNumber()
  @Min(5000)
  @Max(120000)
  totalTimeout?: number

  @IsOptional()
  @IsArray()
  @IsEnum(['auth', 'host', 'not_found', 'timeout', 'unknown', 'network', 'connection_reset', 'dns_resolution', 'permission_denied', 'invalid_format'], { each: true })
  retryableErrors?: ErrorType[]
}

export class BatchRetryTestDto {
  @IsArray()
  @IsString({ each: true })
  repositoryIds: string[]

  @IsOptional()
  @ValidateNested()
  @Type(() => RetryConfigDto)
  retryConfig?: RetryConfigDto

  @IsOptional()
  @IsBoolean()
  stopOnFirstFailure?: boolean
}

export class RetryStatisticsQueryDto {
  @IsOptional()
  @IsString()
  repositoryId?: string

  @IsOptional()
  @IsString()
  startDate?: string

  @IsOptional()
  @IsString()
  endDate?: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number
}