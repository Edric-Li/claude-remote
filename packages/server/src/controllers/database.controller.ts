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
}