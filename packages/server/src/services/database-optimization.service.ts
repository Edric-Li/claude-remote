import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

/**
 * 数据库优化服务
 * 负责管理搜索索引和查询性能优化
 */
@Injectable()
export class DatabaseOptimizationService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource
  ) {}

  /**
   * 创建仓库搜索相关的索引
   * 这些索引将显著提高搜索和分页查询的性能
   */
  async createRepositorySearchIndexes(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner()
    
    try {
      await queryRunner.connect()
      
      console.log('开始创建仓库搜索索引...')
      
      // 1. 全文搜索复合索引
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_search_fields 
        ON repositories USING gin(
          to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(url, ''))
        )
      `)
      console.log('✓ 创建全文搜索复合索引')

      // 2. 常用过滤字段索引
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_type 
        ON repositories (type)
      `)
      console.log('✓ 创建类型字段索引')

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_enabled 
        ON repositories (enabled)
      `)
      console.log('✓ 创建启用状态索引')

      // 3. 排序字段索引
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_updated_at 
        ON repositories (updated_at DESC)
      `)
      console.log('✓ 创建更新时间索引')

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_created_at 
        ON repositories (created_at DESC)
      `)
      console.log('✓ 创建创建时间索引')

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_name 
        ON repositories (name)
      `)
      console.log('✓ 创建名称字段索引')

      // 4. 复合索引优化
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_type_enabled 
        ON repositories (type, enabled)
      `)
      console.log('✓ 创建类型+启用状态复合索引')

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_enabled_updated_at 
        ON repositories (enabled, updated_at DESC)
      `)
      console.log('✓ 创建启用状态+更新时间复合索引')

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_type_updated_at 
        ON repositories (type, updated_at DESC)
      `)
      console.log('✓ 创建类型+更新时间复合索引')

      // 5. 大小写不敏感搜索索引
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_name_lower 
        ON repositories (LOWER(name))
      `)
      console.log('✓ 创建名称小写索引')

      // 6. 单字段全文搜索索引
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_name_fulltext 
        ON repositories USING gin(to_tsvector('simple', name))
      `)
      console.log('✓ 创建名称全文搜索索引')

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_description_fulltext 
        ON repositories USING gin(to_tsvector('simple', description))
        WHERE description IS NOT NULL AND description != ''
      `)
      console.log('✓ 创建描述全文搜索索引')

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_repositories_url_fulltext 
        ON repositories USING gin(to_tsvector('simple', url))
      `)
      console.log('✓ 创建URL全文搜索索引')

      console.log('所有仓库搜索索引创建完成！')
      
    } catch (error) {
      console.error('创建索引时发生错误:', error)
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * 删除仓库搜索索引
   * 用于回滚或重建索引
   */
  async dropRepositorySearchIndexes(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner()
    
    try {
      await queryRunner.connect()
      
      console.log('开始删除仓库搜索索引...')
      
      const indexes = [
        'idx_repositories_search_fields',
        'idx_repositories_type',
        'idx_repositories_enabled',
        'idx_repositories_updated_at',
        'idx_repositories_created_at',
        'idx_repositories_name',
        'idx_repositories_type_enabled',
        'idx_repositories_enabled_updated_at',
        'idx_repositories_type_updated_at',
        'idx_repositories_name_lower',
        'idx_repositories_name_fulltext',
        'idx_repositories_description_fulltext',
        'idx_repositories_url_fulltext'
      ]

      for (const indexName of indexes) {
        await queryRunner.query(`DROP INDEX IF EXISTS ${indexName}`)
        console.log(`✓ 删除索引 ${indexName}`)
      }

      console.log('所有仓库搜索索引删除完成！')
      
    } catch (error) {
      console.error('删除索引时发生错误:', error)
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * 重建仓库搜索索引
   * 用于性能优化和索引维护
   */
  async rebuildRepositorySearchIndexes(): Promise<void> {
    console.log('开始重建仓库搜索索引...')
    
    await this.dropRepositorySearchIndexes()
    await this.createRepositorySearchIndexes()
    
    console.log('仓库搜索索引重建完成！')
  }

  /**
   * 获取索引使用统计信息
   * 用于性能监控和优化分析
   */
  async getIndexStatistics(): Promise<any[]> {
    const queryRunner = this.dataSource.createQueryRunner()
    
    try {
      await queryRunner.connect()
      
      const query = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes 
        WHERE tablename = 'repositories'
        ORDER BY idx_scan DESC
      `
      
      const result = await queryRunner.query(query)
      return result
      
    } catch (error) {
      console.error('获取索引统计信息时发生错误:', error)
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * 获取表统计信息
   * 用于性能监控
   */
  async getTableStatistics(): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner()
    
    try {
      await queryRunner.connect()
      
      const query = `
        SELECT 
          relname as table_name,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_tup_hot_upd as hot_updates,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables 
        WHERE relname = 'repositories'
      `
      
      const result = await queryRunner.query(query)
      return result[0] || null
      
    } catch (error) {
      console.error('获取表统计信息时发生错误:', error)
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * 分析查询性能
   * 用于优化查询语句
   */
  async analyzeQueryPerformance(query: string): Promise<any[]> {
    const queryRunner = this.dataSource.createQueryRunner()
    
    try {
      await queryRunner.connect()
      
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS) ${query}`
      const result = await queryRunner.query(explainQuery)
      return result
      
    } catch (error) {
      console.error('分析查询性能时发生错误:', error)
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * 维护数据库统计信息
   * 定期执行以确保查询优化器有最新的统计信息
   */
  async maintainStatistics(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner()
    
    try {
      await queryRunner.connect()
      
      console.log('开始维护数据库统计信息...')
      
      // 分析repositories表
      await queryRunner.query('ANALYZE repositories')
      console.log('✓ 已分析repositories表')
      
      // 重建索引统计信息
      await queryRunner.query('REINDEX TABLE repositories')
      console.log('✓ 已重建repositories表索引')
      
      console.log('数据库统计信息维护完成！')
      
    } catch (error) {
      console.error('维护数据库统计信息时发生错误:', error)
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * 检查索引是否存在
   */
  async checkIndexExists(indexName: string): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner()
    
    try {
      await queryRunner.connect()
      
      const query = `
        SELECT EXISTS (
          SELECT 1 
          FROM pg_indexes 
          WHERE indexname = $1
        ) as exists
      `
      
      const result = await queryRunner.query(query, [indexName])
      return result[0]?.exists || false
      
    } catch (error) {
      console.error('检查索引是否存在时发生错误:', error)
      return false
    } finally {
      await queryRunner.release()
    }
  }

  /**
   * 获取索引大小信息
   */
  async getIndexSizes(): Promise<any[]> {
    const queryRunner = this.dataSource.createQueryRunner()
    
    try {
      await queryRunner.connect()
      
      const query = `
        SELECT 
          indexname,
          pg_size_pretty(pg_relation_size(indexname::regclass)) as size
        FROM pg_indexes 
        WHERE tablename = 'repositories'
        ORDER BY pg_relation_size(indexname::regclass) DESC
      `
      
      const result = await queryRunner.query(query)
      return result
      
    } catch (error) {
      console.error('获取索引大小信息时发生错误:', error)
      throw error
    } finally {
      await queryRunner.release()
    }
  }
}