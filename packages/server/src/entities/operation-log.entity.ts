import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm'
import { User } from './user.entity'

@Entity('operation_logs')
@Index(['userId'])
@Index(['operationType'])
@Index(['resourceType', 'resourceId'])
@Index(['createdAt'])
export class OperationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'user_id', nullable: true })
  userId?: string

  @Column({ length: 50, name: 'operation_type', comment: '操作类型' })
  operationType: string

  @Column({ length: 50, nullable: true, name: 'resource_type', comment: '资源类型' })
  resourceType?: string

  @Column({ nullable: true, name: 'resource_id', comment: '资源ID' })
  resourceId?: string

  @Column({ type: 'json', nullable: true, name: 'operation_data', comment: '操作详情' })
  operationData?: any

  @Column({ length: 45, nullable: true, name: 'ip_address', comment: 'IP地址' })
  ipAddress?: string

  @Column({ type: 'text', nullable: true, name: 'user_agent', comment: '用户代理' })
  userAgent?: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  // 关联关系
  @ManyToOne(() => User, user => user.operationLogs, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User
}