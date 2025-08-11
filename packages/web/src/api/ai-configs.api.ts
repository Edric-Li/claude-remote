import { CrudApi } from './base.api'
import type {
  UserAiConfig,
  CreateAiConfigDto,
  UpdateAiConfigDto,
  AiConfigStats,
  ToolType,
  TestConnectionResult
} from '../types/api.types'

/**
 * AI配置API服务
 */
export class AiConfigsApi extends CrudApi<
  UserAiConfig,
  CreateAiConfigDto,
  UpdateAiConfigDto,
  AiConfigStats
> {
  constructor() {
    super('/api/ai-configs')
  }

  /**
   * 根据工具类型获取配置列表
   */
  async findByToolType(toolType?: ToolType): Promise<UserAiConfig[]> {
    const params = toolType ? { toolType } : undefined
    return this.get<UserAiConfig[]>('', params)
  }

  /**
   * 获取默认配置
   */
  async getDefaultConfig(toolType: ToolType): Promise<UserAiConfig | null> {
    return this.get<UserAiConfig | null>(`/default/${toolType}`)
  }

  /**
   * 设置为默认配置
   */
  async setAsDefault(configId: string): Promise<UserAiConfig> {
    return this.post<UserAiConfig>(`/${configId}/set-default`)
  }

  /**
   * 测试配置连接
   */
  async testConnection(configId: string): Promise<TestConnectionResult> {
    return this.post<TestConnectionResult>(`/${configId}/test`)
  }

  /**
   * 克隆配置
   */
  async cloneConfig(configId: string, newName: string): Promise<UserAiConfig> {
    return this.post<UserAiConfig>(`/${configId}/clone`, { name: newName })
  }

  /**
   * 批量删除配置
   */
  async bulkDelete(configIds: string[]): Promise<{ message: string; deletedCount: number }> {
    return this.post<{ message: string; deletedCount: number }>('/bulk-delete', { configIds })
  }

  /**
   * 导入配置
   */
  async importConfig(configData: {
    name: string
    toolType: ToolType
    configData: Record<string, any>
    description?: string
  }): Promise<UserAiConfig> {
    return this.post<UserAiConfig>('/import', configData)
  }

  /**
   * 导出配置
   */
  async exportConfig(configId: string): Promise<{
    name: string
    toolType: ToolType
    configData: Record<string, any>
    description?: string
  }> {
    return this.get<{
      name: string
      toolType: ToolType
      configData: Record<string, any>
      description?: string
    }>(`/${configId}/export`)
  }

  /**
   * 验证配置数据
   */
  async validateConfig(
    toolType: ToolType,
    configData: Record<string, any>
  ): Promise<{
    valid: boolean
    errors?: string[]
  }> {
    return this.post<{
      valid: boolean
      errors?: string[]
    }>('/validate', { toolType, configData })
  }

  /**
   * 获取工具类型的配置模板
   */
  async getConfigTemplate(toolType: ToolType): Promise<{
    schema: Record<string, any>
    example: Record<string, any>
    description: string
  }> {
    return this.get<{
      schema: Record<string, any>
      example: Record<string, any>
      description: string
    }>(`/template/${toolType}`)
  }
}

// 导出单例实例
export const aiConfigsApi = new AiConfigsApi()
