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
import { AgentService, CreateAgentDto, UpdateAgentDto } from '../services/agent.service'
import { Agent } from '../entities/agent.entity'

@Controller('api/agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * 创建新 Agent
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAgentDto: CreateAgentDto): Promise<Agent> {
    return this.agentService.createAgent(createAgentDto)
  }

  /**
   * 获取所有 Agent
   */
  @Get()
  async findAll(@Query('createdBy') createdBy?: string): Promise<Agent[]> {
    return this.agentService.getAllAgents(createdBy)
  }

  /**
   * 获取已连接的 Agent
   */
  @Get('connected')
  async findConnected(): Promise<Agent[]> {
    return this.agentService.getConnectedAgents()
  }

  /**
   * 获取单个 Agent
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Agent> {
    return this.agentService.getAgentById(id)
  }

  /**
   * 更新 Agent
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateAgentDto: UpdateAgentDto): Promise<Agent> {
    return this.agentService.updateAgent(id, updateAgentDto)
  }

  /**
   * 删除 Agent
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.agentService.deleteAgent(id)
  }

  /**
   * 重置 Agent 密钥
   */
  @Post(':id/reset-key')
  async resetKey(@Param('id') id: string): Promise<{ secretKey: string }> {
    const secretKey = await this.agentService.resetSecretKey(id)
    return { secretKey }
  }

  /**
   * 断开 Agent 连接
   */
  @Post(':id/disconnect')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@Param('id') id: string): Promise<void> {
    return this.agentService.disconnectAgent(id)
  }
}
