import { Module, OnModuleInit } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { APP_GUARD } from '@nestjs/core'
import { getDatabaseConfig } from './config/database.config'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'

// 实体
import { User } from './entities/user.entity'

// 服务
import { DatabaseInitService } from './database/init.service'
import { UserService } from './services/user.service'

// 控制器
import { UserController } from './controllers/user.controller'

// 认证模块
import { AuthModule } from './modules/auth/auth.module'
import { ChatModule } from './chat/chat.module'
import { WebSocketModule } from './websocket.module'
import { JwtModule } from '@nestjs/jwt'

@Module({
  imports: [
    TypeOrmModule.forRoot(getDatabaseConfig()),
    TypeOrmModule.forFeature([
      User
    ]),
    EventEmitterModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'ai-orchestra-secret-key-change-in-production',
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    }),
    AuthModule,
    ChatModule,
    WebSocketModule
  ],
  controllers: [
    UserController
  ],
  providers: [
    DatabaseInitService,
    UserService,
    // 全局启用 JWT 认证守卫
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    }
  ]
})
export class AppModule implements OnModuleInit {
  constructor(private readonly databaseInitService: DatabaseInitService) {}

  async onModuleInit() {
    // 应用启动时初始化数据库
    try {
      await this.databaseInitService.initializeDatabase()
    } catch (error) {
      console.error('Database initialization failed:', error)
      // 可以选择不阻止应用启动，只记录错误
    }
  }
}
