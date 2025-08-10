import { Controller, Get, Put, Post, Body, Request, UseGuards } from '@nestjs/common'
import { ClaudeService } from '../services/claude.service'
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard'
import { Public } from '../modules/auth/decorators/public.decorator'

@Controller('api/claude')
export class ClaudeController {
  constructor(private readonly claudeService: ClaudeService) {}

  @Get('config')
  @UseGuards(JwtAuthGuard)
  async getConfig() {
    // 获取全局配置
    return this.claudeService.getConfig()
  }

  // Agent 专用端点，无需认证
  @Get('config/agent')
  @Public()
  async getAgentConfig() {
    // Agent 使用全局配置
    return this.claudeService.getConfig()
  }

  @Put('config')
  @UseGuards(JwtAuthGuard)
  async updateConfig(
    @Body() config: { 
      baseUrl: string; 
      authToken: string;
    }
  ) {
    // 保存全局配置
    return this.claudeService.saveConfig(config)
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async testConnection(@Body() config: { 
    baseUrl: string; 
    authToken: string;
  }) {
    return this.claudeService.testConnection(config)
  }
}