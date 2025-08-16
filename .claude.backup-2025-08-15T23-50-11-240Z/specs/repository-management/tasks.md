# Repository Management - Implementation Plan

## Task Overview

基于需求和设计文档，将仓库管理功能实现分解为原子级任务。每个任务专注于单一功能，可独立实现和测试，便于代理执行。

## Steering Document Compliance

所有任务遵循项目的技术标准和代码组织规范：
- **TypeScript 严格模式**：所有新代码使用 strict: true
- **模块化设计**：每个文件单一职责，不超过 300 行
- **代码复用**：优先扩展现有组件而非创建新组件
- **测试驱动**：每个功能都包含对应的测试

## Atomic Task Requirements

每个任务都满足以下原子化要求：
- **文件范围**：涉及 1-3 个相关文件
- **时间估算**：15-30 分钟完成
- **单一目的**：一个可测试的功能点
- **明确输入输出**：清晰的文件路径和预期结果
- **最小上下文切换**：减少跨模块依赖

## Task Format Guidelines
- 使用复选框格式：`- [ ] 任务编号. 任务描述`
- **指定文件**：始终包含要创建/修改的确切文件路径
- **包含实施细节**：作为要点列出具体实现内容
- 使用 `_Requirements: X_` 引用具体需求
- 使用 `_Leverage: path/to/file.ts_` 引用要复用的现有代码
- 专注编码任务（不包括部署、用户测试等）
- **避免宽泛术语**：任务标题中不使用"系统"、"集成"、"完整"等词汇

## Tasks

### Phase 1: Backend Core Enhancement

- [x] 1. 创建改进的加密服务类
  - File: packages/server/src/services/improved-encryption.service.ts
  - 使用随机 IV 替换固定 IV，修正安全漏洞
  - 实现 encrypt() 和 decrypt() 方法
  - 添加单元测试验证加密解密功能
  - Purpose: 提供安全的凭据加密存储
  - _Leverage: packages/server/src/services/repository.service.ts 现有加密逻辑_
  - _Requirements: 2.7, 2.8_

- [x] 2. 扩展仓库实体添加元数据字段
  - File: packages/server/src/entities/repository.entity.ts
  - 添加 metadata 字段存储测试结果和分支信息
  - 添加 settings 字段的 retryCount 和 connectionTimeout 属性
  - 更新数据库迁移文件
  - Purpose: 支持连接测试结果缓存和配置选项
  - _Leverage: 扩展现有 RepositoryEntity 结构_
  - _Requirements: 3.2, 4.1_

- [x] 3. 创建审计日志实体
  - File: packages/server/src/entities/audit-log.entity.ts
  - 定义审计日志数据结构和字段
  - 配置与 RepositoryEntity 的关联关系
  - 添加索引优化查询性能
  - Purpose: 记录仓库操作历史
  - _Leverage: 参考现有实体模式_
  - _Requirements: Non-functional Reliability_

- [x] 4. 实现审计日志服务
  - File: packages/server/src/services/audit-log.service.ts
  - 实现 logOperation() 方法记录操作
  - 实现 getAuditLog() 方法获取日志
  - 实现 cleanupOldLogs() 方法清理过期日志
  - Purpose: 提供操作审计功能
  - _Leverage: packages/server/src/services/ 现有服务模式_
  - _Requirements: Non-functional Reliability_

- [x] 5. 添加重试机制方法到仓库服务
  - File: packages/server/src/services/repository.service.ts
  - 添加 testConnectionWithRetry() 方法实现指数退避重试
  - 配置最大重试次数为 3 次，初始延迟 1 秒
  - 实现指数退避算法：delay = Math.pow(2, attempt) * 1000
  - Purpose: 提供带重试的连接测试方法
  - _Leverage: 现有 testConfig 方法作为基础_
  - _Requirements: Requirement 3_

