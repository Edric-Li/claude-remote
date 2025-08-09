import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { Task } from '../entities/task.entity'
import { TaskRepository } from '../repositories/task.repository'
import { TaskService } from '../services/task.service'
import { TaskController } from '../controllers/task.controller'
import { WorkerModule } from './worker.module'
import { AgentModule } from './agent.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    EventEmitterModule.forRoot(),
    WorkerModule,
    AgentModule
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskRepository],
  exports: [TaskService]
})
export class TaskModule {}