import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { APP_GUARD } from '@nestjs/core'
import { ChatModule } from './chat/chat.module'
import { AgentModule } from './modules/agent.module'
import { WorkerModule } from './modules/worker.module'
import { TaskModule } from './modules/task.module'
import { AdminModule } from './modules/admin.module'
import { AuthModule } from './modules/auth/auth.module'
import { RepositoryModule } from './modules/repository.module'
import { SessionModule } from './modules/session.module'
import { getDatabaseConfig } from './config/database.config'
import { AgentSimpleController } from './controllers/agent-simple.controller'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'
import { ClaudeController } from './controllers/claude.controller'
import { ClaudeService } from './services/claude.service'
import { ClaudeConfig } from './entities/claude-config.entity'

@Module({
  imports: [
    TypeOrmModule.forRoot(getDatabaseConfig()),
    TypeOrmModule.forFeature([ClaudeConfig]),
    EventEmitterModule.forRoot(),
    AuthModule,  // 认证模块要放在前面
    ChatModule,
    AgentModule,
    WorkerModule,
    TaskModule,
    AdminModule,
    RepositoryModule,
    SessionModule
  ],
  controllers: [AgentSimpleController, ClaudeController],
  providers: [
    ClaudeService,
    // 全局启用 JWT 认证守卫
    // 使用 @Public() 装饰器的路由会跳过认证
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    }
  ]
})
export class AppModule {}