import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { SystemConfig } from '../entities/system-config.entity'
import { User } from '../entities/user.entity'

@Injectable()
export class DatabaseInitService {
  private readonly logger = new Logger(DatabaseInitService.name)

  constructor(
    @InjectRepository(SystemConfig)
    private systemConfigRepository: Repository<SystemConfig>,
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async initializeDatabase(): Promise<void> {
    this.logger.log('Initializing database...')

    try {
      // 1. 创建系统基础配置
      await this.createSystemConfigs()

      // 2. 检查是否需要创建默认用户
      await this.createDefaultUserIfNeeded()

      this.logger.log('Database initialization completed')
    } catch (error) {
      this.logger.error('Database initialization failed', error)
      throw error
    }
  }

  private async createSystemConfigs(): Promise<void> {
    const configs = [
      {
        category: 'database',
        keyName: 'max_connections',
        valueData: 100,
        description: '数据库最大连接数'
      },
      {
        category: 'security',
        keyName: 'session_timeout',
        valueData: 86400,
        description: '会话超时时间(秒)'
      },
      {
        category: 'system',
        keyName: 'max_assistants_per_user',
        valueData: 10,
        description: '每用户最大助手数量'
      },
      {
        category: 'system',
        keyName: 'max_repositories_per_user',
        valueData: 50,
        description: '每用户最大仓库数量'
      },
      {
        category: 'system',
        keyName: 'max_conversations_per_assistant',
        valueData: 100,
        description: '每助手最大对话数量'
      },
      {
        category: 'monitoring',
        keyName: 'cleanup_messages_after_days',
        valueData: 30,
        description: '多少天后清理未归档消息'
      }
    ]

    for (const configData of configs) {
      const existing = await this.systemConfigRepository.findOne({
        where: { category: configData.category, keyName: configData.keyName }
      })

      if (!existing) {
        const config = this.systemConfigRepository.create(configData)
        await this.systemConfigRepository.save(config)
        this.logger.log(`Created system config: ${configData.category}.${configData.keyName}`)
      }
    }
  }

  private async createDefaultUserIfNeeded(): Promise<void> {
    const userCount = await this.userRepository.count()

    // 如果没有用户，创建一个默认管理员用户
    if (userCount === 0) {
      const defaultUser = this.userRepository.create({
        username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
        email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@localhost',
        passwordHash: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
        displayName: 'System Administrator',
        status: 'active'
      })

      await this.userRepository.save(defaultUser)
      this.logger.log(`Created default admin user: ${defaultUser.username}`)
    }
  }

  async getSystemConfig(category: string, key: string): Promise<any> {
    const config = await this.systemConfigRepository.findOne({
      where: { category, keyName: key }
    })
    return config?.valueData
  }

  async setSystemConfig(
    category: string,
    key: string,
    value: any,
    description?: string
  ): Promise<void> {
    const existing = await this.systemConfigRepository.findOne({
      where: { category, keyName: key }
    })

    if (existing) {
      existing.valueData = value
      if (description) existing.description = description
      await this.systemConfigRepository.save(existing)
    } else {
      const config = this.systemConfigRepository.create({
        category,
        keyName: key,
        valueData: value,
        description
      })
      await this.systemConfigRepository.save(config)
    }
  }
}
