import { IsString, IsEmail, IsOptional, MinLength, MaxLength, IsEnum } from 'class-validator'

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string

  @IsEmail()
  @IsOptional()
  email?: string

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string

  @IsString()
  @IsOptional()
  @MaxLength(100)
  displayName?: string

  @IsString()
  @IsOptional()
  @MaxLength(500)
  avatarUrl?: string
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  displayName?: string

  @IsString()
  @IsOptional()
  @MaxLength(500)
  avatarUrl?: string

  @IsEmail()
  @IsOptional()
  email?: string
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword: string
}

export class UpdateUserStatusDto {
  @IsEnum(['active', 'inactive', 'banned'])
  status: 'active' | 'inactive' | 'banned'
}

export class LoginDto {
  @IsString()
  username: string

  @IsString()
  password: string
}
