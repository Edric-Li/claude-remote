import { IsString, IsUUID, IsOptional, MaxLength, IsArray, IsEnum } from 'class-validator'

export class CreateAssistantDto {
  @IsString()
  @MaxLength(100)
  name: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  @IsOptional()
  @MaxLength(100)
  avatar?: string = '🤖'

  @IsUUID()
  aiConfigId: string

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  repositoryIds?: string[] = []
}

export class UpdateAssistantDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  @IsOptional()
  @MaxLength(100)
  avatar?: string

  @IsUUID()
  @IsOptional()
  aiConfigId?: string

  @IsEnum(['active', 'inactive', 'creating', 'error'])
  @IsOptional()
  status?: 'active' | 'inactive' | 'creating' | 'error'
}

export class AssistantRepositoryDto {
  @IsUUID()
  repositoryId: string

  @IsString()
  @IsOptional()
  @MaxLength(100)
  syncBranch?: string = 'main'

  @IsOptional()
  autoSync?: boolean = true
}