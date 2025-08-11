import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-local'
import { UserService } from '../user.service'

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      usernameField: 'username', // 可以是用户名或邮箱
      passwordField: 'password'
    })
  }

  async validate(username: string, password: string): Promise<any> {
    try {
      console.log('🔍 LocalStrategy validating:', { username })
      const user = await this.userService.validateUser(username, password)
      console.log('🧪 User validation result:', user ? 'Found user' : 'User not found')
      
      if (!user) {
        console.log('❌ User validation failed: User not found or password incorrect')
        throw new UnauthorizedException('用户名或密码错误')
      }
      
      if (user.status !== 'active') {
        console.log('❌ User validation failed: Account not active')
        throw new UnauthorizedException('账户已被禁用')
      }
      
      console.log('✅ LocalStrategy validation successful')
      return user
    } catch (error) {
      console.error('❌ LocalStrategy error:', error)
      throw error
    }
  }
}