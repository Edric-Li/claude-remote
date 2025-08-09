import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Session, SessionMessage } from '../entities/session.entity'
import { RepositoryEntity } from '../entities/repository.entity'
import { User } from '../entities/user.entity'
import { SessionService } from '../services/session.service'
import { SessionController } from '../controllers/session.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Session,
      SessionMessage,
      RepositoryEntity,
      User
    ])
  ],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService]
})
export class SessionModule {}