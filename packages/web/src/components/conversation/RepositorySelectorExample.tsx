import { useState } from 'react'
import { RepositorySelector } from './RepositorySelector'
import type { Repository } from '../../types/api.types'

/**
 * RepositorySelector 组件使用示例
 * 展示如何集成和使用 RepositorySelector 组件
 */
export function RepositorySelectorExample() {
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string>('')

  const handleRepositorySelect = (repositoryId: string, repository: Repository) => {
    console.log('选择的仓库:', { repositoryId, repository })
    setSelectedRepository(repository)
    // 默认选择仓库的默认分支
    setSelectedBranch(repository.branch || 'main')
  }

  const handleBranchSelect = (branch: string) => {
    setSelectedBranch(branch)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          RepositorySelector 使用示例
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 仓库选择器 */}
          <div>
            <RepositorySelector
              selectedRepositoryId={selectedRepository?.id}
              onSelect={handleRepositorySelect}
              showBranches={true}
              disabled={false}
              className="h-fit"
            />
          </div>

          {/* 选择结果显示 */}
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">选择结果</h3>
              
              {selectedRepository ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">仓库名称: </span>
                    <span className="font-medium text-gray-900">{selectedRepository.name}</span>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-600">仓库ID: </span>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {selectedRepository.id}
                    </code>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-600">类型: </span>
                    <span className="text-gray-900">
                      {selectedRepository.type === 'git' ? 'Git仓库' : '本地目录'}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-600">URL: </span>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded break-all">
                      {selectedRepository.url}
                    </code>
                  </div>
                  
                  {selectedRepository.branch && (
                    <div>
                      <span className="text-sm text-gray-600">分支: </span>
                      <span className="text-gray-900">{selectedRepository.branch}</span>
                    </div>
                  )}
                  
                  {selectedRepository.description && (
                    <div>
                      <span className="text-sm text-gray-600">描述: </span>
                      <span className="text-gray-900">{selectedRepository.description}</span>
                    </div>
                  )}
                  
                  <div>
                    <span className="text-sm text-gray-600">状态: </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      selectedRepository.enabled 
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedRepository.enabled ? '已启用' : '已禁用'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">请选择一个仓库</p>
              )}
            </div>

            {/* 分支选择器（可选） */}
            {selectedRepository?.metadata?.lastTestResult?.details?.branches && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">分支选择</h3>
                <div className="space-y-2">
                  <label className="block text-sm text-gray-600">
                    选择分支:
                  </label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => handleBranchSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {selectedRepository.metadata.lastTestResult.details.branches.map(branch => (
                      <option key={branch} value={branch}>
                        {branch}
                        {branch === selectedRepository.metadata?.lastTestResult?.details?.defaultBranch && ' (默认)'}
                      </option>
                    ))}
                  </select>
                  {selectedBranch && (
                    <p className="text-sm text-blue-600">
                      已选择分支: <code className="bg-blue-100 px-2 py-1 rounded">{selectedBranch}</code>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 使用说明 */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">使用说明</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 点击仓库卡片选择仓库</li>
                <li>• 使用搜索框过滤仓库</li>
                <li>• 点击过滤按钮设置类型和状态过滤</li>
                <li>• 点击展开按钮查看详细信息</li>
                <li>• 点击测试连接验证仓库可用性</li>
                <li>• 只有已启用的仓库可以被选择</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}