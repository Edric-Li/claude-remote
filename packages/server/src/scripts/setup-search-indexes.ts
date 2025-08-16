#!/usr/bin/env node

/**
 * 搜索索引设置脚本
 * 用于初始化或维护仓库搜索相关的数据库索引
 * 
 * 使用方法：
 * npm run setup-search-indexes
 * 或
 * ts-node src/scripts/setup-search-indexes.ts
 */

import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { DatabaseOptimizationService } from '../services/database-optimization.service'

async function setupSearchIndexes() {
  console.log('🚀 开始设置仓库搜索索引...')
  
  const app = await NestFactory.createApplicationContext(AppModule)
  
  try {
    const dbOptimizationService = app.get(DatabaseOptimizationService)
    
    // 检查命令行参数
    const args = process.argv.slice(2)
    const command = args[0]
    
    switch (command) {
      case 'create':
        console.log('📝 创建搜索索引...')
        await dbOptimizationService.createRepositorySearchIndexes()
        break
        
      case 'drop':
        console.log('🗑️ 删除搜索索引...')
        await dbOptimizationService.dropRepositorySearchIndexes()
        break
        
      case 'rebuild':
        console.log('🔄 重建搜索索引...')
        await dbOptimizationService.rebuildRepositorySearchIndexes()
        break
        
      case 'stats':
        console.log('📊 获取索引统计信息...')
        const indexStats = await dbOptimizationService.getIndexStatistics()
        console.log('索引使用统计：')
        console.table(indexStats)
        
        const tableStats = await dbOptimizationService.getTableStatistics()
        console.log('表统计信息：')
        console.log(tableStats)
        
        const indexSizes = await dbOptimizationService.getIndexSizes()
        console.log('索引大小信息：')
        console.table(indexSizes)
        break
        
      case 'maintain':
        console.log('🔧 维护数据库统计信息...')
        await dbOptimizationService.maintainStatistics()
        break
        
      case 'check':
        console.log('🔍 检查索引状态...')
        const indexesToCheck = [
          'idx_repositories_search_fields',
          'idx_repositories_type',
          'idx_repositories_enabled',
          'idx_repositories_updated_at',
          'idx_repositories_name',
          'idx_repositories_type_enabled'
        ]
        
        for (const indexName of indexesToCheck) {
          const exists = await dbOptimizationService.checkIndexExists(indexName)
          console.log(`${exists ? '✅' : '❌'} ${indexName}`)
        }
        break
        
      default:
        console.log('📋 可用命令：')
        console.log('  create  - 创建搜索索引')
        console.log('  drop    - 删除搜索索引')
        console.log('  rebuild - 重建搜索索引')
        console.log('  stats   - 显示索引统计信息')
        console.log('  maintain- 维护数据库统计信息')
        console.log('  check   - 检查索引状态')
        console.log('')
        console.log('使用示例：')
        console.log('  npm run setup-search-indexes create')
        console.log('  npm run setup-search-indexes stats')
        
        // 默认执行创建操作
        console.log('')
        console.log('🔧 默认执行创建索引操作...')
        await dbOptimizationService.createRepositorySearchIndexes()
        break
    }
    
    console.log('✅ 操作完成！')
    
  } catch (error) {
    console.error('❌ 操作失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await app.close()
  }
}

// 性能测试函数
async function performanceTest() {
  console.log('🚀 开始性能测试...')
  
  const app = await NestFactory.createApplicationContext(AppModule)
  
  try {
    const dbOptimizationService = app.get(DatabaseOptimizationService)
    
    // 测试查询
    const testQueries = [
      // 基本搜索查询
      `SELECT * FROM repositories WHERE LOWER(name) LIKE LOWER('%test%') ORDER BY updated_at DESC LIMIT 20`,
      
      // 复合条件查询
      `SELECT * FROM repositories WHERE type = 'git' AND enabled = true ORDER BY updated_at DESC LIMIT 20`,
      
      // 全文搜索查询
      `SELECT * FROM repositories WHERE to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(url, '')) @@ to_tsquery('simple', 'test') ORDER BY updated_at DESC LIMIT 20`,
      
      // 分页查询
      `SELECT * FROM repositories ORDER BY updated_at DESC LIMIT 20 OFFSET 100`
    ]
    
    for (let i = 0; i < testQueries.length; i++) {
      console.log(`\n测试查询 ${i + 1}:`)
      console.log(testQueries[i])
      console.log('执行计划:')
      
      const plan = await dbOptimizationService.analyzeQueryPerformance(testQueries[i])
      plan.forEach(row => {
        console.log(row['QUERY PLAN'])
      })
    }
    
  } catch (error) {
    console.error('❌ 性能测试失败:', error.message)
    process.exit(1)
  } finally {
    await app.close()
  }
}

// 检查是否是性能测试模式
if (process.argv.includes('--performance-test')) {
  performanceTest()
} else {
  setupSearchIndexes()
}