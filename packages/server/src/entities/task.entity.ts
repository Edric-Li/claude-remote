import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index 
} from 'typeorm'
import { Agent } from './agent.entity'
import { Worker } from './worker.entity'

@Entity('tasks')
@Index(['status'])
@Index(['agentId'])
@Index(['workerId'])
@Index(['priority', 'createdAt'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('varchar', { length: 100 })
  type: string

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending'
  })
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled'

  @Column('integer', { default: 5 })
  priority: number

  @Column({ type: 'simple-json' })
  payload: Record<string, any>

  @Column({ type: 'simple-json', nullable: true })
  result: Record<string, any>

  @Column('text', { nullable: true })
  error: string

  @Column('uuid', { nullable: true })
  agentId: string

  @ManyToOne(() => Agent, { nullable: true })
  @JoinColumn({ name: 'agentId' })
  agent: Agent

  @Column('uuid', { nullable: true })
  workerId: string

  @ManyToOne(() => Worker, { nullable: true })
  @JoinColumn({ name: 'workerId' })
  worker: Worker

  @Column('varchar', { length: 50 })
  createdBy: string

  @Column('timestamp', { nullable: true })
  assignedAt: Date

  @Column('timestamp', { nullable: true })
  startedAt: Date

  @Column('timestamp', { nullable: true })
  completedAt: Date

  @Column('integer', { nullable: true })
  executionTime: number

  @Column('integer', { default: 0 })
  retryCount: number

  @Column('integer', { default: 3 })
  maxRetries: number

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>

  @Column({ type: 'simple-json', nullable: true })
  requirements: {
    tools?: string[]
    minMemory?: number
    minCpu?: number
    tags?: string[]
  }

  @Column('timestamp', { nullable: true })
  scheduledFor: Date

  @Column('timestamp', { nullable: true })
  expiresAt: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}