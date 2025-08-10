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

@Entity('workers')
@Index(['agentId', 'workerId'], { unique: true })
@Index(['status'])
@Index(['agentId'])
export class Worker {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('varchar', { length: 50 })
  workerId: string

  @Column('varchar', { length: 100 })
  name: string

  @Column('uuid')
  agentId: string

  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'agentId' })
  agent: Agent

  @Column({
    type: 'varchar',
    length: 20,
    default: 'idle'
  })
  status: 'idle' | 'busy' | 'offline' | 'error'

  @Column('varchar', { nullable: true, length: 100 })
  currentTaskId: string

  @Column('varchar', { nullable: true, length: 100 })
  currentTaskType: string

  @Column({ type: 'simple-json', nullable: true })
  capabilities: {
    supportedTools: string[]
    maxConcurrentTasks: number
    resourceLimits: {
      maxMemory: number
      maxCpu: number
      maxDiskIO: number
    }
  }

  @Column({ type: 'simple-json', nullable: true })
  metrics: {
    tasksCompleted: number
    tasksFailed: number
    totalExecutionTime: number
    averageExecutionTime: number
    successRate: number
    lastTaskCompletedAt: Date | null
  }

  @Column({ type: 'simple-json', nullable: true })
  systemInfo: {
    pid: number
    memory: {
      used: number
      total: number
    }
    cpu: {
      usage: number
      cores: number
    }
  }

  @Column('timestamp', { nullable: true })
  startedAt: Date

  @Column('timestamp', { nullable: true })
  lastHeartbeat: Date

  @Column({ type: 'simple-json', nullable: true })
  config: Record<string, any>

  @Column('text', { nullable: true })
  lastError: string

  @Column('timestamp', { nullable: true })
  lastErrorAt: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}