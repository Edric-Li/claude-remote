import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate
} from 'typeorm'
import * as bcrypt from 'bcrypt'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  username: string

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email: string

  @Column({ type: 'varchar', length: 255, select: false })
  password: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  nickname: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar: string

  @Column({ type: 'boolean', default: true })
  isActive: boolean

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt: Date

  @Column({ type: 'varchar', length: 45, nullable: true })
  lastLoginIp: string

  @Column({ type: 'simple-json', nullable: true })
  preferences: {
    theme?: 'light' | 'dark'
    language?: string
    defaultModel?: string
    notifications?: boolean
  }

  @Column({ type: 'simple-json', nullable: true })
  apiKeys: {
    claude?: string      // 加密存储
    openai?: string      // 加密存储
    cursor?: string      // 加密存储
    qucoder?: string     // 加密存储
  }

  @Column({ type: 'simple-json', nullable: true })
  usage: {
    totalTasks?: number
    totalTokens?: number
    lastTaskAt?: Date
  }

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  // 密码加密
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10)
    }
  }

  // 验证密码
  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password)
  }

  // 移除敏感信息
  toJSON() {
    const { password, apiKeys, ...user } = this as any
    return user
  }
}