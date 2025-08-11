import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common'
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard'
import { CurrentUser } from '../modules/auth/decorators/current-user.decorator'
import { UserAiConfigService } from '../services/user-ai-config.service'
import { CreateAiConfigDto, UpdateAiConfigDto } from '../dto/user-ai-config.dto'
import { UserAiConfig } from '../entities/user-ai-config.entity'
import { User } from '../entities/user.entity'

@Controller('ai-configs')
@UseGuards(JwtAuthGuard)
export class UserAiConfigController {
  constructor(private readonly aiConfigService: UserAiConfigService) {}

  @Post()
  async createConfig(
    @CurrentUser() user: User,
    @Body() createConfigDto: CreateAiConfigDto
  ): Promise<UserAiConfig> {
    return this.aiConfigService.createConfig(user.id, createConfigDto)
  }

  @Get()
  async findUserConfigs(
    @CurrentUser() user: User,
    @Query('toolType') toolType?: string
  ): Promise<UserAiConfig[]> {
    return this.aiConfigService.findUserConfigs(user.id, toolType)
  }

  @Get('stats')
  async getUserConfigStats(@CurrentUser() user: User): Promise<{
    total: number
    byToolType: Record<string, number>
  }> {
    return this.aiConfigService.getUserConfigStats(user.id)
  }

  @Get('default/:toolType')
  async getDefaultConfig(
    @CurrentUser() user: User,
    @Param('toolType') toolType: 'claude' | 'openai' | 'gemini' | 'ollama' | 'custom'
  ): Promise<UserAiConfig | null> {
    return this.aiConfigService.getDefaultConfig(user.id, toolType)
  }

  @Get(':id')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<UserAiConfig> {
    return this.aiConfigService.findById(id, user.id)
  }

  @Put(':id')
  async updateConfig(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateConfigDto: UpdateAiConfigDto
  ): Promise<UserAiConfig> {
    return this.aiConfigService.updateConfig(id, user.id, updateConfigDto)
  }

  @Put(':id/default')
  async setAsDefault(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<UserAiConfig> {
    return this.aiConfigService.setAsDefault(id, user.id)
  }

  @Post(':id/test')
  async testConnection(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<{ success: boolean; message: string }> {
    return this.aiConfigService.testConnection(id, user.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConfig(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    await this.aiConfigService.deleteConfig(id, user.id)
  }
}
