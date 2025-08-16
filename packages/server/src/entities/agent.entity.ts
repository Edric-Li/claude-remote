import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm'

@Entity('agents')
@Index(['secretKey'], { unique: true })
@Index(['status'])
@Index(['createdBy'])
@Index(['lastSeenAt'])
@Index(['lastValidatedAt'])
@Index(['name', 'status'])
@Index(['createdBy', 'status'])
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('varchar', { length: 100 })
  name: string

  @Column('text', { nullable: true })
  description: string

  @Column('varchar', { unique: true, length: 50 })
  secretKey: string

  @Column('integer', { default: 4 })
  maxWorkers: number

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending'
  })
  status: 'pending' | 'connected' | 'offline'

  @Column('varchar', { nullable: true, length: 100 })
  hostname: string

  @Column('varchar', { nullable: true, length: 20 })
  platform: string

  @Column('varchar', { nullable: true, length: 45 })
  ipAddress: string

  @Column({ type: 'simple-json', nullable: true })
  resources: {
    cpuCores: number
    memory: number
    diskSpace: number
  }

  @Column({ type: 'simple-json', nullable: true })
  tags: string[]

  @Column({ type: 'simple-json', nullable: true })
  workerStrategy: {
    mode: 'auto' | 'manual' | 'dynamic'
    config: Record<string, any>
  }

  @Column({ type: 'simple-json', nullable: true })
  allowedTools: string[]

  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    lastValidationResult?: {
      success: boolean
      timestamp: Date
      responseTime?: number
      errorMessage?: string
      warnings?: string[]
      metrics?: {
        connectivity: boolean
        authentication: boolean
        resourceAvailability: boolean
      }
    }
    monitoringConfig?: {
      enabled: boolean
      heartbeatInterval: number
      alertThresholds: {
        cpuUsage: number
        memoryUsage: number
        diskUsage: number
        responseTime: number
      }
      notificationChannels: string[]
    }
    alertRules?: Array<{
      id: string
      name: string
      condition: string
      threshold: number
      severity: 'low' | 'medium' | 'high' | 'critical'
      enabled: boolean
    }>
    permissions?: {
      allowedOperations: string[]
      accessLevel: 'read' | 'write' | 'admin'
      restrictions: string[]
    }
  }

  @Column('datetime', { nullable: true })
  lastSeenAt: Date

  @Column('datetime', { nullable: true })
  lastValidatedAt: Date

  @Column('varchar', { length: 50 })
  createdBy: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
