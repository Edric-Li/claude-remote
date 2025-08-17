import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

/**
 * 支持测试token的认证守卫
 * 在开发环境下允许使用 test-token-for-development
 */
@Injectable()
export class TestAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = this.extractTokenFromHeader(request)

    console.log('TestAuthGuard - Received token:', token)
    console.log('TestAuthGuard - NODE_ENV:', process.env.NODE_ENV)

    if (!token) {
      console.log('TestAuthGuard - No token found')
      throw new UnauthorizedException('Token not found')
    }

    try {
      // 检查是否是测试token
      if (token === 'test-token-for-development') {
        console.log('TestAuthGuard - Test token detected')
        // 在开发环境允许测试token
        if (process.env.NODE_ENV !== 'production') {
          console.log('TestAuthGuard - Allowing test token (not production)')
          request.user = {
            id: '80a0cc23-d7af-4806-a4a0-222c4c8368cc', // 使用真实的用户ID
            userId: '80a0cc23-d7af-4806-a4a0-222c4c8368cc', // 添加userId字段
            username: 'testuser2',
            email: 'testuser2@example.com'
          }
          return true
        } else {
          console.log('TestAuthGuard - Rejecting test token (production)')
          throw new UnauthorizedException('Test token not allowed in production')
        }
      }

      console.log('TestAuthGuard - Verifying JWT token')
      // 验证真实的JWT token
      const payload = await this.jwtService.verifyAsync(token)
      request.user = {
        id: payload.sub,
        username: payload.username,
        email: payload.email
      }
      console.log('TestAuthGuard - JWT token valid')
      return true
    } catch (error) {
      console.log('TestAuthGuard - Token validation failed:', error.message)
      throw new UnauthorizedException('Invalid token')
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : undefined
  }
}