import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query,
  HttpCode,
  HttpStatus
} from '@nestjs/common'
import { DataSource } from 'typeorm'
import { Agent } from '../entities/agent.entity'
import * as crypto from 'crypto'

interface CreateAgentDto {
  name: string
  description?: string
  maxWorkers: number
  createdBy: string
}

interface UpdateAgentDto {
  name?: string
  description?: string
  maxWorkers?: number
}

@Controller('api/agents-simple')
export class AgentSimpleController {
  private dataSource: DataSource

  constructor() {
    // 临时解决方案：直接创建数据源
    this.initDataSource()
  }

  private async initDataSource() {
    const { getDatabaseConfig } = await import('../config/database.config')
    this.dataSource = new DataSource(getDatabaseConfig() as any)
    await this.dataSource.initialize()
  }

  private generateSecretKey(): string {
    const segments = []
    for (let i = 0; i < 4; i++) {
      segments.push(crypto.randomBytes(2).toString('hex').toUpperCase())
    }
    return `AIO-${segments.join('-')}`
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAgentDto: CreateAgentDto): Promise<Agent> {
    if (!this.dataSource?.isInitialized) {
      await this.initDataSource()
    }

    const repository = this.dataSource.getRepository(Agent)
    const agent = repository.create({
      ...createAgentDto,
      secretKey: this.generateSecretKey(),
      status: 'pending'
    })
    
    return repository.save(agent)
  }

  @Get()
  async findAll(@Query('createdBy') createdBy?: string): Promise<Agent[]> {
    if (!this.dataSource?.isInitialized) {
      await this.initDataSource()
    }

    const repository = this.dataSource.getRepository(Agent)
    
    if (createdBy) {
      return repository.find({
        where: { createdBy },
        order: { createdAt: 'DESC' }
      })
    }
    
    return repository.find({
      order: { createdAt: 'DESC' }
    })
  }

  @Get('connected')
  async findConnected(): Promise<Agent[]> {
    if (!this.dataSource?.isInitialized) {
      await this.initDataSource()
    }

    const repository = this.dataSource.getRepository(Agent)
    return repository.find({
      where: { status: 'connected' },
      order: { createdAt: 'DESC' }
    })
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Agent> {
    if (!this.dataSource?.isInitialized) {
      await this.initDataSource()
    }

    const repository = this.dataSource.getRepository(Agent)
    const agent = await repository.findOne({ where: { id } })
    
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    return agent
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAgentDto: UpdateAgentDto
  ): Promise<Agent> {
    if (!this.dataSource?.isInitialized) {
      await this.initDataSource()
    }

    const repository = this.dataSource.getRepository(Agent)
    await repository.update(id, updateAgentDto)
    
    const agent = await repository.findOne({ where: { id } })
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    return agent
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    if (!this.dataSource?.isInitialized) {
      await this.initDataSource()
    }

    const repository = this.dataSource.getRepository(Agent)
    const result = await repository.delete(id)
    
    if (!result.affected) {
      throw new Error('Agent not found')
    }
  }

  @Post(':id/reset-key')
  async resetKey(@Param('id') id: string): Promise<{ secretKey: string }> {
    if (!this.dataSource?.isInitialized) {
      await this.initDataSource()
    }

    const repository = this.dataSource.getRepository(Agent)
    const secretKey = this.generateSecretKey()
    
    await repository.update(id, { secretKey })
    
    return { secretKey }
  }
}