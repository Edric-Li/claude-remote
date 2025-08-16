import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn
} from 'typeorm'
import { Agent } from './agent.entity'

@Entity('agent_health')
@Index(['agentId'])
@Index(['timestamp'])
@Index(['status'])
@Index(['agentId', 'timestamp'])
export class AgentHealth {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('uuid')
  agentId: string

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent: Agent

  @Column('datetime')
  timestamp: Date

  @Column({
    type: 'varchar',
    length: 20,
    default: 'healthy'
  })
  status: 'healthy' | 'warning' | 'critical' | 'offline'

  @Column('integer', { nullable: true })
  responseTime: number

  @Column({ type: 'simple-json' })
  metrics: {
    cpuUsage: number
    memoryUsage: number
    diskUsage: number
    networkLatency: number
  }

  @Column({ type: 'simple-json', nullable: true })
  alerts: Array<{
    id: string
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    message: string
    threshold: number
    currentValue: number
    triggeredAt: Date
  }>

  @Column({ type: 'simple-json', nullable: true })
  additionalData: {
    systemLoad?: number
    processCount?: number
    availableMemory?: number
    networkConnections?: number
    errorCount?: number
    requestCount?: number
  }

  @CreateDateColumn()
  createdAt: Date
}