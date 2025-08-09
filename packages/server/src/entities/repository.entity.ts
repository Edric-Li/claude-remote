import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('repositories')
export class RepositoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  name: string

  @Column({ nullable: true })
  description: string

  @Column()
  url: string

  @Column({ default: 'git' })
  type: 'git' | 'local' | 'svn'

  @Column({ nullable: true })
  branch: string

  @Column({ nullable: true })
  localPath: string

  @Column({ default: true })
  enabled: boolean

  @Column({ nullable: true })
  credentials: string // 加密存储的凭据

  @Column({ type: 'simple-json', nullable: true })
  settings: {
    autoUpdate?: boolean        // 是否在任务开始前自动拉取最新代码
    cachePath?: string          // Agent端缓存路径（可选，默认使用系统路径）
  }

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}