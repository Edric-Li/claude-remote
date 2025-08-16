# 重试测试 API 端点文档

本文档描述了新增的重试测试相关API端点，用于增强仓库连接测试的重试功能。

## 概述

重试测试API提供了完善的重试机制，包括：
- 批量重试测试多个仓库
- 重试统计和监控
- 重试配置管理
- 重试历史查询

所有API都遵循Requirement 3：网络连接超时时自动重试最多3次，使用指数退避策略。

## API 端点

### 1. 获取默认重试配置

**端点**: `GET /api/repositories/retry/config`

**描述**: 获取系统默认的重试配置参数

**响应**:
```json
{
  "maxRetries": 3,
  "baseDelay": 1000,
  "maxDelay": 15000,
  "totalTimeout": 15000,
  "retryableErrors": [
    "timeout",
    "network", 
    "connection_reset",
    "dns_resolution",
    "unknown"
  ]
}
```

### 2. 更新默认重试配置

**端点**: `PUT /api/repositories/retry/config`

**描述**: 更新系统默认的重试配置

**请求体**:
```json
{
  "maxRetries": 5,
  "baseDelay": 2000,
  "maxDelay": 20000,
  "totalTimeout": 30000,
  "retryableErrors": ["timeout", "network"]
}
```

**响应**: 更新后的完整配置

### 3. 获取重试统计

**端点**: `GET /api/repositories/retry/statistics`

**查询参数**:
- `repositoryId` (可选): 特定仓库ID
- `startDate` (可选): 开始日期
- `endDate` (可选): 结束日期  
- `limit` (可选): 限制结果数量，默认50

**响应**:
```json
{
  "summary": {
    "totalRetries": 25,
    "successfulRetries": 20,
    "failedRetries": 5,
    "averageRetryCount": 1.8,
    "mostCommonErrors": [
      { "errorType": "timeout", "count": 15 },
      { "errorType": "network", "count": 8 }
    ]
  },
  "recentRetries": [
    {
      "repositoryId": "repo-123",
      "repositoryName": "test-repo",
      "timestamp": "2025-08-16T01:00:00.000Z",
      "success": true,
      "retryCount": 2,
      "errorType": "timeout",
      "duration": 3500
    }
  ]
}
```

### 4. 批量重试测试

**端点**: `POST /api/repositories/batch/test-with-retry`

**描述**: 批量测试多个仓库的连接，支持重试机制

**请求体**:
```json
{
  "repositoryIds": ["repo-1", "repo-2", "repo-3"],
  "retryConfig": {
    "maxRetries": 2,
    "baseDelay": 1000,
    "maxDelay": 5000
  },
  "stopOnFirstFailure": false
}
```

**响应**:
```json
{
  "success": true,
  "results": [
    {
      "repositoryId": "repo-1",
      "repositoryName": "测试仓库1",
      "success": true,
      "result": {
        "success": true,
        "message": "连接成功",
        "timestamp": "2025-08-16T01:00:00.000Z",
        "retryCount": 1,
        "retryDetails": [...]
      }
    }
  ],
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1,
    "skipped": 0
  }
}
```

### 5. 获取仓库重试历史

**端点**: `GET /api/repositories/:id/retry/history`

**描述**: 获取特定仓库的重试历史记录

**路径参数**:
- `id`: 仓库ID

**查询参数**:
- `startDate` (可选): 开始日期
- `endDate` (可选): 结束日期
- `limit` (可选): 限制结果数量

**响应**: 与重试统计相同格式，但只包含指定仓库的数据

## 现有重试端点

### 6. 配置重试测试

**端点**: `POST /api/repositories/test-config-with-retry`

**描述**: 测试仓库配置，支持重试机制，不保存到数据库

### 7. 单个仓库重试测试

**端点**: `POST /api/repositories/:id/test-with-retry`

**描述**: 测试已保存仓库的连接，支持重试机制

## 重试策略

### 指数退避算法

重试延迟计算公式：
```
delay = min(baseDelay * 2^attempt, maxDelay)
```

### 可重试错误类型

- `timeout`: 连接超时
- `network`: 网络错误
- `connection_reset`: 连接重置
- `dns_resolution`: DNS解析失败
- `unknown`: 未知错误

### 不可重试错误类型

- `auth`: 认证失败
- `not_found`: 仓库不存在
- `permission_denied`: 权限拒绝
- `invalid_format`: 格式无效

## 使用示例

### cURL示例

```bash
# 获取重试配置
curl -X GET http://localhost:3000/api/repositories/retry/config \
  -H "Authorization: Bearer YOUR_TOKEN"

# 批量重试测试
curl -X POST http://localhost:3000/api/repositories/batch/test-with-retry \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryIds": ["repo-1", "repo-2"],
    "retryConfig": {"maxRetries": 2},
    "stopOnFirstFailure": false
  }'

# 获取重试统计
curl -X GET "http://localhost:3000/api/repositories/retry/statistics?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 错误处理

所有端点都返回标准的HTTP状态码：

- `200`: 成功
- `400`: 请求参数错误
- `401`: 未授权
- `404`: 资源不存在
- `500`: 服务器内部错误

错误响应格式：
```json
{
  "statusCode": 400,
  "message": "错误描述",
  "error": "Bad Request"
}
```

## 安全性

- 所有端点都需要JWT认证
- 重试配置更新需要适当的权限
- 敏感信息在日志中会被屏蔽

## 性能考虑

- 批量测试限制最大仓库数量
- 重试统计默认限制50条记录
- 使用分页来处理大量数据
- 异步处理避免阻塞主线程