- [x] 6. 集成重试逻辑到现有连接测试
  - File: packages/server/src/services/repository.service.ts
  - 修改 testConnection() 方法调用 testConnectionWithRetry()
  - 添加重试计数和超时配置到 settings 字段
  - 保持向后兼容性，现有 API 继续工作
  - Purpose: 将重试功能集成到现有接口
  - _Leverage: 现有 testConnection 方法_
  - _Requirements: Requirement 3_

- [ ] 7. 实现分支列表解析功能
  - File: packages/server/src/services/repository.service.ts
  - 增强 testConfig() 方法解析 git ls-remote 输出
  - 提取分支名称列表，过滤无效引用
  - 返回清理后的分支名称数组
  - Purpose: 准确解析仓库的可用分支
  - _Leverage: 现有 git ls-remote 逻辑_
  - _Requirements: Requirement 4_

- [ ] 8. 添加智能默认分支选择
  - File: packages/server/src/services/repository.service.ts
  - 实现分支优先级选择：main > master > 第一个可用分支
  - 添加 getDefaultBranch() 私有方法
  - 在测试成功时自动设置默认分支
  - Purpose: 自动选择最合适的默认分支
  - _Leverage: 任务 7 的分支解析结果_
  - _Requirements: Requirement 4_

- [ ] 9. 创建搜索和分页服务
  - File: packages/server/src/services/search-pagination.service.ts
  - 实现 searchRepositories() 方法支持名称和类型搜索
  - 使用 TypeORM QueryBuilder 的 LIKE 查询
  - 添加搜索结果排序和限制
  - Purpose: 提供仓库搜索功能
  - _Leverage: packages/server/src/repositories/ 现有仓库模式_
  - _Requirements: Non-functional Scalability_

- [ ] 10. 添加分页查询方法
  - File: packages/server/src/services/search-pagination.service.ts
  - 实现 getPaginatedList() 方法支持分页查询
  - 配置每页默认 20 个记录，最大 100 个
  - 返回总记录数和页数信息
  - Purpose: 支持大量仓库的分页浏览
  - _Leverage: TypeORM 分页查询模式_
  - _Requirements: Non-functional Scalability_

- [ ] 11. 添加搜索 API 端点
  - File: packages/server/src/controllers/repository.controller.ts
  - 添加 GET /repositories/search 端点
  - 支持 query 参数搜索，type 参数过滤
  - 集成搜索服务，返回搜索结果
  - Purpose: 提供仓库搜索 API
  - _Leverage: 现有 RepositoryController 结构_
  - _Requirements: Non-functional Scalability_

- [ ] 12. 添加分页 API 端点
  - File: packages/server/src/controllers/repository.controller.ts
  - 添加 GET /repositories/paginated 端点
  - 支持 page 和 limit 参数
  - 返回分页数据和元信息
  - Purpose: 提供分页查询 API
  - _Leverage: 现有 RepositoryController 结构_
  - _Requirements: Non-functional Scalability_

- [ ] 13. 添加重试测试 API 端点
  - File: packages/server/src/controllers/repository.controller.ts
  - 添加 POST /repositories/test-connection-retry 端点
  - 调用带重试的连接测试方法
  - 返回重试过程和最终结果
  - Purpose: 提供带重试的连接测试 API
  - _Leverage: 任务 5 的重试方法_
  - _Requirements: Requirement 3_

### Phase 2: Frontend UI Enhancement

- [ ] 14. 创建改进的对话框样式文件
  - File: packages/web/src/components/repository/RepositoryDialog.module.css
  - 实现半透明背景遮罩样式（rgba(0, 0, 0, 0.5)）
  - 添加圆角边框（12px）和阴影效果
  - 实现平滑过渡动画（0.2s ease-out）
  - Purpose: 解决"纯黑背景"界面问题
  - _Leverage: packages/web/src/components/ui/ 现有样式模式_
  - _Requirements: Requirement 6_

- [ ] 15. 创建响应式对话框组件
  - File: packages/web/src/components/repository/RepositoryDialog.tsx
  - 实现响应式布局适配不同屏幕尺寸
  - 添加垂直滚动支持（max-height: 90vh）
  - 集成键盘导航和 ESC 关闭功能
  - Purpose: 提供现代化的对话框用户体验
  - _Leverage: packages/web/src/components/ui/dialog.tsx 基础组件_
  - _Requirements: Requirement 6_

