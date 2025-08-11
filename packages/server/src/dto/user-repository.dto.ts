import { IsString, IsEnum, IsOptional, MaxLength, IsUrl } from 'class-validator'

export class CreateRepositoryDto {
  @IsString()
  @MaxLength(100)
  name: string

  @IsEnum(['git', 'local'])
  type: 'git' | 'local'

  @IsString()
  @MaxLength(1000)
  url: string

  @IsString()
  @IsOptional()
  @MaxLength(100)
  branch?: string = 'main'

  @IsString()
  @IsOptional()
  @MaxLength(100)
  username?: string

  @IsString()
  @IsOptional()
  @MaxLength(500)
  password?: string

  @IsString()
  @IsOptional()
  sshKey?: string

  @IsString()
  @IsOptional()
  description?: string
}

export class UpdateRepositoryDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  url?: string

  @IsString()
  @IsOptional()
  @MaxLength(100)
  branch?: string

  @IsString()
  @IsOptional()
  @MaxLength(100)
  username?: string

  @IsString()
  @IsOptional()
  @MaxLength(500)
  password?: string

  @IsString()
  @IsOptional()
  sshKey?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsEnum(['active', 'inactive', 'error'])
  @IsOptional()
  status?: 'active' | 'inactive' | 'error'
}

export class SyncRepositoryDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  branch?: string
}