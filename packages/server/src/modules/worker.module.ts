import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Worker } from '../entities/worker.entity'
import { WorkerRepository } from '../repositories/worker.repository'
import { WorkerService } from '../services/worker.service'
import { WorkerController } from '../controllers/worker.controller'
import { AgentModule } from './agent.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Worker]),
    AgentModule
  ],
  controllers: [WorkerController],
  providers: [WorkerService, WorkerRepository],
  exports: [WorkerService]
})
export class WorkerModule {}