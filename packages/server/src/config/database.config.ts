import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { join } from 'path'

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production'
  const dbPath = process.env.DATABASE_PATH || join(process.cwd(), 'data')
  
  // 如果明确指定使用 SQLite
  if (process.env.DB_TYPE === 'sqlite') {
    return {
      type: 'sqlite',
      database: join(dbPath, 'ai-orchestra.db'),
      entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
      synchronize: !isProduction, // 开发环境自动同步
      logging: process.env.DB_LOGGING === 'true'
    }
  }
  
  // 默认使用 PostgreSQL
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'edricli.com',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'orchestra',
    password: process.env.DB_PASSWORD || 'ktCKBfQ66eRzekJR',
    database: process.env.DB_NAME || 'orchestra',
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    synchronize: true, // 允许自动同步表结构
    logging: process.env.DB_LOGGING === 'true',
    ssl: process.env.DB_SSL === 'true' ? {
      rejectUnauthorized: false
    } : false
  }
}