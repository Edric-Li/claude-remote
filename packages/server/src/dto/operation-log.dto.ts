import { IsString, IsOptional, IsObject, IsIP } from 'class-validator'

export class CreateOperationLogDto {
  @IsString()
  userId: string

  @IsString()
  operationType: string

  @IsString()
  resourceType: string

  @IsString()
  resourceId: string

  @IsObject()
  @IsOptional()
  operationData?: any

  @IsIP()
  @IsOptional()
  ipAddress?: string

  @IsString()
  @IsOptional()
  userAgent?: string
}