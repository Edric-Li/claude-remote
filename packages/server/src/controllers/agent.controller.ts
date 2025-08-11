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
  HttpStatus,
  UseGuards,
  Request
} from '@nestjs/common'
import { AgentService, CreateAgentDto, UpdateAgentDto } from '../services/agent.service'
import { Agent } from '../entities/agent.entity'
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard'

@Controller('api/agents')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * 创建新 Agent
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAgentDto: Omit<CreateAgentDto, 'createdBy'>, @Request() req): Promise<Agent> {
    return this.agentService.createAgent({
      ...createAgentDto,
      createdBy: req.user.id
    })
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

  /**
   * 获取 Agent 连接命令
   */
  @Get(':id/connection-command')
  async getConnectionCommand(
    @Param('id') id: string,
    @Query('env') env?: 'local' | 'development' | 'production'
  ): Promise<{ command: string; env: string; instructions: string[] }> {
    const agent = await this.agentService.getAgentById(id)
    const serverUrl = this.getServerUrl(env || 'local')
    
    const command = `npm install -g @ai-orchestra/agent && ai-agent connect --key=${agent.secretKey} --server=${serverUrl}`
    
    const instructions = [
      '1. 确保已安装 Node.js 16+ 版本',
      '2. 在终端中运行上述命令',
      '3. Agent 将自动连接到服务器',
      '4. 使用 ai-agent status 查看连接状态',
      '5. 使用 ai-agent logs 查看运行日志'
    ]
    
    return {
      command,
      env: env || 'local',
      instructions
    }
  }

  private getServerUrl(env: string): string {
    switch (env) {
      case 'production':
        return process.env.PRODUCTION_URL || 'https://api.ai-orchestra.com'
      case 'development':
        return process.env.DEVELOPMENT_URL || 'https://dev.ai-orchestra.com'
      case 'local':
      default:
        return `http://localhost:${process.env.PORT || 3001}`
    }
  }
}
