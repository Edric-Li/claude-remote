import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common'
import { RepositoryService } from '../services/repository.service'
import { RepositoryEntity } from '../entities/repository.entity'

@Controller('api/repositories')
export class RepositoryController {
  constructor(private readonly repositoryService: RepositoryService) {}

  @Post()
  async create(@Body() data: Partial<RepositoryEntity>) {
    return this.repositoryService.create(data)
  }

  @Get()
  async findAll() {
    return this.repositoryService.findAll()
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.repositoryService.findOne(id)
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Partial<RepositoryEntity>) {
    return this.repositoryService.update(id, data)
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.repositoryService.delete(id)
  }

  @Post(':id/test')
  async testConnection(@Param('id') id: string) {
    return this.repositoryService.testConnection(id)
  }

  @Post(':id/workspace')
  async createWorkspace(
    @Param('id') id: string,
    @Body('workerId') workerId: string
  ) {
    const workspaceDir = await this.repositoryService.createWorkspace(id, workerId)
    return { success: true, workspaceDir }
  }

  @Post('test-config')
  async testConfig(@Body() data: Partial<RepositoryEntity>) {
    // 直接测试配置，不保存到数据库
    return this.repositoryService.testConfig(data)
  }
}