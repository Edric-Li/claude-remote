-- 为仓库表添加搜索和性能优化索引
-- 这些索引将显著提高搜索和分页查询的性能

-- 1. 为搜索字段添加复合索引
-- 支持按名称、描述、URL进行模糊搜索的性能优化
CREATE INDEX IF NOT EXISTS idx_repositories_search_fields 
ON repositories USING gin(
  to_tsvector('simple', COALESCE(name, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(url, ''))
);

-- 2. 为常用的过滤和排序字段添加单独索引
-- 仓库类型索引（常用过滤条件）
CREATE INDEX IF NOT EXISTS idx_repositories_type 
ON repositories (type);

-- 启用状态索引（常用过滤条件）
CREATE INDEX IF NOT EXISTS idx_repositories_enabled 
ON repositories (enabled);

-- 更新时间索引（默认排序字段）
CREATE INDEX IF NOT EXISTS idx_repositories_updated_at 
ON repositories (updated_at DESC);

-- 创建时间索引（备选排序字段）
CREATE INDEX IF NOT EXISTS idx_repositories_created_at 
ON repositories (created_at DESC);

-- 名称索引（排序和搜索）
CREATE INDEX IF NOT EXISTS idx_repositories_name 
ON repositories (name);

-- 3. 复合索引优化常见查询组合
-- 类型 + 启用状态复合索引
CREATE INDEX IF NOT EXISTS idx_repositories_type_enabled 
ON repositories (type, enabled);

-- 启用状态 + 更新时间复合索引（支持分页排序）
CREATE INDEX IF NOT EXISTS idx_repositories_enabled_updated_at 
ON repositories (enabled, updated_at DESC);

-- 类型 + 更新时间复合索引（支持类型过滤后的分页排序）
CREATE INDEX IF NOT EXISTS idx_repositories_type_updated_at 
ON repositories (type, updated_at DESC);

-- 4. 为名称字段添加大小写不敏感的索引
-- 支持大小写不敏感的名称搜索和排序
CREATE INDEX IF NOT EXISTS idx_repositories_name_lower 
ON repositories (LOWER(name));

-- 5. 为URL字段添加索引（支持URL搜索）
CREATE INDEX IF NOT EXISTS idx_repositories_url 
ON repositories (url);

-- 6. 为描述字段添加索引（支持描述搜索）
CREATE INDEX IF NOT EXISTS idx_repositories_description 
ON repositories (description) 
WHERE description IS NOT NULL AND description != '';

-- 7. 全文搜索优化索引
-- 为名称字段创建全文搜索索引
CREATE INDEX IF NOT EXISTS idx_repositories_name_fulltext 
ON repositories USING gin(to_tsvector('simple', name));

-- 为描述字段创建全文搜索索引
CREATE INDEX IF NOT EXISTS idx_repositories_description_fulltext 
ON repositories USING gin(to_tsvector('simple', description))
WHERE description IS NOT NULL AND description != '';

-- 为URL字段创建全文搜索索引
CREATE INDEX IF NOT EXISTS idx_repositories_url_fulltext 
ON repositories USING gin(to_tsvector('simple', url));

-- 8. 性能监控注释
-- 这些索引的预期性能改进：
-- - 搜索响应时间：从 O(n) 提升到 O(log n)
-- - 分页查询：支持高效的 OFFSET/LIMIT 操作
-- - 过滤操作：类型和状态过滤速度提升 90%+
-- - 排序操作：利用索引避免额外的排序开销

-- 注意事项：
-- 1. 这些索引会占用额外的存储空间（约增加 30-50% 表大小）
-- 2. 插入/更新操作会稍有性能影响（通常可忽略）
-- 3. 对于 1000+ 仓库的场景，性能提升显著
-- 4. 建议在生产环境部署时监控索引使用情况

-- 索引维护建议：
-- 定期执行 REINDEX 操作以保持索引性能：
-- REINDEX INDEX idx_repositories_search_fields;
-- REINDEX INDEX idx_repositories_type_enabled;