- [ ] 16. 实现动态认证字段组件
  - File: packages/web/src/components/repository/AuthenticationFields.tsx
  - 根据仓库类型动态显示认证字段
  - 实现不同平台的占位符提示（GitHub PAT、GitLab Token 等）
  - 添加认证信息格式验证
  - Purpose: 提供智能的认证信息输入体验
  - _Leverage: packages/web/src/components/ui/input.tsx 等基础组件_
  - _Requirements: Requirement 2_

- [ ] 17. 添加搜索状态管理
  - File: packages/web/src/components/repository/RepositoryManager.tsx
  - 添加搜索查询状态和搜索结果状态
  - 实现防抖搜索输入（300ms 延迟）
  - 添加搜索加载状态指示器
  - Purpose: 管理仓库搜索功能的状态
  - _Leverage: 现有 RepositoryManager 组件状态模式_
  - _Requirements: Non-functional Scalability_

- [ ] 18. 添加分页状态管理
  - File: packages/web/src/components/repository/RepositoryManager.tsx
  - 添加当前页码和总页数状态
  - 实现页码切换和页面大小控制
  - 添加分页加载状态
  - Purpose: 管理分页功能的状态
  - _Leverage: 现有 RepositoryManager 组件状态模式_
  - _Requirements: Non-functional Scalability_

- [ ] 19. 添加连接测试状态管理
  - File: packages/web/src/components/repository/RepositoryManager.tsx
  - 实现连接测试的加载状态和进度显示
  - 添加重试计数和取消功能状态
  - 管理测试结果和错误消息状态
  - Purpose: 管理连接测试功能的状态
  - _Leverage: 现有测试连接逻辑_
  - _Requirements: Requirement 3_

- [ ] 20. 创建搜索输入组件
  - File: packages/web/src/components/repository/SearchInput.tsx
  - 创建搜索输入框和类型过滤器
  - 实现防抖优化搜索输入（300ms 延迟）
  - 添加清空搜索和搜索状态指示
  - Purpose: 提供仓库搜索输入界面
  - _Leverage: packages/web/src/components/ui/input.tsx_
  - _Requirements: Non-functional Scalability_

- [ ] 21. 创建分页控件组件
  - File: packages/web/src/components/repository/PaginationControls.tsx
  - 实现分页控件和页码导航
  - 添加页面大小选择器（10, 20, 50）
  - 显示总记录数和当前页信息
  - Purpose: 提供分页浏览界面
  - _Leverage: packages/web/src/components/ui/ 基础 UI 组件_
  - _Requirements: Non-functional Scalability_

- [ ] 22. 添加连接测试进度指示器
  - File: packages/web/src/components/repository/ConnectionTestIndicator.tsx
  - 实现测试进度的可视化显示（进度条/圆圈）
  - 添加重试计数和剩余时间显示
  - 支持取消正在进行的测试
  - Purpose: 提供连接测试的实时反馈
  - _Leverage: packages/web/src/components/ui/ 现有加载组件_
  - _Requirements: Requirement 3_

### Phase 3: Integration and Testing

- [ ] 23. 创建仓库 CRUD 操作单元测试
  - File: packages/server/src/services/__tests__/repository-crud.test.ts
  - 测试 create, findAll, update, delete 方法
  - 模拟数据库操作和异常情况
  - 验证数据验证和业务逻辑
  - Purpose: 确保 CRUD 操作的可靠性
  - _Leverage: 现有测试工具和模式_
  - _Requirements: Requirement 1_

- [ ] 24. 创建连接测试功能单元测试
  - File: packages/server/src/services/__tests__/connection-test.test.ts
  - 测试连接重试机制和错误处理
  - 模拟网络超时和认证失败场景
  - 验证重试次数和退避策略
  - Purpose: 确保连接测试的可靠性
  - _Leverage: 现有测试框架_
  - _Requirements: Requirement 3_

