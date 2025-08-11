import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { JwtService } from '@nestjs/jwt'
import { UserService } from '../user.service'

@Injectable()
export class SSEAuthGuard extends AuthGuard('jwt') {
  constructor(
    private jwtService: JwtService,
    private userService: UserService
  ) {
    super()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    // 尝试从查询参数获取token（用于SSE）
    const tokenFromQuery = request.query?.token

    if (tokenFromQuery) {
      try {
        // 验证token
        const payload = this.jwtService.verify(tokenFromQuery)

        // 获取用户信息
        const user = await this.userService.findById(payload.sub)
        if (!user) {
          throw new UnauthorizedException('用户不存在')
        }

        // 将用户信息附加到request对象
        request.user = user
        return true
      } catch (error) {
        throw new UnauthorizedException('无效的token')
      }
    }

    // 如果没有查询参数中的token，回退到标准JWT验证
    return super.canActivate(context) as Promise<boolean>
  }
}
