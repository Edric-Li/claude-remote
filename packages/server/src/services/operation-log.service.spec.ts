import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { OperationLogService } from './operation-log.service'
import { OperationLog } from '../entities/operation-log.entity'
import { createMockRepository } from '../test/test-utils'
import { CreateOperationLogDto } from '../dto/operation-log.dto'

describe('OperationLogService', () => {
  let service: OperationLogService
  let operationLogRepository: jest.Mocked<Repository<OperationLog>>

  const mockOperationLog = {
    id: 'log-1',
    userId: 'user-1',
    operationType: 'user_login',
    resourceType: 'user',
    resourceId: 'user-1',
    operationData: { loginMethod: 'password' },
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationLogService,
        {
          provide: getRepositoryToken(OperationLog),
          useValue: createMockRepository(),
        },
      ],
    }).compile()

    service = module.get<OperationLogService>(OperationLogService)
    operationLogRepository = module.get(getRepositoryToken(OperationLog))
  })

  describe('createLog', () => {
    const createLogDto: CreateOperationLogDto = {
      userId: 'user-1',
      operationType: 'user_login',
      resourceType: 'user',
      resourceId: 'user-1',
      operationData: { loginMethod: 'password' },
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    }

    it('should create operation log successfully', async () => {
      operationLogRepository.create.mockReturnValue(mockOperationLog as OperationLog)
      operationLogRepository.save.mockResolvedValue(mockOperationLog as OperationLog)

      const result = await service.createLog(createLogDto)

      expect(operationLogRepository.create).toHaveBeenCalledWith(createLogDto)
      expect(operationLogRepository.save).toHaveBeenCalledWith(mockOperationLog)
      expect(result).toEqual(mockOperationLog)
    })

    it('should create log without optional fields', async () => {
      const minimalLogDto = {
        userId: 'user-1',
        operationType: 'user_logout',
        resourceType: 'user',
        resourceId: 'user-1',
      }
      const minimalLog = { ...mockOperationLog, ...minimalLogDto }
      operationLogRepository.create.mockReturnValue(minimalLog as OperationLog)
      operationLogRepository.save.mockResolvedValue(minimalLog as OperationLog)

      const result = await service.createLog(minimalLogDto)

      expect(operationLogRepository.create).toHaveBeenCalledWith(minimalLogDto)
      expect(result).toEqual(minimalLog)
    })

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database error')
      operationLogRepository.create.mockReturnValue(mockOperationLog as OperationLog)
      operationLogRepository.save.mockRejectedValue(error)

      await expect(service.createLog(createLogDto))
        .rejects.toThrow('Database error')
    })
  })

  describe('findUserLogs', () => {
    it('should return user operation logs', async () => {
      const logs = [mockOperationLog as OperationLog]
      operationLogRepository.find.mockResolvedValue(logs)

      const result = await service.findUserLogs('user-1')

      expect(operationLogRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        take: 100,
      })
      expect(result).toEqual(logs)
    })

    it('should support custom limit and offset', async () => {
      const logs = [mockOperationLog as OperationLog]
      operationLogRepository.find.mockResolvedValue(logs)

      await service.findUserLogs('user-1', 50, 20)

      expect(operationLogRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 20,
      })
    })

    it('should filter by operation type', async () => {
      const logs = [mockOperationLog as OperationLog]
      operationLogRepository.find.mockResolvedValue(logs)

      await service.findUserLogs('user-1', undefined, undefined, 'user_login')

      expect(operationLogRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', operationType: 'user_login' },
        order: { createdAt: 'DESC' },
        take: 100,
      })
    })

    it('should filter by resource type', async () => {
      const logs = [mockOperationLog as OperationLog]
      operationLogRepository.find.mockResolvedValue(logs)

      await service.findUserLogs('user-1', undefined, undefined, undefined, 'assistant')

      expect(operationLogRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', resourceType: 'assistant' },
        order: { createdAt: 'DESC' },
        take: 100,
      })
    })

    it('should filter by both operation type and resource type', async () => {
      const logs = [mockOperationLog as OperationLog]
      operationLogRepository.find.mockResolvedValue(logs)

      await service.findUserLogs('user-1', 20, 10, 'assistant_create', 'assistant')

      expect(operationLogRepository.find).toHaveBeenCalledWith({
        where: { 
          userId: 'user-1', 
          operationType: 'assistant_create',
          resourceType: 'assistant'
        },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 10,
      })
    })
  })

  describe('findSystemLogs', () => {
    it('should return system operation logs', async () => {
      const logs = [mockOperationLog as OperationLog]
      operationLogRepository.find.mockResolvedValue(logs)

      const result = await service.findSystemLogs()

      expect(operationLogRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 100,
      })
      expect(result).toEqual(logs)
    })

    it('should support custom limit and offset', async () => {
      const logs = [mockOperationLog as OperationLog]
      operationLogRepository.find.mockResolvedValue(logs)

      await service.findSystemLogs(50, 20)

      expect(operationLogRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 20,
      })
    })

    it('should filter by operation type', async () => {
      const logs = [mockOperationLog as OperationLog]
      operationLogRepository.find.mockResolvedValue(logs)

      await service.findSystemLogs(undefined, undefined, 'system_backup')

      expect(operationLogRepository.find).toHaveBeenCalledWith({
        where: { operationType: 'system_backup' },
        order: { createdAt: 'DESC' },
        take: 100,
      })
    })

    it('should filter by resource type', async () => {
      const logs = [mockOperationLog as OperationLog]
      operationLogRepository.find.mockResolvedValue(logs)

      await service.findSystemLogs(undefined, undefined, undefined, 'system')

      expect(operationLogRepository.find).toHaveBeenCalledWith({
        where: { resourceType: 'system' },
        order: { createdAt: 'DESC' },
        take: 100,
      })
    })
  })

  describe('getLogStats', () => {
    it('should return log statistics', async () => {
      const mockStats = [
        { operationType: 'user_login', count: '5' },
        { operationType: 'assistant_create', count: '3' },
        { operationType: 'repository_sync', count: '2' },
      ]
      operationLogRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStats),
      } as any)

      const result = await service.getLogStats('user-1')

      expect(result).toEqual({
        total: 10,
        byOperationType: {
          user_login: 5,
          assistant_create: 3,
          repository_sync: 2,
        },
      })
    })

    it('should get system-wide stats when no user specified', async () => {
      const mockStats = [
        { operationType: 'system_backup', count: '2' },
      ]
      operationLogRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStats),
      } as any)

      const result = await service.getLogStats()

      expect(result).toEqual({
        total: 2,
        byOperationType: {
          system_backup: 2,
        },
      })
    })

    it('should filter stats by date range', async () => {
      const mockStats = [
        { operationType: 'user_login', count: '3' },
      ]
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')
      
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStats),
      }
      operationLogRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any)

      const result = await service.getLogStats('user-1', startDate, endDate)

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'log.createdAt >= :startDate AND log.createdAt <= :endDate',
        { startDate, endDate }
      )
      expect(result.total).toBe(3)
    })
  })

  describe('cleanupOldLogs', () => {
    it('should delete old logs successfully', async () => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 90)
      
      operationLogRepository.delete.mockResolvedValue({ affected: 100, raw: {} })

      const result = await service.cleanupOldLogs(90)

      expect(operationLogRepository.delete).toHaveBeenCalledWith({
        createdAt: expect.objectContaining({
          _type: 'lessThan',
          _value: expect.any(Date)
        })
      })
      expect(result).toBe(100)
    })

    it('should handle cleanup with custom retention days', async () => {
      operationLogRepository.delete.mockResolvedValue({ affected: 50, raw: {} })

      const result = await service.cleanupOldLogs(30)

      expect(result).toBe(50)
    })

    it('should handle cleanup when no logs are deleted', async () => {
      operationLogRepository.delete.mockResolvedValue({ affected: 0, raw: {} })

      const result = await service.cleanupOldLogs(365)

      expect(result).toBe(0)
    })
  })
})