- [ ] 25. 创建加密解密功能单元测试
  - File: packages/server/src/services/__tests__/encryption.test.ts
  - 测试改进的加密解密功能
  - 验证随机 IV 生成和安全性
  - 测试加密数据的向后兼容性
  - Purpose: 确保数据安全存储
  - _Leverage: 现有测试框架_
  - _Requirements: Requirement 2_

- [ ] 16. 创建前端组件集成测试
  - File: packages/web/src/components/repository/__tests__/RepositoryManager.test.tsx
  - 测试完整的 CRUD 操作流程
  - 测试对话框的打开关闭和表单验证
  - 测试连接测试和错误显示
  - Purpose: 确保前端用户交互的正确性
  - _Leverage: 现有前端测试框架_
  - _Requirements: All frontend requirements_

- [ ] 17. 实现 React 仓库测试用例
  - File: packages/server/src/services/__tests__/react-repo.integration.test.ts
  - 使用 React 仓库 URL 测试公共仓库访问
  - 验证分支列表获取和默认分支选择
  - 测试大型仓库的性能表现
  - Purpose: 验证系统对大型公共仓库的支持
  - _Leverage: 现有集成测试框架_
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 18. 创建 API 端点集成测试
  - File: packages/server/src/controllers/__tests__/repository.controller.integration.test.ts
  - 测试所有 API 端点的请求响应
  - 测试认证和权限控制
  - 测试错误处理和状态码
  - Purpose: 确保 API 接口的完整性和正确性
  - _Leverage: 现有 API 测试工具_
  - _Requirements: All API requirements_

### Phase 4: Advanced Features and Optimization

- [ ] 19. 实现数据库索引优化
  - File: packages/server/src/migrations/add-repository-indexes.migration.ts
  - 为搜索字段（name, type, url）添加索引
  - 为审计日志表添加时间戳索引
  - 优化查询性能
  - Purpose: 提高大量数据时的查询性能
  - _Leverage: 现有数据库迁移模式_
  - _Requirements: Non-functional Performance_

- [ ] 20. 添加操作日志中间件
  - File: packages/server/src/middleware/audit-logging.middleware.ts
  - 自动记录仓库相关的操作日志
  - 提取用户信息和 IP 地址
  - 脱敏敏感信息
  - Purpose: 自动化审计日志记录
  - _Leverage: packages/server/src/modules/auth/ 现有中间件模式_
  - _Requirements: Non-functional Reliability_

- [ ] 21. 实现缓存机制
  - File: packages/server/src/services/repository-cache.service.ts
  - 缓存连接测试结果（5分钟有效期）
  - 实现缓存键管理和过期清理
  - 提供缓存统计信息
  - Purpose: 减少重复的网络连接测试
  - _Leverage: 现有服务模式_
  - _Requirements: Non-functional Performance_

- [ ] 22. 添加批量操作功能
  - File: packages/web/src/components/repository/BatchOperations.tsx
  - 实现批量选择和操作界面
  - 支持批量测试连接
  - 添加批量删除确认
  - Purpose: 提高批量管理效率
  - _Leverage: packages/web/src/components/ui/ 基础组件_
  - _Requirements: Extension of core CRUD_

- [ ] 23. 创建端到端测试套件
  - File: packages/web/src/__tests__/e2e/repository-management.e2e.test.ts
  - 测试完整的用户操作流程
  - 测试不同认证方式的端到端流程
  - 测试错误恢复和重试机制
  - Purpose: 验证整个功能的端到端可用性
  - _Leverage: 现有 E2E 测试框架_
  - _Requirements: All requirements end-to-end_

- [ ] 24. 性能监控和优化
  - File: packages/server/src/services/repository-monitor.service.ts
  - 监控 API 响应时间和成功率
  - 收集连接测试性能指标
  - 提供性能报告接口
  - Purpose: 确保系统性能符合要求
  - _Leverage: 现有监控基础设施_
  - _Requirements: Non-functional Performance Benchmarks_