import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'
import {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
  UpdateUserStatusDto
} from '../dto/user.dto'

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name)

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createUser(createUserDto: CreateUserDto, operatorId?: string): Promise<User> {
    // 检查用户名是否已存在
    const existingUsername = await this.userRepository.findOne({
      where: { username: createUserDto.username }
    })
    if (existingUsername) {
      throw new ConflictException('用户名已存在')
    }

    // 检查邮箱是否已存在
    if (createUserDto.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: createUserDto.email }
      })
      if (existingEmail) {
        throw new ConflictException('邮箱已存在')
      }
    }

    const user = this.userRepository.create({
      username: createUserDto.username,
      email: createUserDto.email,
      passwordHash: createUserDto.password, // 会被entity的beforeInsert钩子加密
      displayName: createUserDto.displayName,
      avatarUrl: createUserDto.avatarUrl,
      status: 'active'
    })

    const savedUser = await this.userRepository.save(user)


    this.logger.log(`User created: ${savedUser.username} (${savedUser.id})`)
    return savedUser
  }

  async findAll(page = 1, limit = 20): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' }
    })

    return { users, total }
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['aiConfigs', 'repositories', 'assistants']
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return user
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { username },
      select: [
        'id',
        'username',
        'email',
        'passwordHash',
        'displayName',
        'avatarUrl',
        'status',
        'createdAt',
        'updatedAt',
        'lastLoginAt'
      ]
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    return user
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto, operatorId?: string): Promise<User> {
    const user = await this.findById(id)

    // 检查邮箱是否已被其他用户使用
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: updateUserDto.email }
      })
      if (existingEmail && existingEmail.id !== id) {
        throw new ConflictException('邮箱已被使用')
      }
    }

    Object.assign(user, updateUserDto)
    const updatedUser = await this.userRepository.save(user)


    return updatedUser
  }

  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
    operatorId?: string
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'passwordHash']
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 验证当前密码
    const isCurrentPasswordValid = await user.validatePassword(changePasswordDto.currentPassword)
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('当前密码错误')
    }

    user.passwordHash = changePasswordDto.newPassword // 会被entity的beforeUpdate钩子加密
    await this.userRepository.save(user)


    this.logger.log(`Password changed for user: ${id}`)
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateUserStatusDto,
    operatorId?: string
  ): Promise<User> {
    const user = await this.findById(id)

    user.status = updateStatusDto.status
    const updatedUser = await this.userRepository.save(user)


    this.logger.log(`User status updated: ${id} -> ${updateStatusDto.status}`)
    return updatedUser
  }

  async updateLastLogin(id: string, ipAddress?: string): Promise<void> {
    await this.userRepository.update(id, {
      lastLoginAt: new Date()
    })
  }

  async deleteUser(id: string, operatorId?: string): Promise<void> {
    const user = await this.findById(id)

    await this.userRepository.remove(user)


    this.logger.log(`User deleted: ${user.username} (${id})`)
  }

  async getUserStats(): Promise<{
    total: number
    active: number
    inactive: number
    banned: number
  }> {
    const [total, active, inactive, banned] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { status: 'active' } }),
      this.userRepository.count({ where: { status: 'inactive' } }),
      this.userRepository.count({ where: { status: 'banned' } })
    ])

    return { total, active, inactive, banned }
  }
}
