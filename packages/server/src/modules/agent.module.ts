import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Agent } from '../entities/agent.entity'
import { AgentHealth } from '../entities/agent-health.entity'
import { OperationLog } from '../entities/operation-log.entity'
import { AgentRepository } from '../repositories/agent.repository'
import { AgentHealthRepository } from '../repositories/agent-health.repository'
// import { OperationLogRepository } from '../repositories/operation-log.repository'
import { AgentService } from '../services/agent.service'
// import { AgentValidationService } from '../services/agent-validation.service'
// import { BatchOperationService } from '../services/batch-operation.service'
// import { MonitoringService } from '../services/monitoring.service'
import { AgentController } from '../controllers/agent.controller'
// import { HealthController } from '../controllers/health.controller'
import { ChatModule } from '../chat/chat.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Agent
      // AgentHealth, 
      // OperationLog
    ]),
    forwardRef(() => ChatModule)
  ],
  controllers: [AgentController],
  providers: [
    AgentRepository,
    // AgentHealthRepository, 
    // OperationLogRepository,
    AgentService
    // AgentValidationService,
    // BatchOperationService,
    // MonitoringService
  ],
  exports: [
    AgentService, 
    AgentRepository
    // AgentValidationService,
    // BatchOperationService,
    // MonitoringService
  ]
})
export class AgentModule {}
