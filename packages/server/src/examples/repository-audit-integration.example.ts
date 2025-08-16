/**
 * Repository Audit Integration Example
 * 
 * 这个示例展示了审计日志服务如何与仓库服务无缝集成，
 * 记录所有重要的操作并提供可靠性保证。
 */

import { Injectable, Logger } from '@nestjs/common'
import { RepositoryService } from '../services/repository.service'
import { AuditLogService } from '../services/audit-log.service'
import { AuditAction } from '../types/audit.types'

@Injectable()
export class RepositoryAuditIntegrationExample {
  private readonly logger = new Logger(RepositoryAuditIntegrationExample.name)

  constructor(
    private repositoryService: RepositoryService,
    private auditLogService: AuditLogService
  ) {}

  /**
   * 演示完整的仓库操作审计流程
   */
  async demonstrateRepositoryAuditFlow() {
    const userId = 'user-123'
    const context = {
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Example Browser)'
    }

    try {
      // 1. 创建仓库 - 自动记录 CREATE 审计日志
      this.logger.log('===== 演示仓库创建审计 =====')
      const repository = await this.repositoryService.create({
        name: '示例仓库',
        url: 'https://github.com/example/repo.git',
        type: 'git',
        credentials: 'token123',
        description: '这是一个示例仓库'
      }, userId, context)
      
      this.logger.log(`仓库创建成功: ${repository.id}`)

      // 2. 测试连接 - 自动记录 TEST 审计日志
      this.logger.log('===== 演示连接测试审计 =====')
      const testResult = await this.repositoryService.testConnection(
        repository.id, 
        userId, 
        context
      )
      
      this.logger.log(`连接测试结果: ${testResult.success ? '成功' : '失败'}`)

      // 3. 更新仓库 - 自动记录 UPDATE 审计日志
      this.logger.log('===== 演示仓库更新审计 =====')
      const updatedRepo = await this.repositoryService.update(
        repository.id,
        {
          description: '更新后的描述',
          branch: 'develop'
        },
        userId,
        context
      )
      
      this.logger.log(`仓库更新成功: ${updatedRepo.description}`)

      // 4. 克隆仓库 - 自动记录 CLONE 审计日志
      this.logger.log('===== 演示仓库克隆审计 =====')
      const cloneResult = await this.repositoryService.cloneRepository(
        repository.id,
        '/tmp/example-workspace',
        userId,
        context
      )
      
      this.logger.log(`克隆结果: ${cloneResult.success ? '成功' : '失败'}`)

      // 5. 查询审计日志
      this.logger.log('===== 演示审计日志查询 =====')
      const auditLogs = await this.auditLogService.getRepositoryAuditLog(repository.id, 10)
      
      this.logger.log(`找到 ${auditLogs.length} 条审计日志:`)
      auditLogs.forEach(log => {
        this.logger.log(`  - ${log.action} 操作 by ${log.userId} at ${log.timestamp}`)
      })

      // 6. 获取统计信息
      this.logger.log('===== 演示审计统计信息 =====')
      const statistics = await this.auditLogService.getStatistics(repository.id)
      this.logger.log(`审计统计:`, statistics)

      // 7. 删除仓库 - 自动记录 DELETE 审计日志
      this.logger.log('===== 演示仓库删除审计 =====')
      await this.repositoryService.delete(repository.id, userId, context)
      this.logger.log('仓库删除成功')

      return {
        success: true,
        message: '审计日志集成演示完成',
        repositoryId: repository.id,
        auditLogCount: auditLogs.length
      }

    } catch (error) {
      this.logger.error('演示过程中发生错误:', error.message)
      throw error
    }
  }

  /**
   * 演示错误处理和事务保护
   */
  async demonstrateErrorHandlingAndTransactions() {
    const userId = 'user-456'
    const context = {
      ipAddress: '192.168.1.101',
      userAgent: 'Test Client'
    }

    this.logger.log('===== 演示错误处理和事务保护 =====')

    try {
      // 尝试创建一个无效的仓库配置
      await this.repositoryService.create({
        name: '无效仓库',
        url: 'invalid-url',
        type: 'git'
      }, userId, context)
    } catch (error) {
      this.logger.log('预期的错误被正确捕获:', error.message)
      
      // 验证即使操作失败，审计日志也应该记录
      const failedLogs = await this.auditLogService.getAuditLog({
        userId,
        action: AuditAction.CREATE,
        page: 1,
        limit: 10
      })
      
      this.logger.log(`找到 ${failedLogs.total} 条失败的创建操作审计日志`)
    }

    // 演示审计日志记录失败不影响主要操作的场景
    this.logger.log('===== 演示审计日志容错性 =====')
    
    // 这里可以模拟审计日志服务暂时不可用的情况
    // 主要操作应该仍然能够正常执行
    const testConfig = await this.repositoryService.testConfig({
      name: '测试配置',
      url: 'https://github.com/public/repo.git',
      type: 'git'
    })
    
    this.logger.log(`配置测试结果: ${testConfig.success}`)
  }

  /**
   * 演示审计日志清理功能
   */
  async demonstrateAuditLogCleanup() {
    this.logger.log('===== 演示审计日志清理 =====')
    
    // 清理超过30天的审计日志
    const deletedCount = await this.auditLogService.cleanupOldLogs(30)
    this.logger.log(`清理了 ${deletedCount} 条超过30天的审计日志`)
    
    // 获取清理后的统计信息
    const statistics = await this.auditLogService.getStatistics()
    this.logger.log('清理后的统计信息:', statistics)
  }

  /**
   * 演示批量操作的审计记录
   */
  async demonstrateBulkOperationAudit() {
    this.logger.log('===== 演示批量操作审计 =====')
    
    const userId = 'admin-user'
    const context = {
      ipAddress: '192.168.1.10',
      userAgent: 'Admin Console'
    }

    // 批量创建审计日志（用于数据迁移等场景）
    const bulkOperations = [
      {
        repositoryId: 'repo-1',
        userId,
        action: AuditAction.CREATE,
        details: { metadata: { operation: 'bulk_migration' } },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        success: true
      },
      {
        repositoryId: 'repo-2',
        userId,
        action: AuditAction.CREATE,
        details: { metadata: { operation: 'bulk_migration' } },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        success: true
      }
    ]

    const logs = await this.auditLogService.bulkLogOperations(bulkOperations)
    this.logger.log(`批量创建了 ${logs.length} 条审计日志`)
  }
}

/**
 * 使用示例：
 * 
 * // 在你的服务或控制器中注入这个示例类
 * constructor(
 *   private auditExample: RepositoryAuditIntegrationExample
 * ) {}
 * 
 * // 运行完整的演示
 * async runDemo() {
 *   await this.auditExample.demonstrateRepositoryAuditFlow()
 *   await this.auditExample.demonstrateErrorHandlingAndTransactions()
 *   await this.auditExample.demonstrateAuditLogCleanup()
 *   await this.auditExample.demonstrateBulkOperationAudit()
 * }
 * 
 * 关键特性展示：
 * 
 * 1. 自动审计记录：所有 CRUD 操作都会自动记录审计日志
 * 2. 上下文信息：记录 IP 地址、用户代理、操作耗时等
 * 3. 错误处理：审计日志记录失败不影响主要业务流程
 * 4. 事务保护：操作和审计在同一事务中执行
 * 5. 查询功能：支持多种查询条件和分页
 * 6. 统计分析：提供操作统计和趋势分析
 * 7. 清理机制：自动清理过期的审计日志
 * 8. 批量操作：支持批量审计日志记录
 */