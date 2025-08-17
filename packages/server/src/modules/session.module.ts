import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JwtModule } from '@nestjs/jwt'
import { Session, SessionMessage } from '../entities/session.entity'
import { RepositoryEntity } from '../entities/repository.entity'
import { User } from '../entities/user.entity'
import { Agent } from '../entities/agent.entity'
import { SessionService } from '../services/session.service'
import { SessionController } from '../controllers/session.controller'
import { TestAuthGuard } from '../auth/test-auth.guard'

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, SessionMessage, RepositoryEntity, User, Agent]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '1h' }
    })
  ],
  controllers: [SessionController],
  providers: [SessionService, TestAuthGuard],
  exports: [SessionService]
})
export class SessionModule {}
