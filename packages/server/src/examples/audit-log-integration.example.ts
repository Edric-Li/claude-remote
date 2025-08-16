/**
 * 审计日志集成示例
 * 
 * 此文件展示了如何在现有服务中集成审计日志功能
 * 
 * @example
 * 
 * // 在 RepositoryService 中集成审计日志
 * import { AuditLogService } from '../services/audit-log.service'
 * import { AuditAction } from '../types/audit.types'
 * 
 * @Injectable()
 * export class RepositoryService {
 *   constructor(
 *     private auditLogService: AuditLogService
 *   ) {}
 * 
 *   async createRepository(data: CreateRepositoryDto, userId: string, req: Request) {
 *     const startTime = Date.now()
 *     
 *     try {
 *       const repository = await this.repositoryRepo.create(data)
 *       const duration = Date.now() - startTime
 *       
 *       // 记录成功的创建操作
 *       await this.auditLogService.logRepositoryCreate(
 *         repository.id,
 *         userId,
 *         data,
 *         {
 *           ipAddress: req.ip,
 *           userAgent: req.get('User-Agent'),
 *           durationMs: duration
 *         }
 *       )
 *       
 *       return repository
 *     } catch (error) {
 *       const duration = Date.now() - startTime
 *       
 *       // 记录失败的创建操作
 *       await this.auditLogService.logOperation(
 *         AuditAction.CREATE,
 *         'unknown', // 创建失败时可能没有ID
 *         userId,
 *         {
 *           errorMessage: error.message,
 *           metadata: data
 *         },
 *         {
 *           ipAddress: req.ip,
 *           userAgent: req.get('User-Agent'),
 *           success: false,
 *           durationMs: duration
 *         }
 *       )
 *       
 *       throw error
 *     }
 *   }
 * 
 *   async updateRepository(id: string, data: UpdateRepositoryDto, userId: string, req: Request) {
 *     const startTime = Date.now()
 *     const oldRepository = await this.findOne(id)
 *     
 *     try {
 *       const updatedRepository = await this.repositoryRepo.update(id, data)
 *       const duration = Date.now() - startTime
 *       
 *       // 计算变更字段
 *       const changes = this.calculateChanges(oldRepository, data)
 *       
 *       // 记录更新操作
 *       await this.auditLogService.logRepositoryUpdate(
 *         id,
 *         userId,
 *         changes,
 *         {
 *           ipAddress: req.ip,
 *           userAgent: req.get('User-Agent'),
 *           durationMs: duration
 *         }
 *       )
 *       
 *       return updatedRepository
 *     } catch (error) {
 *       const duration = Date.now() - startTime
 *       
 *       await this.auditLogService.logOperation(
 *         AuditAction.UPDATE,
 *         id,
 *         userId,
 *         {
 *           errorMessage: error.message,
 *           changes: data
 *         },
 *         {
 *           ipAddress: req.ip,
 *           userAgent: req.get('User-Agent'),
 *           success: false,
 *           durationMs: duration
 *         }
 *       )
 *       
 *       throw error
 *     }
 *   }
 * 
 *   async testRepository(id: string, userId: string, req: Request) {
 *     const startTime = Date.now()
 *     
 *     try {
 *       const testResult = await this.performRepositoryTest(id)
 *       const duration = Date.now() - startTime
 *       
 *       // 记录测试操作
 *       await this.auditLogService.logRepositoryTest(
 *         id,
 *         userId,
 *         testResult,
 *         {
 *           ipAddress: req.ip,
 *           userAgent: req.get('User-Agent'),
 *           durationMs: duration
 *         }
 *       )
 *       
 *       return testResult
 *     } catch (error) {
 *       const duration = Date.now() - startTime
 *       
 *       await this.auditLogService.logRepositoryTest(
 *         id,
 *         userId,
 *         {
 *           success: false,
 *           message: error.message,
 *           timestamp: new Date()
 *         },
 *         {
 *           ipAddress: req.ip,
 *           userAgent: req.get('User-Agent'),
 *           durationMs: duration
 *         }
 *       )
 *       
 *       throw error
 *     }
 *   }
 * 
 *   private calculateChanges(oldData: any, newData: any): Record<string, any> {
 *     const changes: Record<string, any> = {}
 *     
 *     for (const key in newData) {
 *       if (newData[key] !== oldData[key]) {
 *         changes[key] = {
 *           from: oldData[key],
 *           to: newData[key]
 *         }
 *       }
 *     }
 *     
 *     return changes
 *   }
 * }
 * 
 * // 在控制器中使用
 * @Controller('repositories')
 * export class RepositoryController {
 *   constructor(
 *     private repositoryService: RepositoryService,
 *     private auditLogService: AuditLogService
 *   ) {}
 * 
 *   @Post()
 *   async create(@Body() data: CreateRepositoryDto, @CurrentUser() user: User, @Req() req: Request) {
 *     return this.repositoryService.createRepository(data, user.id, req)
 *   }
 * 
 *   @Get(':id/audit-logs')
 *   async getAuditLogs(@Param('id') id: string) {
 *     return this.auditLogService.getRepositoryAuditLog(id)
 *   }
 * }
 * 
 * // 定时清理任务
 * import { Cron, CronExpression } from '@nestjs/schedule'
 * 
 * @Injectable()
 * export class AuditLogCleanupService {
 *   constructor(private auditLogService: AuditLogService) {}
 * 
 *   @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
 *   async cleanupOldLogs() {
 *     const retentionDays = 90 // 保留90天
 *     await this.auditLogService.cleanupOldLogs(retentionDays)
 *   }
 * }
 */

export class AuditLogIntegrationExample {
  // 此类仅用于文档和示例目的
}