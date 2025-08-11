import { IsString, IsEnum, IsObject, IsBoolean, IsOptional, MaxLength, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { AiConfigData } from '../entities/user-ai-config.entity'

export class CreateAiConfigDto {
  @IsString()
  @MaxLength(100)
  name: string

  @IsEnum(['claude', 'openai', 'gemini', 'ollama', 'custom'])
  toolType: 'claude' | 'openai' | 'gemini' | 'ollama' | 'custom'

  @IsObject()
  configData: AiConfigData

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean = false
}

export class UpdateAiConfigDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string

  @IsObject()
  @IsOptional()
  configData?: AiConfigData

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean
}

export class SetDefaultAiConfigDto {
  @IsBoolean()
  isDefault: boolean
}