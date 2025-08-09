import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Agent } from '../entities/agent.entity'

// Services
import { SystemService } from '../services/system.service'
import { DatabaseService } from '../services/database.service'
import { SecurityService } from '../services/security.service'

// Controllers
import { SystemController } from '../controllers/system.controller'
import { DatabaseController } from '../controllers/database.controller'
import { SecurityController } from '../controllers/security.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent])
  ],
  controllers: [
    SystemController,
    DatabaseController,
    SecurityController
  ],
  providers: [
    SystemService,
    DatabaseService,
    SecurityService
  ],
  exports: [
    SystemService,
    DatabaseService,
    SecurityService
  ]
})
export class AdminModule {}