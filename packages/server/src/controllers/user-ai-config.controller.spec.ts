import { Test, TestingModule } from '@nestjs/testing'
import { UserAiConfigController } from './user-ai-config.controller'
import { UserAiConfigService } from '../services/user-ai-config.service'
import { mockAiConfig, mockUser } from '../test/test-utils'
import { CreateAiConfigDto, UpdateAiConfigDto } from '../dto/user-ai-config.dto'
import { UserAiConfig } from '../entities/user-ai-config.entity'
import { User } from '../entities/user.entity'

describe('UserAiConfigController', () => {
  let controller: UserAiConfigController
  let aiConfigService: jest.Mocked<UserAiConfigService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserAiConfigController],
      providers: [
        {
          provide: UserAiConfigService,
          useValue: {
            createConfig: jest.fn(),
            findUserConfigs: jest.fn(),
            getUserConfigStats: jest.fn(),
            getDefaultConfig: jest.fn(),
            findById: jest.fn(),
            updateConfig: jest.fn(),
            setAsDefault: jest.fn(),
            testConnection: jest.fn(),
            deleteConfig: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<UserAiConfigController>(UserAiConfigController)
    aiConfigService = module.get(UserAiConfigService)
  })

  describe('createConfig', () => {
    it('should create AI config', async () => {
      const createConfigDto: CreateAiConfigDto = {
        name: 'Test Config',
        toolType: 'claude',
        configData: {
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          api_key: 'test_key',
        },
      }
      aiConfigService.createConfig.mockResolvedValue(mockAiConfig as UserAiConfig)

      const result = await controller.createConfig(mockUser as User, createConfigDto)

      expect(aiConfigService.createConfig).toHaveBeenCalledWith(mockUser.id, createConfigDto)
      expect(result).toEqual(mockAiConfig)
    })
  })

  describe('findUserConfigs', () => {
    it('should return user configs', async () => {
      const configs = [mockAiConfig as UserAiConfig]
      aiConfigService.findUserConfigs.mockResolvedValue(configs)

      const result = await controller.findUserConfigs(mockUser as User)

      expect(aiConfigService.findUserConfigs).toHaveBeenCalledWith(mockUser.id, undefined)
      expect(result).toEqual(configs)
    })

    it('should filter by tool type', async () => {
      const configs = [mockAiConfig as UserAiConfig]
      aiConfigService.findUserConfigs.mockResolvedValue(configs)

      await controller.findUserConfigs(mockUser as User, 'claude')

      expect(aiConfigService.findUserConfigs).toHaveBeenCalledWith(mockUser.id, 'claude')
    })
  })

  describe('getUserConfigStats', () => {
    it('should return user config stats', async () => {
      const mockStats = { total: 5, byToolType: { claude: 2, openai: 3 } }
      aiConfigService.getUserConfigStats.mockResolvedValue(mockStats)

      const result = await controller.getUserConfigStats(mockUser as User)

      expect(aiConfigService.getUserConfigStats).toHaveBeenCalledWith(mockUser.id)
      expect(result).toEqual(mockStats)
    })
  })

  describe('getDefaultConfig', () => {
    it('should return default config for tool type', async () => {
      aiConfigService.getDefaultConfig.mockResolvedValue(mockAiConfig as UserAiConfig)

      const result = await controller.getDefaultConfig(mockUser as User, 'claude')

      expect(aiConfigService.getDefaultConfig).toHaveBeenCalledWith(mockUser.id, 'claude')
      expect(result).toEqual(mockAiConfig)
    })
  })

  describe('findById', () => {
    it('should return config by id', async () => {
      aiConfigService.findById.mockResolvedValue(mockAiConfig as UserAiConfig)

      const result = await controller.findById(mockUser as User, 'config-1')

      expect(aiConfigService.findById).toHaveBeenCalledWith('config-1', mockUser.id)
      expect(result).toEqual(mockAiConfig)
    })
  })

  describe('updateConfig', () => {
    it('should update config', async () => {
      const updateConfigDto: UpdateAiConfigDto = { name: 'Updated Config' }
      const updatedConfig = { ...mockAiConfig, name: 'Updated Config' }
      aiConfigService.updateConfig.mockResolvedValue(updatedConfig as UserAiConfig)

      const result = await controller.updateConfig(mockUser as User, 'config-1', updateConfigDto)

      expect(aiConfigService.updateConfig).toHaveBeenCalledWith('config-1', mockUser.id, updateConfigDto)
      expect(result).toEqual(updatedConfig)
    })
  })

  describe('setAsDefault', () => {
    it('should set config as default', async () => {
      const defaultConfig = { ...mockAiConfig, isDefault: true }
      aiConfigService.setAsDefault.mockResolvedValue(defaultConfig as UserAiConfig)

      const result = await controller.setAsDefault(mockUser as User, 'config-1')

      expect(aiConfigService.setAsDefault).toHaveBeenCalledWith('config-1', mockUser.id)
      expect(result).toEqual(defaultConfig)
    })
  })

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockResult = { success: true, message: '连接测试成功' }
      aiConfigService.testConnection.mockResolvedValue(mockResult)

      const result = await controller.testConnection(mockUser as User, 'config-1')

      expect(aiConfigService.testConnection).toHaveBeenCalledWith('config-1', mockUser.id)
      expect(result).toEqual(mockResult)
    })

    it('should handle connection failure', async () => {
      const mockResult = { success: false, message: 'Connection failed' }
      aiConfigService.testConnection.mockResolvedValue(mockResult)

      const result = await controller.testConnection(mockUser as User, 'config-1')

      expect(result).toEqual(mockResult)
    })
  })

  describe('deleteConfig', () => {
    it('should delete config', async () => {
      aiConfigService.deleteConfig.mockResolvedValue(undefined)

      await controller.deleteConfig(mockUser as User, 'config-1')

      expect(aiConfigService.deleteConfig).toHaveBeenCalledWith('config-1', mockUser.id)
    })
  })
})