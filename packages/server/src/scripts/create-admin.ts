import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { UserService } from '../services/user.service'
import * as bcrypt from 'bcrypt'

async function createAdmin() {
  console.log('🚀 创建管理员用户...\n')

  try {
    const app = await NestFactory.createApplicationContext(AppModule)
    const userService = app.get(UserService)

    // 管理员账户信息
    const adminData = {
      username: 'admin',
      email: 'admin@ai-orchestra.com',
      password: 'admin123456',
      displayName: 'AI Orchestra 管理员'
    }

    console.log('📋 管理员账户信息:')
    console.log(`   用户名: ${adminData.username}`)
    console.log(`   邮箱: ${adminData.email}`)
    console.log(`   密码: ${adminData.password}`)
    console.log(`   显示名: ${adminData.displayName}\n`)

    // 检查是否已存在并删除旧用户
    try {
      const existingUser = await userService.findByUsername(adminData.username)
      if (existingUser) {
        console.log('⚠️  管理员用户已存在，删除旧用户并重新创建')
        console.log(`   用户ID: ${existingUser.id}`)
        console.log(`   创建时间: ${existingUser.createdAt}`)
        await userService.deleteUser(existingUser.id)
        console.log('✅ 旧管理员用户已删除')
      }
    } catch (error) {
      // 用户不存在，继续创建
    }

    // 创建管理员用户
    const admin = await userService.createUser({
      username: adminData.username,
      email: adminData.email,
      password: adminData.password, // 会自动被 @BeforeInsert 加密
      displayName: adminData.displayName
    })

    console.log('✅ 管理员用户创建成功!')
    console.log(`   用户ID: ${admin.id}`)
    console.log(`   用户名: ${admin.username}`)
    console.log(`   邮箱: ${admin.email}`)
    console.log(`   状态: ${admin.status}`)
    console.log(`   创建时间: ${admin.createdAt}\n`)

    console.log('🎯 登录信息 (请保存):')
    console.log(`   URL: http://localhost:5174/next/login`)
    console.log(`   用户名: ${adminData.username}`)
    console.log(`   密码: ${adminData.password}\n`)

    await app.close()
  } catch (error) {
    console.error('❌ 创建管理员用户失败:', error.message)
    if (error.detail) {
      console.error('   详细错误:', error.detail)
    }
    process.exit(1)
  }
}

// 如果直接运行这个文件
if (require.main === module) {
  createAdmin()
}
