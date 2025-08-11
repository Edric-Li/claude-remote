import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  UseGuards, 
  Request,
  HttpCode,
  HttpStatus,
  Put,
  BadRequestException
} from '@nestjs/common'
import { AuthService, LoginDto, RegisterDto } from './auth.service'
import { UserService, UpdateUserDto } from './user.service'
import { LocalAuthGuard } from './guards/local-auth.guard'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { Public } from './decorators/public.decorator'
import { CurrentUser } from './decorators/current-user.decorator'

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService
  ) {}

  /**
   * 用户注册
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    // 验证输入
    if (!registerDto.username || registerDto.username.length < 3) {
      throw new BadRequestException('用户名至少3个字符')
    }
    
    if (!registerDto.email || !this.isValidEmail(registerDto.email)) {
      throw new BadRequestException('请输入有效的邮箱地址')
    }
    
    if (!registerDto.password || registerDto.password.length < 6) {
      throw new BadRequestException('密码至少6个字符')
    }

    return this.authService.register(registerDto)
  }

  /**
   * 用户登录
   */
  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req, @Body() loginDto: LoginDto) {
    // LocalAuthGuard 已经验证了用户
    // req.user 包含验证后的用户信息
    const ip = req.ip || req.connection.remoteAddress
    return this.authService.login(loginDto, ip)
  }

  /**
   * 刷新 Token
   */
  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@CurrentUser() user) {
    return this.authService.refreshToken(user.id)
  }

  /**
   * 登出
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user) {
    await this.authService.logout(user.id)
    return { message: '登出成功' }
  }

  /**
   * 获取当前用户信息
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user) {
    return this.authService.getCurrentUser(user.id)
  }

  /**
   * 更新用户信息
   */
  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(
    @CurrentUser() user,
    @Body() updateDto: UpdateUserDto
  ) {
    return this.userService.updateUser(user.id, updateDto)
  }

  /**
   * 修改密码
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user,
    @Body() body: { oldPassword: string; newPassword: string }
  ) {
    if (!body.newPassword || body.newPassword.length < 6) {
      throw new BadRequestException('新密码至少6个字符')
    }

    await this.authService.changePassword(
      user.id,
      body.oldPassword,
      body.newPassword
    )
    
    return { message: '密码修改成功' }
  }

  /**
   * 更新 API 密钥 (已迁移到AI配置系统)
   */
  @UseGuards(JwtAuthGuard)
  @Put('api-keys')
  async updateApiKeys(
    @CurrentUser() user,
    @Body() apiKeys: any
  ) {
    // TODO: 重定向到新的AI配置API
    return { message: 'API密钥功能已迁移到AI配置系统，请使用新的API端点' }
  }

  /**
   * 获取 API 密钥 (已迁移到AI配置系统)
   */
  @UseGuards(JwtAuthGuard)
  @Get('api-keys')
  async getApiKeys(@CurrentUser() user) {
    // TODO: 重定向到新的AI配置API
    return { message: 'API密钥功能已迁移到AI配置系统，请使用新的API端点', apiKeys: {} }
  }

  /**
   * 验证邮箱格式
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}