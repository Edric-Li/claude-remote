/**
 * Playwright 全局清理
 * 清理测试数据和临时文件
 */

import { test as cleanup } from '@playwright/test'
import * as fs from 'fs/promises'
import * as path from 'path'

cleanup('清理测试数据', async () => {
  console.log('🧹 开始清理测试数据...')

  try {
    // 清理认证文件
    const authFile = 'tests/auth/.auth.json'
    try {
      await fs.unlink(authFile)
      console.log('✅ 认证文件已清理')
    } catch (error) {
      // 文件不存在，忽略错误
    }

    // 清理测试数据库文件
    const testDbFile = 'test-database.db'
    try {
      await fs.unlink(testDbFile)
      console.log('✅ 测试数据库已清理')
    } catch (error) {
      // 文件不存在，忽略错误
    }

    // 清理其他临时文件
    const tempFiles = [
      'test-results',
      'playwright-report',
      'coverage'
    ]

    for (const file of tempFiles) {
      try {
        await fs.rm(file, { recursive: true, force: true })
      } catch (error) {
        // 忽略不存在的文件
      }
    }

    console.log('✅ 测试数据清理完成')
  } catch (error) {
    console.error('❌ 清理过程中出现错误:', error)
  }
})