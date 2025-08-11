import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'

@Injectable()
export class DatabaseInitService {
  private readonly logger = new Logger(DatabaseInitService.name)

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async initializeDatabase(): Promise<void> {
    this.logger.log('Initializing database...')

    try {
      // 检查是否需要创建默认用户
      await this.createDefaultUserIfNeeded()

      this.logger.log('Database initialization completed')
    } catch (error) {
      this.logger.error('Database initialization failed', error)
      throw error
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
}