import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm'
import { RepositoryEntity } from './repository.entity'
import { User } from './user.entity'
import { AuditAction, AuditLogDetails } from '../types/audit.types'

@Entity('audit_logs')
@Index(['repositoryId'])
@Index(['userId'])
@Index(['action'])
@Index(['timestamp'])
@Index(['repositoryId', 'timestamp'])
@Index(['userId', 'timestamp'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('uuid', { name: 'repository_id' })
  repositoryId: string

  @ManyToOne(() => RepositoryEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repository_id' })
  repository: RepositoryEntity

  @Column('uuid', { name: 'user_id' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({
    type: 'enum',
    enum: AuditAction
  })
  action: AuditAction

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: '操作详细信息，包含变更记录、测试结果、错误信息等'
  })
  details?: AuditLogDetails

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date

  @Column({
    type: 'varchar',
    length: 45,
    nullable: true,
    name: 'ip_address',
    comment: '用户IP地址'
  })
  ipAddress?: string

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'user_agent',
    comment: '用户代理字符串'
  })
  userAgent?: string

  @Column({
    type: 'boolean',
    default: true,
    comment: '操作是否成功'
  })
  success: boolean

  @Column({
    type: 'integer',
    nullable: true,
    name: 'duration_ms',
    comment: '操作耗时（毫秒）'
  })
  durationMs?: number
}