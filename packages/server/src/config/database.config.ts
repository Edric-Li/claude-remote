import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { join } from 'path'
import * as dotenv from 'dotenv'

// 确保环境变量被加载
dotenv.config()

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production'

  // 使用 PostgreSQL 数据库
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'ai_orchestra',
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    synchronize: false, // 暂时关闭自动同步，避免迁移错误
    logging: process.env.DB_LOGGING === 'true',
    ssl:
      process.env.DB_SSL === 'true'
        ? {
            rejectUnauthorized: false
          }
        : false,
    poolSize: 10,
    connectTimeoutMS: 10000,
    extra: {
      max: 30,
      idleTimeoutMillis: 30000
    }
  }
}
