import { Injectable, ExecutionContext } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    // 检查是否是公开路由
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ])

    // 检查是否跳过认证（用于SSE等特殊端点）
    const skipAuth = this.reflector.getAllAndOverride<boolean>('skipAuth', [
      context.getHandler(),
      context.getClass()
    ])

    if (isPublic || skipAuth) {
      return true
    }

    // 在开发环境下支持测试token
    if (process.env.NODE_ENV !== 'production') {
      const request = context.switchToHttp().getRequest()
      const authHeader = request.headers.authorization
      
      if (authHeader) {
        const [type, token] = authHeader.split(' ')
        if (type === 'Bearer' && token === 'test-token-for-development') {
          console.log('JwtAuthGuard - Test token detected, allowing access')
          // 设置测试用户信息
          request.user = {
            id: 'test-user',
            username: 'test-user',
            email: 'test@example.com'
          }
          return true
        }
      }
    }

    return super.canActivate(context)
  }
}
