import { Module, forwardRef } from '@nestjs/common'
import { ChatGateway } from './chat.gateway'
import { AgentModule } from '../modules/agent.module'
import { WorkerModule } from '../modules/worker.module'
import { TaskModule } from '../modules/task.module'
import { SessionModule } from '../modules/session.module'
import { RepositoryModule } from '../modules/repository.module'

@Module({
  imports: [
    forwardRef(() => AgentModule),
    forwardRef(() => WorkerModule),
    forwardRef(() => TaskModule),
    forwardRef(() => SessionModule),
    forwardRef(() => RepositoryModule)
  ],
  providers: [ChatGateway]
})
export class ChatModule {}