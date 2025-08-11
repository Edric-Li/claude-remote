import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { join } from 'path'
import * as dotenv from 'dotenv'

// 确保环境变量被加载
dotenv.config()

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'ai_orchestra',
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    synchronize: true, // 开启自动同步，创建数据库表
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
