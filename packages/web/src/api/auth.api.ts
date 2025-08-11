import { BaseApi } from './base.api'
import type {
  LoginDto,
  RegisterDto,
  AuthResponse,
  ChangePasswordDto,
  User
} from '../types/api.types'

/**
 * 认证API服务
 */
export class AuthApi extends BaseApi {
  constructor() {
    super('/api/auth')
  }

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    return this.post<AuthResponse>('/login', loginDto)
  }

  /**
   * 用户注册
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    return this.post<AuthResponse>('/register', registerDto)
  }

  /**
   * 刷新Token
   */
  async refreshToken(): Promise<AuthResponse> {
    return this.post<AuthResponse>('/refresh')
  }

  /**
   * 用户登出
   */
  async logout(): Promise<{ message: string }> {
    return this.post<{ message: string }>('/logout')
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<User> {
    return this.get<User>('/me')
  }

  /**
   * 修改密码
   */
  async changePassword(changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
    return this.put<{ message: string }>('/change-password', changePasswordDto)
  }

  /**
   * 验证邮箱格式
   */
  async validateEmail(email: string): Promise<{ valid: boolean; message?: string }> {
    return this.post<{ valid: boolean; message?: string }>('/validate-email', { email })
  }

  /**
   * 检查用户名是否可用
   */
  async checkUsername(username: string): Promise<{ available: boolean; message?: string }> {
    return this.post<{ available: boolean; message?: string }>('/check-username', { username })
  }

  /**
   * 获取API密钥 (已迁移提示)
   */
  async getApiKeys(): Promise<{ message: string; apiKeys: Record<string, any> }> {
    return this.get<{ message: string; apiKeys: Record<string, any> }>('/api-keys')
  }

  /**
   * 更新API密钥 (已迁移提示)
   */
  async updateApiKeys(apiKeys: Record<string, any>): Promise<{ message: string }> {
    return this.put<{ message: string }>('/api-keys', apiKeys)
  }
}

// 导出单例实例
export const authApi = new AuthApi()