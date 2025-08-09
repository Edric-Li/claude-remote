import { Controller, Get, Put, Post, Body } from '@nestjs/common'
import { ClaudeService } from '../services/claude.service'

@Controller('api/claude')
export class ClaudeController {
  constructor(private readonly claudeService: ClaudeService) {}

  @Get('config')
  async getConfig() {
    return this.claudeService.getConfig()
  }

  @Put('config')
  async updateConfig(@Body() config: { baseUrl: string; authToken: string }) {
    return this.claudeService.saveConfig(config)
  }

  @Post('test')
  async testConnection(@Body() config: { baseUrl: string; authToken: string }) {
    return this.claudeService.testConnection(config)
  }
}