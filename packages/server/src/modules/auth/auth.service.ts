import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UserService } from './user.service'
import { User } from '../../entities/user.entity'

export interface LoginDto {
  username: string  // 可以是用户名或邮箱
  password: string
}

export interface RegisterDto {
  username: string
  email: string
  password: string
  nickname?: string
}

export interface JwtPayload {
  sub: string      // user id
  username: string
  email: string
}

export interface AuthResponse {
  user: Partial<User>
  accessToken: string
  refreshToken?: string
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService
  ) {}

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto, ip?: string): Promise<AuthResponse> {
    const user = await this.userService.validateUser(
      loginDto.username,
      loginDto.password
    )

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误')
    }

    if (!user.isActive) {
      throw new UnauthorizedException('账户已被禁用')
    }

    // 更新最后登录信息
    if (ip) {
      await this.userService.updateLastLogin(user.id, ip)
    }

    // 生成 JWT
    const tokens = await this.generateTokens(user)

    return {
      user: this.sanitizeUser(user),
      ...tokens
    }
  }

  /**
   * 用户注册
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    // 创建用户
    const user = await this.userService.createUser(registerDto)

    // 生成 JWT
    const tokens = await this.generateTokens(user)

    return {
      user: this.sanitizeUser(user),
      ...tokens
    }
  }

  /**
   * 刷新 Token
   */
  async refreshToken(userId: string): Promise<AuthResponse> {
    const user = await this.userService.findById(userId)

    if (!user || !user.isActive) {
      throw new UnauthorizedException('无效的用户')
    }

    const tokens = await this.generateTokens(user)

    return {
      user: this.sanitizeUser(user),
      ...tokens
    }
  }

  /**
   * 验证 JWT
   */
  async validateJwt(payload: JwtPayload): Promise<User | null> {
    return this.userService.findById(payload.sub)
  }

  /**
   * 生成 JWT Token
   */
  private async generateTokens(user: User): Promise<{
    accessToken: string
    refreshToken: string
  }> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email
    }

    // Access Token - 短期有效
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1h'
    })

    // Refresh Token - 长期有效
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '30d'
    })

    return {
      accessToken,
      refreshToken
    }
  }

  /**
   * 清理用户敏感信息
   */
  private sanitizeUser(user: User): Partial<User> {
    const { password, ...sanitized } = user as any
    return sanitized
  }

  /**
   * 登出（可选实现）
   */
  async logout(userId: string): Promise<void> {
    // 如果需要，可以在这里实现 token 黑名单
    // 或者清理服务端 session
    // 目前使用无状态 JWT，客户端删除 token 即可
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(userId: string): Promise<Partial<User>> {
    const user = await this.userService.findById(userId)
    
    if (!user) {
      throw new UnauthorizedException('用户不存在')
    }

    return this.sanitizeUser(user)
  }

  /**
   * 修改密码
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.userService.findById(userId)
    
    if (!user) {
      throw new UnauthorizedException('用户不存在')
    }

    // 验证旧密码
    const isValid = await user.validatePassword(oldPassword)
    
    if (!isValid) {
      throw new UnauthorizedException('原密码错误')
    }

    // 更新密码
    await this.userService.update(userId, { password: newPassword })
  }
}