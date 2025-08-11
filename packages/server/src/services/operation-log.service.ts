import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OperationLog } from '../entities/operation-log.entity'

export interface CreateLogDto {
  userId?: string
  operationType: string
  resourceType?: string
  resourceId?: string
  operationData?: any
  ipAddress?: string
  userAgent?: string
}

@Injectable()
export class OperationLogService {
  constructor(
    @InjectRepository(OperationLog)
    private operationLogRepository: Repository<OperationLog>
  ) {}

  async createLog(logData: CreateLogDto): Promise<OperationLog> {
    const log = this.operationLogRepository.create(logData)
    return await this.operationLogRepository.save(log)
  }

  async findLogs(
    page = 1,
    limit = 50,
    userId?: string,
    operationType?: string,
    resourceType?: string
  ): Promise<{ logs: OperationLog[]; total: number }> {
    const query = this.operationLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC')

    if (userId) {
      query.andWhere('log.userId = :userId', { userId })
    }

    if (operationType) {
      query.andWhere('log.operationType = :operationType', { operationType })
    }

    if (resourceType) {
      query.andWhere('log.resourceType = :resourceType', { resourceType })
    }

    const [logs, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    return { logs, total }
  }

  async deleteOldLogs(daysOld: number): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await this.operationLogRepository
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoffDate', { cutoffDate })
      .execute()

    return result.affected || 0
  }
}