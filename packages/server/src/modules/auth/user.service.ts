import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../../entities/user.entity'
import * as crypto from 'crypto'

export interface CreateUserDto {
  username: string
  email: string
  password: string
  nickname?: string
}

export interface UpdateUserDto {
  nickname?: string
  avatar?: string
  preferences?: any
  apiKeys?: any
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>
  ) {}

  /**
   * 创建用户
   */
  async createUser(data: CreateUserDto): Promise<User> {
    // 检查用户名是否存在
    const existingUsername = await this.userRepository.findOne({
      where: { username: data.username }
    })
    
    if (existingUsername) {
      throw new ConflictException('用户名已存在')
    }

    // 检查邮箱是否存在
    const existingEmail = await this.userRepository.findOne({
      where: { email: data.email }
    })
    
    if (existingEmail) {
      throw new ConflictException('邮箱已被注册')
    }

    // 创建新用户
    const user = this.userRepository.create({
      ...data,
      nickname: data.nickname || data.username,
      avatar: this.generateAvatar(data.email),
      usage: {
        totalTasks: 0,
        totalTokens: 0
      }
    })

    return this.userRepository.save(user)
  }

  /**
   * 根据用户名查找用户
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },
      select: ['id', 'username', 'email', 'password', 'nickname', 'avatar', 'isActive']
    })
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      select: ['id', 'username', 'email', 'password', 'nickname', 'avatar', 'isActive']
    })
  }

  /**
   * 根据 ID 查找用户
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id }
    })
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    const user = await this.findById(id)
    
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 如果更新 API 密钥，需要加密
    if (data.apiKeys) {
      data.apiKeys = this.encryptApiKeys(data.apiKeys)
    }

    await this.userRepository.update(id, data)
    
    return this.findById(id)
  }

  /**
   * 通用更新方法（用于内部更新，如密码修改）
   */
  async update(id: string, data: Partial<User>): Promise<void> {
    // 如果是密码字段，会触发 User 实体的 @BeforeUpdate 钩子自动加密
    await this.userRepository.save({ id, ...data })
  }

  /**
   * 更新最后登录信息
   */
  async updateLastLogin(id: string, ip: string): Promise<void> {
    await this.userRepository.update(id, {
      lastLoginAt: new Date(),
      lastLoginIp: ip
    })
  }

  /**
   * 更新使用统计
   */
  async updateUsageStats(id: string, tokens: number): Promise<void> {
    const user = await this.findById(id)
    
    if (!user) return

    const usage = user.usage || { totalTasks: 0, totalTokens: 0 }
    
    await this.userRepository.update(id, {
      usage: {
        totalTasks: (usage.totalTasks || 0) + 1,
        totalTokens: (usage.totalTokens || 0) + tokens,
        lastTaskAt: new Date()
      }
    })
  }

  /**
   * 验证用户密码
   */
  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.findByUsername(username)
    
    if (!user) {
      // 也尝试用邮箱登录
      const userByEmail = await this.findByEmail(username)
      if (userByEmail && await userByEmail.validatePassword(password)) {
        return userByEmail
      }
      return null
    }

    if (await user.validatePassword(password)) {
      return user
    }

    return null
  }

  /**
   * 获取用户的 API 密钥（解密）
   */
  async getUserApiKeys(id: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['apiKeys']
    })
    
    if (!user || !user.apiKeys) {
      return {}
    }

    return this.decryptApiKeys(user.apiKeys)
  }

  /**
   * 生成头像
   */
  private generateAvatar(email: string): string {
    const hash = crypto
      .createHash('md5')
      .update(email.toLowerCase())
      .digest('hex')
    
    // 使用 Gravatar 或默认头像服务
    return `https://www.gravatar.com/avatar/${hash}?d=identicon`
  }

  /**
   * 加密 API 密钥
   */
  private encryptApiKeys(apiKeys: any): any {
    const algorithm = 'aes-256-cbc'
    const key = Buffer.from(
      process.env.ENCRYPTION_KEY || 'default-encryption-key-change-it!',
      'utf8'
    ).slice(0, 32)
    const iv = crypto.randomBytes(16)

    const encrypted: any = {}
    
    for (const [provider, apiKey] of Object.entries(apiKeys)) {
      if (apiKey && typeof apiKey === 'string') {
        const cipher = crypto.createCipheriv(algorithm, key, iv)
        let encryptedKey = cipher.update(apiKey, 'utf8', 'hex')
        encryptedKey += cipher.final('hex')
        
        encrypted[provider] = {
          data: encryptedKey,
          iv: iv.toString('hex')
        }
      }
    }
    
    return encrypted
  }

  /**
   * 解密 API 密钥
   */
  private decryptApiKeys(encryptedKeys: any): any {
    const algorithm = 'aes-256-cbc'
    const key = Buffer.from(
      process.env.ENCRYPTION_KEY || 'default-encryption-key-change-it!',
      'utf8'
    ).slice(0, 32)

    const decrypted: any = {}
    
    for (const [provider, encryptedData] of Object.entries(encryptedKeys)) {
      if (encryptedData && typeof encryptedData === 'object') {
        const { data, iv } = encryptedData as any
        const decipher = crypto.createDecipheriv(
          algorithm,
          key,
          Buffer.from(iv, 'hex')
        )
        
        let decryptedKey = decipher.update(data, 'hex', 'utf8')
        decryptedKey += decipher.final('utf8')
        
        decrypted[provider] = decryptedKey
      }
    }
    
    return decrypted
  }

  /**
   * 获取所有用户（管理功能）
   */
  async getAllUsers(): Promise<User[]> {
    return this.userRepository.find({
      order: { createdAt: 'DESC' }
    })
  }

  /**
   * 禁用/启用用户
   */
  async toggleUserStatus(id: string): Promise<User> {
    const user = await this.findById(id)
    
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    await this.userRepository.update(id, {
      isActive: !user.isActive
    })
    
    return this.findById(id)
  }
}