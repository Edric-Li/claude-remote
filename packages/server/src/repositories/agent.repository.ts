import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Agent } from '../entities/agent.entity'
import { BaseRepository } from './base.repository'

@Injectable()
export class AgentRepository extends BaseRepository<Agent> {
  constructor(
    @InjectRepository(Agent)
    repository: Repository<Agent>
  ) {
    super(repository)
  }

  async findBySecretKey(secretKey: string): Promise<Agent | null> {
    return this.repository.findOne({
      where: { secretKey }
    })
  }

  async findByStatus(status: 'pending' | 'connected' | 'offline'): Promise<Agent[]> {
    return this.repository.find({
      where: { status },
      order: {
        createdAt: 'DESC'
      }
    })
  }

  async findConnectedAgents(): Promise<Agent[]> {
    return this.findByStatus('connected')
  }

  async updateStatus(id: string, status: 'pending' | 'connected' | 'offline'): Promise<void> {
    await this.repository.update(id, {
      status,
      lastSeenAt: status === 'connected' ? new Date() : undefined
    })
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.repository.update(id, {
      lastSeenAt: new Date(),
      status: 'connected'
    })
  }

  async setOffline(id: string): Promise<void> {
    await this.updateStatus(id, 'offline')
  }

  async isSecretKeyUnique(secretKey: string, excludeId?: string): Promise<boolean> {
    const query = this.repository.createQueryBuilder('agent')
      .where('agent.secretKey = :secretKey', { secretKey })
    
    if (excludeId) {
      query.andWhere('agent.id != :excludeId', { excludeId })
    }
    
    const count = await query.getCount()
    return count === 0
  }

  async findByCreator(createdBy: string): Promise<Agent[]> {
    return this.repository.find({
      where: { createdBy },
      order: {
        createdAt: 'DESC'
      }
    })
  }
}