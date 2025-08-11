/**
 * Playwright 全局设置
 * 创建测试用户和初始化数据
 */

import { test as setup, expect } from '@playwright/test'
import { createTestUser, waitForServices } from '../utils/test-helpers'

const authFile = 'tests/auth/.auth.json'

setup('创建测试用户和认证状态', async ({ request }) => {
  console.log('🚀 开始 E2E 测试设置...')

  // 等待服务启动
  await waitForServices()

  // 创建测试用户并获取认证token
  const authData = await createTestUser(request)
  
  // 保存认证状态
  await require('fs').promises.writeFile(authFile, JSON.stringify(authData), 'utf8')
  
  console.log('✅ 测试用户创建成功，认证状态已保存')
})