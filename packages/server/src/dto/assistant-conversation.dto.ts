import {
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
  IsEnum,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max
} from 'class-validator'
import { Type } from 'class-transformer'

export class CreateConversationDto {
  @IsUUID()
  assistantId: string

  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string
}

export class UpdateConversationDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string

  @IsEnum(['active', 'archived', 'deleted'])
  @IsOptional()
  status?: 'active' | 'archived' | 'deleted'
}

export class CreateMessageDto {
  @IsEnum(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system'

  @IsString()
  content: string

  @IsOptional()
  metadata?: any

  @IsInt()
  @IsOptional()
  @Min(0)
  tokenCount?: number
}

export class BatchCreateMessagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMessageDto)
  messages: CreateMessageDto[]
}

export class ArchiveConversationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMessageDto)
  @IsOptional()
  messages?: CreateMessageDto[]
}
