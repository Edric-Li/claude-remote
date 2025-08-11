import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm'

@Entity('system_configs')
@Index(['category'])
export class SystemConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 50, comment: '配置分类' })
  category: string

  @Column({ length: 100, name: 'key_name', comment: '配置键' })
  keyName: string

  @Column({ type: 'json', name: 'value_data', comment: '配置值' })
  valueData: any

  @Column({ type: 'text', nullable: true, comment: '配置说明' })
  description?: string

  @Column({ type: 'boolean', default: false, name: 'is_encrypted', comment: '是否加密存储' })
  isEncrypted: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
