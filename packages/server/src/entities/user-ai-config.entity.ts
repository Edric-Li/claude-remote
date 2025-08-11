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
import { UserAssistant } from './user-assistant.entity'

export interface AiConfigData {
  provider: string
  model: string
  api_key: string // 加密存储
  base_url?: string
  version?: string
  organization?: string
  region?: string
  timeout?: number
  keep_alive?: string
  auth_type?: string
  headers?: Record<string, string>
}

@Entity('user_ai_configs')
@Index(['userId'])
@Index(['toolType'])
@Index(['userId', 'toolType', 'isDefault'])
export class UserAiConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'user_id' })
  userId: string

  @Column({ length: 100 })
  name: string

  @Column({
    type: 'enum',
    enum: ['claude', 'openai', 'gemini', 'ollama', 'custom'],
    name: 'tool_type'
  })
  toolType: 'claude' | 'openai' | 'gemini' | 'ollama' | 'custom'

  @Column({ type: 'json', name: 'config_data' })
  configData: AiConfigData

  @Column({ type: 'boolean', default: false, name: 'is_default' })
  isDefault: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  // 关联关系
  @ManyToOne(() => User, user => user.aiConfigs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @OneToMany(() => UserAssistant, assistant => assistant.aiConfig)
  assistants: UserAssistant[]
}