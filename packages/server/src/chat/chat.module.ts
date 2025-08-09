import { Module, forwardRef } from '@nestjs/common'
import { ChatGateway } from './chat.gateway'
import { AgentModule } from '../modules/agent.module'
import { WorkerModule } from '../modules/worker.module'
import { TaskModule } from '../modules/task.module'

@Module({
  imports: [
    forwardRef(() => AgentModule),
    forwardRef(() => WorkerModule),
    forwardRef(() => TaskModule)
  ],
  providers: [ChatGateway]
})
export class ChatModule {}