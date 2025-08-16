import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { RepositoryType, RepositorySettings, RepositoryMetadata } from '../types/repository.types'

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
  type: RepositoryType

  @Column({ nullable: true })
  branch: string

  @Column({ nullable: true })
  localPath: string

  @Column({ default: true })
  enabled: boolean

  @Column({ nullable: true })
  credentials: string // 使用随机 IV 加密存储

  @Column({ type: 'text', nullable: true })
  settings?: string // JSON string for SQLite compatibility

  @Column({ type: 'text', nullable: true })
  metadata?: string // JSON string for SQLite compatibility

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
