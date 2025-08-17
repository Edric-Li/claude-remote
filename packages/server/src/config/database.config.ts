import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { join } from 'path'
import * as dotenv from 'dotenv'

// 确保环境变量被加载
dotenv.config()

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const dbType = process.env.DB_TYPE as 'postgres' | 'sqlite' || 'postgres'
  
  const baseConfig = {
    entities: [
      join(__dirname, '..', 'entities', 'user.entity.{ts,js}'),
      join(__dirname, '..', 'entities', 'repository.entity.{ts,js}'),
      join(__dirname, '..', 'entities', 'agent.entity.{ts,js}'),
      join(__dirname, '..', 'entities', 'agent-health.entity.{ts,js}'),
      join(__dirname, '..', 'entities', 'operation-log.entity.{ts,js}'),
      join(__dirname, '..', 'entities', 'session.entity.{ts,js}')
    ],
    synchronize: process.env.DB_SYNCHRONIZE === 'true' || process.env.NODE_ENV === 'development',
    logging: process.env.DB_LOGGING === 'true'
  }
  
  if (dbType === 'sqlite') {
    return {
      ...baseConfig,
      type: 'sqlite',
      database: process.env.DB_DATABASE || './data/database.sqlite'
    }
  }
  
  // PostgreSQL configuration
  return {
    ...baseConfig,
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'ai_orchestra',
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
