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
import { AssistantMessage } from './assistant-message.entity'

@Entity('assistant_conversations')
@Index(['userId'])
@Index(['assistantId'])
@Index(['lastMessageAt'])
@Index(['status'])
@Index(['userId', 'status', 'lastMessageAt']) // 复合索引用于用户会话列表查询
export class AssistantConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'user_id' })
  userId: string

  @Column({ name: 'assistant_id' })
  assistantId: string

  @Column({ length: 200, nullable: true, comment: '会话标题' })
  title?: string

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', name: 'last_message_at', comment: '最后消息时间' })
  lastMessageAt: Date

  @Column({ type: 'int', default: 0, name: 'message_count', comment: '消息数量' })
  messageCount: number

  @Column({ length: 20, default: 'active', comment: '状态: active, archived, deleted' })
  status: 'active' | 'archived' | 'deleted'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  // 关联关系
  @ManyToOne(() => User, user => user.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @ManyToOne(() => UserAssistant, assistant => assistant.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assistant_id' })
  assistant: UserAssistant

  @OneToMany(() => AssistantMessage, message => message.conversation)
  messages: AssistantMessage[]
}