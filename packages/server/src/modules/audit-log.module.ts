import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLogEntity } from '../entities/audit-log.entity'
import { AuditLogRepository } from '../repositories/audit-log.repository'
import { AuditLogService } from '../services/audit-log.service'
import { AuditLogController } from '../controllers/audit-log.controller'

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditLogRepository, AuditLogService],
  controllers: [AuditLogController],
  exports: [AuditLogService, AuditLogRepository]
})
export class AuditLogModule {}