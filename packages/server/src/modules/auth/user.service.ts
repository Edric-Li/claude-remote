import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../../entities/user.entity'
import * as crypto from 'crypto'

export interface CreateUserDto {
  username: string
  email: string
  password: string
  displayName?: string
}

export interface UpdateUserDto {
  displayName?: string
  avatarUrl?: string
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
    if (data.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: data.email }
      })

      if (existingEmail) {
        throw new ConflictException('邮箱已被注册')
      }
    }

    // 创建新用户
    const user = this.userRepository.create({
      username: data.username,
      email: data.email,
      passwordHash: data.password, // Will be hashed by entity hooks
      displayName: data.displayName || data.username,
      avatarUrl: this.generateAvatar(data.email || data.username),
      status: 'active'
    })

    return this.userRepository.save(user)
  }

  /**
   * 根据用户名查找用户
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username },
      select: ['id', 'username', 'email', 'passwordHash', 'displayName', 'avatarUrl', 'status']
    })
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      select: ['id', 'username', 'email', 'passwordHash', 'displayName', 'avatarUrl', 'status']
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

    await this.userRepository.update(id, data)

    return this.findById(id)
  }

  /**
   * 通用更新方法（用于内部更新，如密码修改）
   */
  async update(id: string, data: { passwordHash?: string }): Promise<void> {
    await this.userRepository.update(id, data)
  }

  /**
   * 更新最后登录信息
   */
  async updateLastLogin(id: string, ip: string): Promise<void> {
    await this.userRepository.update(id, {
      lastLoginAt: new Date()
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
      if (userByEmail && (await userByEmail.validatePassword(password))) {
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
   * 生成头像
   */
  private generateAvatar(email: string): string {
    const hash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex')

    // 使用 Gravatar 或默认头像服务
    return `https://www.gravatar.com/avatar/${hash}?d=identicon`
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

    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    await this.userRepository.update(id, {
      status: newStatus
    })

    return this.findById(id)
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<void> {
    const user = await this.findById(id)

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    await this.userRepository.remove(user)
    console.log(`[UserService] User deleted: ${user.username} (${user.id})`)
  }
}
