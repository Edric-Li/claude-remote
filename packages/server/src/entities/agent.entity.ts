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

  @Column('datetime', { nullable: true })
  lastSeenAt: Date

  @Column('varchar', { length: 50 })
  createdBy: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
