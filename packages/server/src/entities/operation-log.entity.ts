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

@Entity('operation_logs')
@Index(['agentId'])
@Index(['userId'])
@Index(['operation'])
@Index(['timestamp'])
@Index(['success'])
@Index(['agentId', 'operation'])
@Index(['userId', 'timestamp'])
export class OperationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('uuid', { nullable: true })
  agentId: string

  @ManyToOne(() => Agent, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'agentId' })
  agent: Agent

  @Column('varchar', { length: 50 })
  userId: string

  @Column({
    type: 'varchar',
    length: 50
  })
  operation: 'create' | 'update' | 'delete' | 'validate' | 'batch_operation' | 'connect' | 'disconnect' | 'reset_key' | 'import' | 'export'

  @Column({ type: 'simple-json', nullable: true })
  details: {
    previousState?: any
    newState?: any
    batchSize?: number
    affectedAgents?: string[]
    configChanges?: Record<string, any>
    validationResults?: any
    errorDetails?: string
    duration?: number
    resourcesUsed?: {
      memory: number
      cpu: number
    }
  }

  @Column('boolean', { default: true })
  success: boolean

  @Column('text', { nullable: true })
  errorMessage: string

  @Column('datetime')
  timestamp: Date

  @Column('varchar', { length: 45, nullable: true })
  ipAddress: string

  @Column('text', { nullable: true })
  userAgent: string

  @Column('varchar', { length: 50, nullable: true })
  sessionId: string

  @Column({
    type: 'varchar',
    length: 20,
    default: 'info'
  })
  severity: 'info' | 'warning' | 'error' | 'critical'

  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    requestId?: string
    correlationId?: string
    source?: string
    tags?: string[]
    context?: Record<string, any>
  }

  @CreateDateColumn()
  createdAt: Date
}