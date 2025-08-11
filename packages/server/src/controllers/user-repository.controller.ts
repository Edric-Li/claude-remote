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
import { UserRepositoryService } from '../services/user-repository.service'
import {
  CreateRepositoryDto,
  UpdateRepositoryDto,
  SyncRepositoryDto
} from '../dto/user-repository.dto'
import { UserRepository } from '../entities/user-repository.entity'
import { User } from '../entities/user.entity'

@Controller('repositories')
@UseGuards(JwtAuthGuard)
export class UserRepositoryController {
  constructor(private readonly repositoryService: UserRepositoryService) {}

  @Post()
  async createRepository(
    @CurrentUser() user: User,
    @Body() createRepoDto: CreateRepositoryDto
  ): Promise<UserRepository> {
    return this.repositoryService.createRepository(user.id, createRepoDto)
  }

  @Get()
  async findUserRepositories(
    @CurrentUser() user: User,
    @Query('status') status?: string
  ): Promise<UserRepository[]> {
    return this.repositoryService.findUserRepositories(user.id, status)
  }

  @Get('stats')
  async getUserRepositoryStats(@CurrentUser() user: User): Promise<{
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
  }> {
    return this.repositoryService.getUserRepositoryStats(user.id)
  }

  @Get(':id')
  async findById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<UserRepository> {
    return this.repositoryService.findById(id, user.id)
  }

  @Put(':id')
  async updateRepository(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRepoDto: UpdateRepositoryDto
  ): Promise<UserRepository> {
    return this.repositoryService.updateRepository(id, user.id, updateRepoDto)
  }

  @Post(':id/sync')
  async syncRepository(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() syncDto: SyncRepositoryDto
  ): Promise<{ success: boolean; message: string }> {
    return this.repositoryService.syncRepository(id, user.id, syncDto)
  }

  @Post(':id/test')
  async testConnection(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<{ success: boolean; message: string }> {
    return this.repositoryService.testConnection(id, user.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRepository(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    await this.repositoryService.deleteRepository(id, user.id)
  }

  @Post('test-config')
  async testConfig(
    @CurrentUser() user: User,
    @Body() testData: any
  ): Promise<{ success: boolean; message: string; details?: any }> {
    return this.repositoryService.testConfig(testData)
  }
}
