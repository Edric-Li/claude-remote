import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RepositoryEntity } from '../entities/repository.entity'
import { RepositoryService } from '../services/repository.service'
import { RepositoryController } from '../controllers/repository.controller'

@Module({
  imports: [TypeOrmModule.forFeature([RepositoryEntity])],
  controllers: [RepositoryController],
  providers: [RepositoryService],
  exports: [RepositoryService]
})
export class RepositoryModule {}
