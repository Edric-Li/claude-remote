import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { join } from 'path'

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production'
  const dbPath = process.env.DATABASE_PATH || join(process.cwd(), 'data')
  
  // 开发环境使用 SQLite
  if (!isProduction || process.env.DB_TYPE === 'sqlite') {
    return {
      type: 'sqlite',
      database: join(dbPath, 'ai-orchestra.db'),
      entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
      synchronize: !isProduction, // 开发环境自动同步
      logging: process.env.DB_LOGGING === 'true'
    }
  }
  
  // 生产环境可以切换到 PostgreSQL 或 MySQL
  const dbType = process.env.DB_TYPE as 'postgres' | 'mysql'
  
  return {
    type: dbType || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'ai_orchestra',
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    synchronize: false, // 生产环境使用迁移
    logging: process.env.DB_LOGGING === 'true',
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    migrationsRun: true
  }
}