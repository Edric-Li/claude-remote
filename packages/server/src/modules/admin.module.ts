import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Agent } from '../entities/agent.entity'

// Services
import { SystemService } from '../services/system.service'
import { DatabaseService } from '../services/database.service'

// Controllers
import { SystemController } from '../controllers/system.controller'
import { DatabaseController } from '../controllers/database.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent])
  ],
  controllers: [
    SystemController,
    DatabaseController
  ],
  providers: [
    SystemService,
    DatabaseService
  ],
  exports: [
    SystemService,
    DatabaseService
  ]
})
export class AdminModule {}