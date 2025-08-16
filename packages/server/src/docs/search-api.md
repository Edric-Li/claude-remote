# 仓库搜索 API 文档

## 概述

仓库管理系统提供了完整的搜索功能，支持多种搜索模式和高级过滤条件。所有搜索端点都支持分页、排序和缓存优化。

## 认证

所有搜索端点都需要 JWT 认证。请在请求头中包含有效的认证 token：

```
Authorization: Bearer <your-jwt-token>
```

## 搜索端点

### 1. 基础搜索

**端点**: `GET /api/repositories/search`

**描述**: 基础搜索功能，支持按名称、描述、URL搜索，以及类型和启用状态过滤。

**查询参数**:
- `query` (string, 可选): 搜索关键词，会在名称、描述、URL中搜索
- `type` (string, 可选): 仓库类型过滤 (`git` | `local` | `svn`)
- `enabled` (boolean, 可选): 启用状态过滤
- `page` (number, 可选): 页码，默认 1
- `limit` (number, 可选): 每页数量，默认 20，最大 100
- `sortBy` (string, 可选): 排序字段，默认 `updatedAt`
- `sortOrder` (string, 可选): 排序方向 (`ASC` | `DESC`)，默认 `DESC`

**示例**:
```bash
GET /api/repositories/search?query=react&type=git&enabled=true&page=1&limit=10
```

### 2. 高级搜索

**端点**: `GET /api/repositories/search/advanced`

**描述**: 高级搜索功能，支持更复杂的搜索条件。

**查询参数**:
- 包含基础搜索的所有参数，以及：
- `branch` (string, 可选): 分支名称搜索
- `excludeQuery` (string, 可选): 排除的搜索关键词
- `types` (string[], 可选): 多个仓库类型过滤
- `createdAfter` (string, 可选): 创建时间下限 (ISO 8601)
- `createdBefore` (string, 可选): 创建时间上限 (ISO 8601)
- `updatedAfter` (string, 可选): 更新时间下限 (ISO 8601)
- `updatedBefore` (string, 可选): 更新时间上限 (ISO 8601)
- `hasCredentials` (boolean, 可选): 是否有凭据

**示例**:
```bash
GET /api/repositories/search/advanced?query=api&excludeQuery=test&types=git,local&createdAfter=2024-01-01&hasCredentials=true
```

### 3. 全文搜索

**端点**: `GET /api/repositories/search/fulltext`

**描述**: 全文搜索，支持相关性评分和多词搜索。

**查询参数**:
- `q` (string, 必需): 搜索文本，支持多个词语
- `page` (number, 可选): 页码
- `limit` (number, 可选): 每页数量
- `sortBy` (string, 可选): 排序字段
- `sortOrder` (string, 可选): 排序方向

**特性**:
- 支持多词搜索
- 基于相关性评分排序
- 不同字段有不同权重（名称权重最高）

**示例**:
```bash
GET /api/repositories/search/fulltext?q=react typescript&page=1&limit=10
```

### 4. 模糊搜索

**端点**: `GET /api/repositories/search/fuzzy`

**描述**: 模糊搜索，使用相似度算法查找类似的结果。

**查询参数**:
- `q` (string, 必需): 搜索文本
- `threshold` (number, 可选): 相似度阈值 (0-1)，默认 0.3
- `page` (number, 可选): 页码
- `limit` (number, 可选): 每页数量
- `sortBy` (string, 可选): 排序字段
- `sortOrder` (string, 可选): 排序方向

**特性**:
- 容错搜索，能找到拼写错误的结果
- 基于 Levenshtein 距离算法
- 支持相似度阈值控制

**示例**:
```bash
GET /api/repositories/search/fuzzy?q=reakt&threshold=0.5&page=1&limit=10
```

### 5. 批量搜索

**端点**: `POST /api/repositories/search/batch`

**描述**: 批量执行多个搜索查询。

