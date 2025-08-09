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
import { SecurityService } from '../services/security.service'

@Controller('api/security')
export class SecurityController {
  constructor(
    private readonly securityService: SecurityService
  ) {}

  /**
   * 获取安全设置
   */
  @Get('settings')
  getSecuritySettings() {
    return this.securityService.getSecuritySettings()
  }

  /**
   * 更新安全设置
   */
  @Put('settings')
  updateSecuritySettings(@Body() settings: any) {
    return this.securityService.updateSecuritySettings(settings)
  }

  /**
   * 获取安全日志
   */
  @Get('logs')
  getSecurityLogs(@Query('limit') limit?: string) {
    const logLimit = limit ? parseInt(limit) : 100
    return this.securityService.getSecurityLogs(logLimit)
  }

  /**
   * 生成访问令牌
   */
  @Post('tokens')
  async generateAccessToken(@Body() body: { name: string; permissions?: string[] }) {
    return this.securityService.generateAccessToken(body.name, body.permissions || [])
  }

  /**
   * 获取所有访问令牌
   */
  @Get('tokens')
  getAccessTokens() {
    return this.securityService.getAccessTokens()
  }

  /**
   * 撤销访问令牌
   */
  @Delete('tokens/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeAccessToken(@Param('id') id: string) {
    this.securityService.revokeAccessToken(id)
  }

  /**
   * 添加 IP 到白名单
   */
  @Post('whitelist')
  addIPToWhitelist(@Body('ip') ip: string) {
    this.securityService.addIPToWhitelist(ip)
    return { success: true }
  }

  /**
   * 从白名单移除 IP
   */
  @Delete('whitelist/:ip')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeIPFromWhitelist(@Param('ip') ip: string) {
    this.securityService.removeIPFromWhitelist(ip)
  }

  /**
   * 清理过期日志
   */
  @Post('logs/cleanup')
  cleanupLogs() {
    const deletedCount = this.securityService.cleanupLogs()
    return { deletedCount }
  }
}