import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Body, 
  Param,
  HttpCode,
  HttpStatus
} from '@nestjs/common'
import { DatabaseService } from '../services/database.service'

@Controller('api/database')
export class DatabaseController {
  constructor(
    private readonly databaseService: DatabaseService
  ) {}

  /**
   * 获取数据库信息
   */
  @Get('info')
  async getDatabaseInfo() {
    return this.databaseService.getDatabaseInfo()
  }

  /**
   * 创建备份
   */
  @Post('backup')
  @HttpCode(HttpStatus.CREATED)
  async createBackup() {
    return this.databaseService.createBackup()
  }

  /**
   * 获取备份列表
   */
  @Get('backups')
  async getBackupList() {
    return this.databaseService.getBackupList()
  }

  /**
   * 恢复备份
   */
  @Post('restore')
  async restoreBackup(@Body('filename') filename: string) {
    return this.databaseService.restoreBackup(filename)
  }

  /**
   * 删除备份
   */
  @Delete('backups/:filename')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBackup(@Param('filename') filename: string) {
    return this.databaseService.deleteBackup(filename)
  }

  /**
   * 优化数据库
   */
  @Post('optimize')
  async optimizeDatabase() {
    return this.databaseService.optimizeDatabase()
  }

  /**
   * 清除所有对话内容
   */
  @Delete('conversations')
  @HttpCode(HttpStatus.OK)
  async clearAllConversations() {
    return this.databaseService.clearAllConversations()
  }

  /**
   * 清除指定用户的对话内容
   */
  @Delete('conversations/user/:userId')
  @HttpCode(HttpStatus.OK)
  async clearUserConversations(@Param('userId') userId: string) {
    return this.databaseService.clearUserConversations(userId)
  }

  /**
   * 清除指定会话的消息
   */
  @Delete('conversations/session/:sessionId')
  @HttpCode(HttpStatus.OK)
  async clearSessionMessages(@Param('sessionId') sessionId: string) {
    return this.databaseService.clearSessionMessages(sessionId)
  }
}