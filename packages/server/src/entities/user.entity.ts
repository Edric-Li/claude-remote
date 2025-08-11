import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
  OneToMany
} from 'typeorm'
import * as bcrypt from 'bcrypt'
import { UserAiConfig } from './user-ai-config.entity'
import { UserRepository } from './user-repository.entity'
import { UserAssistant } from './user-assistant.entity'
import { AssistantConversation } from './assistant-conversation.entity'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 50, unique: true })
  @Index()
  username: string

  @Column({ length: 100, unique: true, nullable: true })
  @Index()
  email?: string

  @Column({ length: 255, name: 'password_hash', select: false })
  passwordHash: string

  @Column({ length: 100, nullable: true, name: 'display_name' })
  displayName?: string

  @Column({ length: 500, nullable: true, name: 'avatar_url' })
  avatarUrl?: string

  @Column({ length: 20, default: 'active', comment: '状态: active, inactive, banned' })
  @Index()
  status: 'active' | 'inactive' | 'banned'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date

  // 关联关系
  @OneToMany(() => UserAiConfig, config => config.user)
  aiConfigs: UserAiConfig[]

  @OneToMany(() => UserRepository, repo => repo.user)
  repositories: UserRepository[]

  @OneToMany(() => UserAssistant, assistant => assistant.user)
  assistants: UserAssistant[]

  @OneToMany(() => AssistantConversation, conversation => conversation.user)
  conversations: AssistantConversation[]


  // 密码加密
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.passwordHash && !this.passwordHash.startsWith('$2b$')) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 10)
    }
  }

  // 验证密码
  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.passwordHash)
  }

  // 移除敏感信息
  toJSON() {
    const { passwordHash, ...user } = this as any
    return user
  }
}
