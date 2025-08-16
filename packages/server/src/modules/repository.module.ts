import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RepositoryEntity } from '../entities/repository.entity'
import { RepositoryService } from '../services/repository.service'
import { SearchPaginationService } from '../services/search-pagination.service'
import { DatabaseOptimizationService } from '../services/database-optimization.service'
import { RepositoryController } from '../controllers/repository.controller'
import { EncryptionService } from '../services/encryption.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([RepositoryEntity])
  ],
  controllers: [RepositoryController],
  providers: [RepositoryService, SearchPaginationService, DatabaseOptimizationService, EncryptionService],
  exports: [RepositoryService, SearchPaginationService, DatabaseOptimizationService, EncryptionService]
})
export class RepositoryModule {}
