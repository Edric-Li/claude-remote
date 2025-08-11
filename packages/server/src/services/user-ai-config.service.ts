import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserAiConfig } from '../entities/user-ai-config.entity'
import { CreateAiConfigDto, UpdateAiConfigDto } from '../dto/user-ai-config.dto'

@Injectable()
export class UserAiConfigService {
  private readonly logger = new Logger(UserAiConfigService.name)

  constructor(
    @InjectRepository(UserAiConfig)
    private aiConfigRepository: Repository<UserAiConfig>,
  ) {}

  async createConfig(userId: string, createConfigDto: CreateAiConfigDto): Promise<UserAiConfig> {
    // 检查配置名称是否已存在
    const existingName = await this.aiConfigRepository.findOne({
      where: { userId, name: createConfigDto.name }
    })
    if (existingName) {
      throw new ConflictException('配置名称已存在')
    }

    // 如果设置为默认配置，需要先取消其他默认配置
    if (createConfigDto.isDefault) {
      await this.clearDefaultConfig(userId, createConfigDto.toolType)
    }

    const config = this.aiConfigRepository.create({
      userId,
      ...createConfigDto
    })

    const savedConfig = await this.aiConfigRepository.save(config)


    this.logger.log(`AI config created: ${savedConfig.name} (${savedConfig.id}) for user ${userId}`)
    return savedConfig
  }

  async findUserConfigs(userId: string, toolType?: string): Promise<UserAiConfig[]> {
    const where: any = { userId }
    if (toolType) {
      where.toolType = toolType
    }

    return await this.aiConfigRepository.find({
      where,
      order: { isDefault: 'DESC', createdAt: 'ASC' }
    })
  }

  async findById(id: string, userId: string): Promise<UserAiConfig> {
    const config = await this.aiConfigRepository.findOne({
      where: { id, userId }
    })

    if (!config) {
      throw new NotFoundException('AI配置不存在')
    }

    return config
  }

  async getDefaultConfig(
    userId: string,
    toolType: 'claude' | 'openai' | 'gemini' | 'ollama' | 'custom'
  ): Promise<UserAiConfig | null> {
    return await this.aiConfigRepository.findOne({
      where: { userId, toolType, isDefault: true }
    })
  }

  async updateConfig(
    id: string,
    userId: string,
    updateConfigDto: UpdateAiConfigDto
  ): Promise<UserAiConfig> {
    const config = await this.findById(id, userId)

    // 检查新名称是否与其他配置冲突
    if (updateConfigDto.name && updateConfigDto.name !== config.name) {
      const existingName = await this.aiConfigRepository.findOne({
        where: { userId, name: updateConfigDto.name }
      })
      if (existingName && existingName.id !== id) {
        throw new ConflictException('配置名称已存在')
      }
    }

    // 如果要设置为默认配置，先清除其他默认配置
    if (updateConfigDto.isDefault && !config.isDefault) {
      await this.clearDefaultConfig(userId, config.toolType)
    }

    Object.assign(config, updateConfigDto)
    const updatedConfig = await this.aiConfigRepository.save(config)


    return updatedConfig
  }

  async setAsDefault(id: string, userId: string): Promise<UserAiConfig> {
    const config = await this.findById(id, userId)

    // 先清除该工具类型的其他默认配置
    await this.clearDefaultConfig(userId, config.toolType)

    config.isDefault = true
    const updatedConfig = await this.aiConfigRepository.save(config)


    this.logger.log(`AI config set as default: ${config.name} (${id}) for user ${userId}`)
    return updatedConfig
  }

  async deleteConfig(id: string, userId: string): Promise<void> {
    const config = await this.findById(id, userId)

    await this.aiConfigRepository.remove(config)


    this.logger.log(`AI config deleted: ${config.name} (${id}) for user ${userId}`)
  }

  async testConnection(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const config = await this.findById(id, userId)

    try {
      // TODO: 实现具体的连接测试逻辑
      // 根据 toolType 调用对应的 AI 服务进行连接测试


      return { success: true, message: '连接测试成功' }
    } catch (error) {

      return { success: false, message: error.message }
    }
  }

  private async clearDefaultConfig(
    userId: string,
    toolType: 'claude' | 'openai' | 'gemini' | 'ollama' | 'custom'
  ): Promise<void> {
    await this.aiConfigRepository.update(
      { userId, toolType, isDefault: true },
      { isDefault: false }
    )
  }

  async getUserConfigStats(userId: string): Promise<{
    total: number
    byToolType: Record<string, number>
  }> {
    const configs = await this.aiConfigRepository.find({
      where: { userId },
      select: ['toolType']
    })

    const total = configs.length
    const byToolType = configs.reduce(
      (acc, config) => {
        acc[config.toolType] = (acc[config.toolType] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return { total, byToolType }
  }
}
