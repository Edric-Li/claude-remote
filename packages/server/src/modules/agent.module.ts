import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Agent } from '../entities/agent.entity'
import { AgentRepository } from '../repositories/agent.repository'
import { AgentService } from '../services/agent.service'
import { AgentController } from '../controllers/agent.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent])
  ],
  controllers: [AgentController],
  providers: [
    AgentRepository,
    AgentService
  ],
  exports: [
    AgentService,
    AgentRepository
  ]
})
export class AgentModule {}