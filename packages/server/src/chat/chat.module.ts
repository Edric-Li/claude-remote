import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ChatGateway } from './chat.gateway'
import { AgentModule } from '../modules/agent.module'
import { WorkerModule } from '../modules/worker.module'
import { TaskModule } from '../modules/task.module'
import { SessionModule } from '../modules/session.module'
import { RepositoryModule } from '../modules/repository.module'
import { ClaudeService } from '../services/claude.service'
import { ClaudeConfig } from '../entities/claude-config.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([ClaudeConfig]),
    forwardRef(() => AgentModule),
    forwardRef(() => WorkerModule),
    forwardRef(() => TaskModule),
    forwardRef(() => SessionModule),
    forwardRef(() => RepositoryModule)
  ],
  providers: [ChatGateway, ClaudeService]
})
export class ChatModule {}