#!/usr/bin/env tsx

/**
 * 验证加密服务功能的脚本
 * 运行方式：npx tsx src/scripts/verify-encryption.ts
 */

import { EncryptionService } from '../services/encryption.service'

// 设置环境变量
process.env.ENCRYPTION_KEY = 'test-encryption-key-for-verification-32-chars'

async function verifyEncryption() {
  console.log('🔐 开始验证加密服务...')
  
  try {
    const encryptionService = new EncryptionService()
    
    // 测试基本加密解密
    console.log('\n✅ 测试基本加密解密功能')
    const testData = [
      'username:password',
      'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
      'test-credentials',
      '中文测试凭据',
      'token-with-special-chars!@#$%^&*()'
    ]
    
    for (const data of testData) {
      const encrypted = encryptionService.encrypt(data)
      const decrypted = encryptionService.decrypt(encrypted)
      
      if (decrypted === data) {
        console.log(`  ✓ "${data}" - 加密解密成功`)
      } else {
        console.log(`  ✗ "${data}" - 加密解密失败`)
        process.exit(1)
      }
    }
    
    // 测试随机IV
    console.log('\n✅ 测试随机IV功能')
    const testText = 'test-random-iv'
    const encrypted1 = encryptionService.encrypt(testText)
    const encrypted2 = encryptionService.encrypt(testText)
    
    if (encrypted1 !== encrypted2) {
      console.log('  ✓ 每次加密产生不同结果（随机IV）')
    } else {
      console.log('  ✗ 随机IV功能失败 - 每次加密结果相同')
      process.exit(1)
    }
    
    // 验证两次加密都能正确解密
    const decrypted1 = encryptionService.decrypt(encrypted1)
    const decrypted2 = encryptionService.decrypt(encrypted2)
    
    if (decrypted1 === testText && decrypted2 === testText) {
      console.log('  ✓ 两次不同加密结果都能正确解密')
    } else {
      console.log('  ✗ 解密失败')
      process.exit(1)
    }
    
    // 测试错误处理
    console.log('\n✅ 测试错误处理')
    
    try {
      encryptionService.encrypt('')
      console.log('  ✗ 应该在加密空字符串时抛出错误')
      process.exit(1)
    } catch (error) {
      console.log('  ✓ 正确处理空字符串加密错误')
    }
    
    try {
      encryptionService.decrypt('invalid-format')
      console.log('  ✗ 应该在解密无效格式时抛出错误')
      process.exit(1)
    } catch (error) {
      console.log('  ✓ 正确处理无效格式解密错误')
    }
    
    console.log('\n🎉 所有测试通过！加密服务工作正常')
    
    // 显示格式示例
    console.log('\n📋 加密格式示例：')
    const sampleEncrypted = encryptionService.encrypt('sample-credentials')
    console.log(`  原文: "sample-credentials"`)
    console.log(`  加密: "${sampleEncrypted}"`)
    console.log(`  格式: [32字符IV]:[加密数据]`)
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  verifyEncryption()
}

export { verifyEncryption }