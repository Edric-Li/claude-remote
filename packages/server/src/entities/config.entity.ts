import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('config')
export class ConfigEntity {
  @PrimaryColumn()
  key: string

  @Column({ type: 'text', nullable: true })
  value: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}