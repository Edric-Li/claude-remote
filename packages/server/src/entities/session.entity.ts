import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index
} from 'typeorm'
import { User } from './user.entity'
import { RepositoryEntity } from './repository.entity'

/**
 * 会话实体 - 用户与AI的对话会话
 */
@Entity('sessions')
@Index(['userId', 'status'])
@Index(['createdAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('varchar', { length: 200 })
  name: string

  @Column('varchar', { length: 50 })
  aiTool: string // claude, qwen, cursor等

  @Column('varchar', { 
    length: 20,
    default: 'active'
  })
  status: 'active' | 'paused' | 'completed' | 'archived'

  // 关联用户
  @Column('uuid')
  userId: string

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User

  // 关联仓库
  @Column('uuid')
  repositoryId: string

  @ManyToOne(() => RepositoryEntity)
  @JoinColumn({ name: 'repositoryId' })
  repository: RepositoryEntity

  // Worker相关信息
  @Column('varchar', { nullable: true, length: 100 })
  workerId: string

  @Column('varchar', { nullable: true, length: 100 })
  agentId: string

  // Claude会话ID，用于恢复对话
  @Column('varchar', { nullable: true, length: 100 })
  claudeSessionId: string

  // 元数据
  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    branch?: string
    lastActivity?: Date
    tokenUsage?: number
    workerStatus?: 'idle' | 'busy'
    workerConfig?: any
  }

  // 统计信息
  @Column('integer', { default: 0 })
  messageCount: number

  @Column('integer', { default: 0 })
  totalTokens: number

  @Column('float', { default: 0 })
  totalCost: number

  // 消息关联
  @OneToMany(() => SessionMessage, message => message.session, {
    cascade: true
  })
  messages: SessionMessage[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}

/**
 * 会话消息实体 - 会话中的每条消息
 */
@Entity('session_messages')
@Index(['sessionId', 'createdAt'])
export class SessionMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('uuid')
  sessionId: string

  @ManyToOne(() => Session, session => session.messages, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'sessionId' })
  session: Session

  @Column('varchar', { length: 20 })
  from: 'user' | 'assistant' | 'system'

  @Column('text')
  content: string

  // 元数据
  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    tool?: string
    agentId?: string
    workerId?: string
    usage?: {
      input_tokens: number
      output_tokens: number
    }
    error?: string
  }

  @CreateDateColumn()
  createdAt: Date
}