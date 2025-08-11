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
import { UserAssistantService } from '../services/user-assistant.service'
import { CreateAssistantDto, UpdateAssistantDto, AssistantRepositoryDto } from '../dto/user-assistant.dto'
import { UserAssistant } from '../entities/user-assistant.entity'
import { AssistantRepository } from '../entities/assistant-repository.entity'
import { User } from '../entities/user.entity'

@Controller('assistants')
@UseGuards(JwtAuthGuard)
export class UserAssistantController {
  constructor(private readonly assistantService: UserAssistantService) {}

  @Post()
  async createAssistant(
    @CurrentUser() user: User,
    @Body() createAssistantDto: CreateAssistantDto
  ): Promise<UserAssistant> {
    return this.assistantService.createAssistant(user.id, createAssistantDto)
  }

  @Get()
  async findUserAssistants(
    @CurrentUser() user: User,
    @Query('status') status?: string
  ): Promise<UserAssistant[]> {
    return this.assistantService.findUserAssistants(user.id, status)
  }

  @Get('stats')
  async getUserAssistantStats(
    @CurrentUser() user: User
  ): Promise<{
    total: number
    byStatus: Record<string, number>
    totalRepositories: number
    totalConversations: number
  }> {
    return this.assistantService.getUserAssistantStats(user.id)
  }

  @Get(':id')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<UserAssistant> {
    return this.assistantService.findById(id, user.id)
  }

  @Put(':id')
  async updateAssistant(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAssistantDto: UpdateAssistantDto
  ): Promise<UserAssistant> {
    return this.assistantService.updateAssistant(id, user.id, updateAssistantDto)
  }

  @Post(':id/repositories')
  async addRepositoryToAssistant(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) assistantId: string,
    @Body() repoDto: AssistantRepositoryDto
  ): Promise<AssistantRepository> {
    return this.assistantService.addRepositoryToAssistant(assistantId, user.id, repoDto)
  }

  @Delete(':id/repositories/:repositoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRepositoryFromAssistant(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) assistantId: string,
    @Param('repositoryId', ParseUUIDPipe) repositoryId: string
  ): Promise<void> {
    await this.assistantService.removeRepositoryFromAssistant(assistantId, repositoryId, user.id)
  }

  @Post(':id/repositories/:repositoryId/sync')
  async syncAssistantRepository(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) assistantId: string,
    @Param('repositoryId', ParseUUIDPipe) repositoryId: string
  ): Promise<{ success: boolean; message: string }> {
    return this.assistantService.syncAssistantRepository(assistantId, repositoryId, user.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAssistant(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    await this.assistantService.deleteAssistant(id, user.id)
  }
}