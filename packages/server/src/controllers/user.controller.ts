import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ParseUUIDPipe,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus
} from '@nestjs/common'
import { Request } from 'express'
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard'
import { CurrentUser } from '../modules/auth/decorators/current-user.decorator'
import { Public } from '../modules/auth/decorators/public.decorator'
import { UserService } from '../services/user.service'
import {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
  UpdateUserStatusDto
} from '../dto/user.dto'
import { User } from '../entities/user.entity'

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Public() // 注册接口公开
  async createUser(@Body() createUserDto: CreateUserDto, @Req() request: Request): Promise<User> {
    return this.userService.createUser(createUserDto)
  }

  @Get()
  async findAll(
    @Query('page', ParseIntPipe) page = 1,
    @Query('limit', ParseIntPipe) limit = 20
  ): Promise<{ users: User[]; total: number }> {
    return this.userService.findAll(page, limit)
  }

  @Get('stats')
  async getUserStats(): Promise<{
    total: number
    active: number
    inactive: number
    banned: number
  }> {
    return this.userService.getUserStats()
  }

  @Get('me')
  async getCurrentUser(@CurrentUser() user: User): Promise<User> {
    return this.userService.findById(user.id)
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.userService.findById(id)
  }

  @Put('me')
  async updateCurrentUser(
    @CurrentUser() user: User,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<User> {
    return this.userService.updateUser(user.id, updateUserDto, user.id)
  }

  @Put(':id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: User
  ): Promise<User> {
    return this.userService.updateUser(id, updateUserDto, currentUser.id)
  }

  @Put('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto
  ): Promise<void> {
    await this.userService.changePassword(user.id, changePasswordDto, user.id)
  }

  @Put(':id/status')
  async updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateUserStatusDto,
    @CurrentUser() currentUser: User
  ): Promise<User> {
    return this.userService.updateStatus(id, updateStatusDto, currentUser.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User
  ): Promise<void> {
    await this.userService.deleteUser(id, currentUser.id)
  }
}
