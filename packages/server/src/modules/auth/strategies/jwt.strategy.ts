import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { AuthService, JwtPayload } from '../auth.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'ai-orchestra-secret-key-change-in-production'
    })
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.validateJwt(payload)
    
    if (!user) {
      return null
    }

    // 返回的数据会被注入到 request.user
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName
    }
  }
}