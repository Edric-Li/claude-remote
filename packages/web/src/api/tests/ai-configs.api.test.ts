import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { aiConfigsApi } from '../ai-configs.api'
import type { UserAiConfig, CreateAiConfigDto, ToolType } from '../../types/api.types'

// Mock HttpClient
vi.mock('../../utils/httpClient', () => ({
  HttpClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

describe('AiConfigsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const mockAiConfig: UserAiConfig = {
    id: '1',
    userId: 'user-1',
    name: 'Test Claude Config',
    toolType: 'claude',
    configData: {
      apiKey: 'test-api-key',
      model: 'claude-3-sonnet',
      maxTokens: 4096
    },
    isDefault: false,
    description: 'Test configuration for Claude',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }

  describe('create', () => {
    it('should create AI configuration', async () => {
      const createDto: CreateAiConfigDto = {
        name: 'New Claude Config',
        toolType: 'claude',
        configData: {
          apiKey: 'new-api-key',
          model: 'claude-3-haiku'
        },
        description: 'New configuration'
      }

      const mockResponse = new Response(JSON.stringify(mockAiConfig), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await aiConfigsApi.create(createDto)

      expect(HttpClient.post).toHaveBeenCalledWith('/api/ai-configs', createDto)
      expect(result).toEqual(mockAiConfig)
    })
  })

  describe('findByToolType', () => {
    it('should return configs filtered by tool type', async () => {
      const toolType: ToolType = 'claude'
      const mockConfigs = [mockAiConfig]

      const mockResponse = new Response(JSON.stringify(mockConfigs), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.get).mockResolvedValue(mockResponse)

      const result = await aiConfigsApi.findByToolType(toolType)

      expect(HttpClient.get).toHaveBeenCalledWith('/api/ai-configs?toolType=claude')
      expect(result).toEqual(mockConfigs)
    })

    it('should return all configs when no tool type specified', async () => {
      const mockConfigs = [mockAiConfig]

      const mockResponse = new Response(JSON.stringify(mockConfigs), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.get).mockResolvedValue(mockResponse)

      const result = await aiConfigsApi.findByToolType()

      expect(HttpClient.get).toHaveBeenCalledWith('/api/ai-configs')
      expect(result).toEqual(mockConfigs)
    })
  })

  describe('getDefaultConfig', () => {
    it('should return default config for tool type', async () => {
      const toolType: ToolType = 'claude'
      const defaultConfig = { ...mockAiConfig, isDefault: true }

      const mockResponse = new Response(JSON.stringify(defaultConfig), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.get).mockResolvedValue(mockResponse)

      const result = await aiConfigsApi.getDefaultConfig(toolType)

      expect(HttpClient.get).toHaveBeenCalledWith('/api/ai-configs/default/claude')
      expect(result).toEqual(defaultConfig)
    })
  })

  describe('setAsDefault', () => {
    it('should set config as default', async () => {
      const configId = '1'
      const defaultConfig = { ...mockAiConfig, isDefault: true }

      const mockResponse = new Response(JSON.stringify(defaultConfig), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await aiConfigsApi.setAsDefault(configId)

      expect(HttpClient.post).toHaveBeenCalledWith('/api/ai-configs/1/set-default', undefined)
      expect(result).toEqual(defaultConfig)
    })
  })

  describe('testConnection', () => {
    it('should test config connection successfully', async () => {
      const configId = '1'
      const testResult = { success: true, message: '连接测试成功' }

      const mockResponse = new Response(JSON.stringify(testResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await aiConfigsApi.testConnection(configId)

      expect(HttpClient.post).toHaveBeenCalledWith('/api/ai-configs/1/test', undefined)
      expect(result).toEqual(testResult)
    })

    it('should handle connection test failure', async () => {
      const configId = '1'
      const testResult = { success: false, message: 'API密钥无效' }

      const mockResponse = new Response(JSON.stringify(testResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await aiConfigsApi.testConnection(configId)

      expect(result).toEqual(testResult)
    })
  })

  describe('cloneConfig', () => {
    it('should clone config with new name', async () => {
      const configId = '1'
      const newName = 'Cloned Config'
      const clonedConfig = { ...mockAiConfig, id: '2', name: newName }

      const mockResponse = new Response(JSON.stringify(clonedConfig), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await aiConfigsApi.cloneConfig(configId, newName)

      expect(HttpClient.post).toHaveBeenCalledWith('/api/ai-configs/1/clone', { name: newName })
      expect(result).toEqual(clonedConfig)
    })
  })

  describe('validateConfig', () => {
    it('should validate config data', async () => {
      const toolType: ToolType = 'claude'
      const configData = { apiKey: 'test-key', model: 'claude-3-sonnet' }
      const validationResult = { valid: true }

      const mockResponse = new Response(JSON.stringify(validationResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await aiConfigsApi.validateConfig(toolType, configData)

      expect(HttpClient.post).toHaveBeenCalledWith('/api/ai-configs/validate', { toolType, configData })
      expect(result).toEqual(validationResult)
    })

    it('should return validation errors', async () => {
      const toolType: ToolType = 'claude'
      const configData = { model: 'claude-3-sonnet' } // Missing apiKey
      const validationResult = { valid: false, errors: ['API key is required'] }

      const mockResponse = new Response(JSON.stringify(validationResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.post).mockResolvedValue(mockResponse)

      const result = await aiConfigsApi.validateConfig(toolType, configData)

      expect(result).toEqual(validationResult)
    })
  })

  describe('getConfigTemplate', () => {
    it('should return config template for tool type', async () => {
      const toolType: ToolType = 'claude'
      const template = {
        schema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', required: true },
            model: { type: 'string', enum: ['claude-3-sonnet', 'claude-3-haiku'] }
          }
        },
        example: {
          apiKey: 'your-api-key',
          model: 'claude-3-sonnet'
        },
        description: 'Configuration template for Claude API'
      }

      const mockResponse = new Response(JSON.stringify(template), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })

      const { HttpClient } = await import('../../utils/httpClient')
      vi.mocked(HttpClient.get).mockResolvedValue(mockResponse)

      const result = await aiConfigsApi.getConfigTemplate(toolType)

      expect(HttpClient.get).toHaveBeenCalledWith('/api/ai-configs/template/claude')
      expect(result).toEqual(template)
    })
  })
})