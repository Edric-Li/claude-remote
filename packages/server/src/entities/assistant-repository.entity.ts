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
import { UserAssistant } from './user-assistant.entity'
import { UserRepository } from './user-repository.entity'

@Entity('assistant_repositories')
@Index(['assistantId'])
@Index(['repositoryId'])
@Index(['syncStatus'])
export class AssistantRepository {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'assistant_id' })
  assistantId: string

  @Column({ name: 'repository_id' })
  repositoryId: string

  @Column({ length: 500, nullable: true, name: 'workspace_path', comment: '工作区路径' })
  workspacePath?: string

  @Column({ length: 100, default: 'main', name: 'sync_branch', comment: '同步的分支' })
  syncBranch: string

  @Column({ type: 'boolean', default: true, name: 'auto_sync', comment: '是否自动同步' })
  autoSync: boolean

  @Column({ type: 'timestamp', nullable: true, name: 'last_sync_at', comment: '最后同步时间' })
  lastSyncAt?: Date

  @Column({
    length: 20,
    default: 'syncing',
    name: 'sync_status',
    comment: '同步状态: success, failed, syncing'
  })
  syncStatus: 'success' | 'failed' | 'syncing'

  @Column({ type: 'text', nullable: true, name: 'sync_error', comment: '同步错误信息' })
  syncError?: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  // 关联关系
  @ManyToOne(() => UserAssistant, assistant => assistant.repositories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assistant_id' })
  assistant: UserAssistant

  @ManyToOne(() => UserRepository, repository => repository.assistantRepositories, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'repository_id' })
  repository: UserRepository
}
