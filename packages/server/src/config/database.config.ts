import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { join } from 'path'

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production'
  const dbPath = process.env.DATABASE_PATH || join(process.cwd(), 'data')
  
  // 强制使用 SQLite 进行本地开发
  return {
    type: 'sqlite',
    database: join(dbPath, 'ai-orchestra.db'),
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    synchronize: !isProduction, // 开发环境自动同步
    logging: process.env.DB_LOGGING === 'true'
  }
}