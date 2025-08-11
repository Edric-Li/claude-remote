import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm'
import { AssistantConversation } from './assistant-conversation.entity'

export interface MessageMetadata {
  model_used?: string
  response_time?: number
  context_files?: string[]
  actions_taken?: string[]
  [key: string]: any
}

@Entity('assistant_messages')
@Index(['conversationId'])
@Index(['role'])
@Index(['createdAt'])
@Index(['conversationId', 'createdAt']) // 复合索引用于消息分页查询
export class AssistantMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'conversation_id' })
  conversationId: string

  @Column({ length: 20, comment: '角色: user, assistant, system' })
  role: 'user' | 'assistant' | 'system'

  @Column({ type: 'text' })
  content: string

  @Column({ type: 'json', nullable: true, comment: '消息元数据' })
  metadata?: MessageMetadata

  @Column({ type: 'int', nullable: true, name: 'token_count', comment: '消息Token数量' })
  tokenCount?: number

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  // 关联关系
  @ManyToOne(() => AssistantConversation, conversation => conversation.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: AssistantConversation
}