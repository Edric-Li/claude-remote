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
    const user = await this.userService.validateUser(username, password)
    
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误')
    }
    
    if (!user.isActive) {
      throw new UnauthorizedException('账户已被禁用')
    }
    
    return user
  }
}