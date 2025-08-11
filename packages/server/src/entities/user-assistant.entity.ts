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
import { UserAiConfig } from './user-ai-config.entity'
import { AssistantRepository } from './assistant-repository.entity'
import { AssistantConversation } from './assistant-conversation.entity'

@Entity('user_assistants')
@Index(['userId'])
@Index(['status'])
export class UserAssistant {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'user_id' })
  userId: string

  @Column({ length: 100, comment: '助手名称' })
  name: string

  @Column({ type: 'text', nullable: true, comment: '助手描述' })
  description?: string

  @Column({ length: 100, default: '🤖', comment: '助手头像(emoji或图片URL)' })
  avatar: string

  @Column({ name: 'ai_config_id', comment: '关联的AI工具配置' })
  aiConfigId: string

  @Column({ length: 20, default: 'creating', comment: '状态: active, inactive, creating, error' })
  status: 'active' | 'inactive' | 'creating' | 'error'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  // 关联关系
  @ManyToOne(() => User, user => user.assistants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @ManyToOne(() => UserAiConfig, config => config.assistants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ai_config_id' })
  aiConfig: UserAiConfig

  @OneToMany(() => AssistantRepository, assistantRepo => assistantRepo.assistant)
  repositories: AssistantRepository[]

  @OneToMany(() => AssistantConversation, conversation => conversation.assistant)
  conversations: AssistantConversation[]
}
