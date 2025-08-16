import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ChatGateway } from './chat.gateway'
import { AgentModule } from '../modules/agent.module'
// import { WorkerModule } from '../modules/worker.module' // 已移除
import { TaskModule } from '../modules/task.module'
import { SessionModule } from '../modules/session.module'
import { RepositoryModule } from '../modules/repository.module'
// import { ClaudeService } from '../services/claude.service' // 已移除
// import { ClaudeConfig } from '../entities/claude-config.entity' // 已移除
import { ClaudeCliService } from '../services/claude-cli.service'

@Module({
  imports: [
    // TypeOrmModule.forFeature([ClaudeConfig]), // 已移除
    forwardRef(() => AgentModule),
    // forwardRef(() => WorkerModule), // 已移除
    forwardRef(() => TaskModule),
    forwardRef(() => SessionModule),
    forwardRef(() => RepositoryModule)
  ],
  providers: [ChatGateway, ClaudeCliService] // ClaudeService 已移除
})
export class ChatModule {}
