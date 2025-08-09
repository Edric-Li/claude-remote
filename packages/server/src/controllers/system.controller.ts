import { Controller, Get } from '@nestjs/common'
import { SystemService } from '../services/system.service'

@Controller('api/system')
export class SystemController {
  constructor(
    private readonly systemService: SystemService
  ) {}

  /**
   * 获取系统概览
   */
  @Get('overview')
  async getSystemOverview() {
    return this.systemService.getSystemOverview()
  }
}