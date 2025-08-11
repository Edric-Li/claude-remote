import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany
} from 'typeorm'
import { User } from './user.entity'
import { AssistantRepository } from './assistant-repository.entity'

@Entity('user_repositories')
@Index(['userId'])
@Index(['status'])
export class UserRepository {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'user_id' })
  userId: string

  @Column({ length: 100, comment: '仓库显示名称' })
  name: string

  @Column({
    type: 'enum',
    enum: ['git', 'local']
  })
  type: 'git' | 'local'

  @Column({ length: 1000, comment: '仓库URL或本地路径' })
  url: string

  @Column({ length: 100, default: 'main', comment: '默认分支' })
  branch: string

  @Column({ length: 100, nullable: true, comment: '认证用户名' })
  username?: string

  @Column({ length: 500, nullable: true, comment: '加密存储的密码/Token' })
  password?: string

  @Column({ type: 'text', nullable: true, name: 'ssh_key', comment: '加密存储的SSH私钥' })
  sshKey?: string

  @Column({ type: 'text', nullable: true, comment: '仓库描述' })
  description?: string

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'error'],
    default: 'active'
  })
  status: 'active' | 'inactive' | 'error'

  @Column({ type: 'timestamp', nullable: true, name: 'last_sync_at', comment: '最后同步时间' })
  lastSyncAt?: Date

  @Column({ type: 'text', nullable: true, name: 'sync_error', comment: '同步错误信息' })
  syncError?: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  // 关联关系
  @ManyToOne(() => User, user => user.repositories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @OneToMany(() => AssistantRepository, assistantRepo => assistantRepo.repository)
  assistantRepositories: AssistantRepository[]
}