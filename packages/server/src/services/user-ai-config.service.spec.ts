import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { UserAiConfigService } from './user-ai-config.service'
import { OperationLogService } from './operation-log.service'
import { UserAiConfig } from '../entities/user-ai-config.entity'
import { mockAiConfig, createMockRepository } from '../test/test-utils'
import { CreateAiConfigDto, UpdateAiConfigDto } from '../dto/user-ai-config.dto'

describe('UserAiConfigService', () => {
  let service: UserAiConfigService
  let aiConfigRepository: jest.Mocked<Repository<UserAiConfig>>
  let operationLogService: jest.Mocked<OperationLogService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAiConfigService,
        {
          provide: getRepositoryToken(UserAiConfig),
          useValue: createMockRepository(),
        },
        {
          provide: OperationLogService,
          useValue: {
            createLog: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile()

    service = module.get<UserAiConfigService>(UserAiConfigService)
    aiConfigRepository = module.get(getRepositoryToken(UserAiConfig))
    operationLogService = module.get(OperationLogService)
  })

  describe('createConfig', () => {
    const createConfigDto: CreateAiConfigDto = {
      name: 'Test Claude Config',
      toolType: 'claude',
      configData: {
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        api_key: 'test_key',
        base_url: 'https://api.anthropic.com',
      },
      isDefault: true,
    }

    it('should create AI config successfully', async () => {
      aiConfigRepository.findOne.mockResolvedValue(null)
      aiConfigRepository.create.mockReturnValue(mockAiConfig as UserAiConfig)
      aiConfigRepository.save.mockResolvedValue(mockAiConfig as UserAiConfig)
      aiConfigRepository.update.mockResolvedValue({ affected: 1 } as any)

      const result = await service.createConfig('user-1', createConfigDto)

      expect(aiConfigRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', name: createConfigDto.name }
      })
      expect(aiConfigRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', toolType: 'claude', isDefault: true },
        { isDefault: false }
      )
      expect(aiConfigRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        ...createConfigDto,
      })
      expect(aiConfigRepository.save).toHaveBeenCalledWith(mockAiConfig)
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result).toEqual(mockAiConfig)
    })

    it('should throw ConflictException if config name exists', async () => {
      aiConfigRepository.findOne.mockResolvedValue(mockAiConfig as UserAiConfig)

      await expect(service.createConfig('user-1', createConfigDto))
        .rejects.toThrow(ConflictException)
    })

    it('should create config without setting as default', async () => {
      const configDtoNotDefault = { ...createConfigDto, isDefault: false }
      aiConfigRepository.findOne.mockResolvedValue(null)
      aiConfigRepository.create.mockReturnValue(mockAiConfig as UserAiConfig)
      aiConfigRepository.save.mockResolvedValue(mockAiConfig as UserAiConfig)

      const result = await service.createConfig('user-1', configDtoNotDefault)

      expect(aiConfigRepository.update).not.toHaveBeenCalled()
      expect(result).toEqual(mockAiConfig)
    })
  })

  describe('findUserConfigs', () => {
    it('should return user configs', async () => {
      const configs = [mockAiConfig as UserAiConfig]
      aiConfigRepository.find.mockResolvedValue(configs)

      const result = await service.findUserConfigs('user-1')

      expect(aiConfigRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { isDefault: 'DESC', createdAt: 'ASC' }
      })
      expect(result).toEqual(configs)
    })

    it('should filter by tool type', async () => {
      const configs = [mockAiConfig as UserAiConfig]
      aiConfigRepository.find.mockResolvedValue(configs)

      await service.findUserConfigs('user-1', 'claude')

      expect(aiConfigRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', toolType: 'claude' },
        order: { isDefault: 'DESC', createdAt: 'ASC' }
      })
    })
  })

  describe('findById', () => {
    it('should return config by id', async () => {
      aiConfigRepository.findOne.mockResolvedValue(mockAiConfig as UserAiConfig)

      const result = await service.findById('config-1', 'user-1')

      expect(aiConfigRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'config-1', userId: 'user-1' }
      })
      expect(result).toEqual(mockAiConfig)
    })

    it('should throw NotFoundException if config not found', async () => {
      aiConfigRepository.findOne.mockResolvedValue(null)

      await expect(service.findById('config-1', 'user-1'))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('getDefaultConfig', () => {
    it('should return default config for tool type', async () => {
      const defaultConfig = { ...mockAiConfig, isDefault: true }
      aiConfigRepository.findOne.mockResolvedValue(defaultConfig as UserAiConfig)

      const result = await service.getDefaultConfig('user-1', 'claude')

      expect(aiConfigRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', toolType: 'claude', isDefault: true }
      })
      expect(result).toEqual(defaultConfig)
    })

    it('should return null if no default config found', async () => {
      aiConfigRepository.findOne.mockResolvedValue(null)

      const result = await service.getDefaultConfig('user-1', 'claude')

      expect(result).toBeNull()
    })
  })

  describe('updateConfig', () => {
    const updateConfigDto: UpdateAiConfigDto = {
      name: 'Updated Config',
      isDefault: true,
    }

    it('should update config successfully', async () => {
      const updatedConfig = { ...mockAiConfig, ...updateConfigDto }
      aiConfigRepository.findOne
        .mockResolvedValueOnce(mockAiConfig as UserAiConfig) // findById call
        .mockResolvedValueOnce(null) // name uniqueness check
      aiConfigRepository.save.mockResolvedValue(updatedConfig as UserAiConfig)
      aiConfigRepository.update.mockResolvedValue({ affected: 1 } as any)

      const result = await service.updateConfig('config-1', 'user-1', updateConfigDto)

      expect(aiConfigRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', toolType: mockAiConfig.toolType, isDefault: true },
        { isDefault: false }
      )
      expect(aiConfigRepository.save).toHaveBeenCalledWith({
        ...mockAiConfig,
        ...updateConfigDto
      })
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result).toEqual(updatedConfig)
    })

    it('should throw ConflictException if name is taken by another config', async () => {
      const anotherConfig = { ...mockAiConfig, id: 'config-2' }
      aiConfigRepository.findOne
        .mockResolvedValueOnce(mockAiConfig as UserAiConfig) // findById call
        .mockResolvedValueOnce(anotherConfig as UserAiConfig) // name check

      await expect(service.updateConfig('config-1', 'user-1', updateConfigDto))
        .rejects.toThrow(ConflictException)
    })

    it('should not clear default if not setting as default', async () => {
      const updateNotDefault = { ...updateConfigDto, isDefault: false }
      const currentlyDefault = { ...mockAiConfig, isDefault: true }
      aiConfigRepository.findOne
        .mockResolvedValueOnce(currentlyDefault as UserAiConfig)
        .mockResolvedValueOnce(null)
      aiConfigRepository.save.mockResolvedValue(currentlyDefault as UserAiConfig)

      await service.updateConfig('config-1', 'user-1', updateNotDefault)

      expect(aiConfigRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('setAsDefault', () => {
    it('should set config as default', async () => {
      const updatedConfig = { ...mockAiConfig, isDefault: true }
      aiConfigRepository.findOne.mockResolvedValue(mockAiConfig as UserAiConfig)
      aiConfigRepository.save.mockResolvedValue(updatedConfig as UserAiConfig)
      aiConfigRepository.update.mockResolvedValue({ affected: 1 } as any)

      const result = await service.setAsDefault('config-1', 'user-1')

      expect(aiConfigRepository.update).toHaveBeenCalledWith(
        { userId: 'user-1', toolType: mockAiConfig.toolType, isDefault: true },
        { isDefault: false }
      )
      expect(aiConfigRepository.save).toHaveBeenCalledWith({
        ...mockAiConfig,
        isDefault: true
      })
      expect(operationLogService.createLog).toHaveBeenCalled()
      expect(result).toEqual(updatedConfig)
    })
  })

  describe('deleteConfig', () => {
    it('should delete config successfully', async () => {
      aiConfigRepository.findOne.mockResolvedValue(mockAiConfig as UserAiConfig)
      aiConfigRepository.remove.mockResolvedValue(mockAiConfig as UserAiConfig)

      await service.deleteConfig('config-1', 'user-1')

      expect(aiConfigRepository.remove).toHaveBeenCalledWith(mockAiConfig)
      expect(operationLogService.createLog).toHaveBeenCalled()
    })
  })

  describe('testConnection', () => {
    it('should return success for connection test', async () => {
      aiConfigRepository.findOne.mockResolvedValue(mockAiConfig as UserAiConfig)

      const result = await service.testConnection('config-1', 'user-1')

      expect(operationLogService.createLog).toHaveBeenCalledWith({
        userId: 'user-1',
        operationType: 'ai_config_test',
        resourceType: 'ai_config',
        resourceId: 'config-1',
        operationData: { success: true, toolType: mockAiConfig.toolType }
      })
      expect(result).toEqual({ success: true, message: '连接测试成功' })
    })

    it('should handle connection test failure', async () => {
      aiConfigRepository.findOne.mockRejectedValue(new Error('Connection failed'))

      const result = await service.testConnection('config-1', 'user-1')

      expect(operationLogService.createLog).toHaveBeenCalledWith({
        userId: 'user-1',
        operationType: 'ai_config_test',
        resourceType: 'ai_config',
        resourceId: 'config-1',
        operationData: { success: false, error: 'Connection failed', toolType: undefined }
      })
      expect(result).toEqual({ success: false, message: 'Connection failed' })
    })
  })

  describe('getUserConfigStats', () => {
    it('should return user config statistics', async () => {
      const configs = [
        { toolType: 'claude' },
        { toolType: 'openai' },
        { toolType: 'claude' },
      ]
      aiConfigRepository.find.mockResolvedValue(configs as UserAiConfig[])

      const result = await service.getUserConfigStats('user-1')

      expect(aiConfigRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: ['toolType']
      })
      expect(result).toEqual({
        total: 3,
        byToolType: { claude: 2, openai: 1 }
      })
    })
  })
})