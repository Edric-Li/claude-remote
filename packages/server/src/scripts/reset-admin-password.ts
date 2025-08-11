import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { User } from '../entities/user.entity'
import * as bcrypt from 'bcrypt'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

async function resetAdminPassword() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'edric',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ai_orchestra',
    entities: [User],
    synchronize: false,
    logging: false
  })
  
  try {
    await dataSource.initialize()
    console.log('Database connected')
    
    const userRepository = dataSource.getRepository(User)
    const admin = await userRepository.findOne({ where: { username: 'admin' } })
    
    if (admin) {
      // 直接设置新密码，会被 @BeforeUpdate 钩子加密
      admin.passwordHash = 'admin123'
      await userRepository.save(admin)
      console.log('Admin password reset to: admin123')
    } else {
      console.log('Admin user not found')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await dataSource.destroy()
  }
}

resetAdminPassword()