**请求体**:
```json
[
  {
    "query": "react",
    "type": "git",
    "page": 1,
    "limit": 5
  },
  {
    "query": "vue",
    "type": "git", 
    "enabled": true,
    "page": 1,
    "limit": 5
  }
]
```

**限制**:
- 最多支持 10 个并发查询
- 每个查询都支持基础搜索的所有参数

### 6. 搜索建议

**端点**: `GET /api/repositories/search/suggestions`

**描述**: 获取搜索建议（自动补全）。

**查询参数**:
- `query` (string, 必需): 搜索关键词，最少 2 个字符
- `field` (string, 可选): 搜索字段 (`name` | `description` | `url`)，默认 `name`
- `limit` (number, 可选): 返回数量，默认 10，最大 50

**示例**:
```bash
GET /api/repositories/search/suggestions?query=re&field=name&limit=5
```

### 7. 搜索统计

**端点**: `GET /api/repositories/search/statistics`

**描述**: 获取搜索结果统计信息。

**查询参数**:
- 支持基础搜索的过滤参数 (`query`, `type`, `enabled`)

**响应**:
```json
{
  "total": 156,
  "byType": {
    "git": 120,
    "local": 30,
    "svn": 6
  },
  "byEnabled": {
    "enabled": 140,
    "disabled": 16
  }
}
```

## 兼容性端点

### 向后兼容搜索

**端点**: `GET /api/repositories/search-v2`

**描述**: 保持向后兼容的搜索端点，使用查询参数而非 DTO 验证。

## 响应格式

### 分页响应

所有分页端点都返回统一的分页响应格式：

```json
{
  "data": [...],
  "total": 156,
  "page": 1,
  "limit": 20,
  "totalPages": 8,
  "hasNext": true,
  "hasPrev": false,
  "searchCriteria": {
    "query": "react",
    "type": "git",
    "enabled": true
  }
}
```

### 错误响应

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

## 性能优化

### 缓存机制

- 搜索结果会缓存 5 分钟
- 相同的搜索条件会直接返回缓存结果
- 自动清理过期缓存

### 查询优化

- 使用数据库索引优化搜索性能
- 支持最多 1000 个仓库的高效搜索
- 使用 TypeORM 查询构建器进行 SQL 优化

### 限制和约束

- 搜索关键词最大长度：100 字符
- 每页最大记录数：100 条
- 批量搜索最大查询数：10 个
- 搜索建议最大返回数：50 条

## 安全性

- 所有端点都需要 JWT 认证
- 敏感信息（如凭据）在响应中被隐藏
- 输入验证防止 SQL 注入
- 查询参数长度限制防止 DoS 攻击

## 使用建议

1. **基础搜索**: 适用于大多数场景，简单高效
2. **高级搜索**: 需要复杂过滤条件时使用
3. **全文搜索**: 需要相关性排序时使用
4. **模糊搜索**: 用户可能输入错误时使用
5. **批量搜索**: 需要同时执行多个搜索时使用

## 示例代码

### JavaScript/TypeScript

```typescript
// 基础搜索
const response = await fetch('/api/repositories/search?query=react&type=git', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const data = await response.json();

// 批量搜索
const batchResponse = await fetch('/api/repositories/search/batch', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify([
    { query: 'react', type: 'git' },
    { query: 'vue', type: 'git' }
  ])
});
const batchData = await batchResponse.json();
```

### cURL

```bash
# 基础搜索
curl -H "Authorization: Bearer $TOKEN" \
     "https://api.example.com/api/repositories/search?query=react&type=git"

# 高级搜索
curl -H "Authorization: Bearer $TOKEN" \
     "https://api.example.com/api/repositories/search/advanced?query=api&excludeQuery=test&hasCredentials=true"

# 批量搜索
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '[{"query": "react", "type": "git"}, {"query": "vue", "type": "git"}]' \
     "https://api.example.com/api/repositories/search/batch"
```