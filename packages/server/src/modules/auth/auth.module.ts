import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '../../entities/user.entity'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { UserService } from './user.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { LocalStrategy } from './strategies/local.strategy'

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ai-orchestra-secret-key-change-in-production',
      signOptions: { 
        expiresIn: process.env.JWT_EXPIRES_IN || '7d' 
      }
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UserService,
    JwtStrategy,
    LocalStrategy
  ],
  exports: [AuthService, UserService]
})
export class AuthModule {}