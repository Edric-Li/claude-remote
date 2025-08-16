import { useState } from 'react'
import PaginationControls, { type PaginationState } from './PaginationControls'

/**
 * PaginationControls 组件使用示例
 * 
 * 此示例展示了如何在不同场景下使用 PaginationControls 组件
 */
export function PaginationControlsExample() {
  // 基础分页状态示例
  const [basicPagination, setBasicPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 20,
    totalPages: 10,
    totalItems: 200,
    loading: false,
    error: null
  })

  // 加载状态示例
  const [loadingPagination, setLoadingPagination] = useState<PaginationState>({
    currentPage: 2,
    pageSize: 10,
    totalPages: 5,
    totalItems: 50,
    loading: true,
    error: null
  })

  // 错误状态示例
  const [errorPagination, setErrorPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
    loading: false,
    error: '加载数据失败，请重试'
  })

  // 处理页面变化
  const handleBasicPageChange = (page: number) => {
    setBasicPagination(prev => ({ ...prev, currentPage: page }))
    console.log('Basic pagination: 跳转到第', page, '页')
  }

  // 处理页面大小变化
  const handleBasicPageSizeChange = (pageSize: number) => {
    setBasicPagination(prev => ({
      ...prev,
      pageSize,
      currentPage: 1, // 重置到第一页
      totalPages: Math.ceil(prev.totalItems / pageSize)
    }))
    console.log('Basic pagination: 页面大小改为', pageSize)
  }

  const handleLoadingPageChange = (page: number) => {
    console.log('Loading pagination: 尝试跳转到第', page, '页（被禁用）')
  }

  const handleLoadingPageSizeChange = (pageSize: number) => {
    console.log('Loading pagination: 尝试改变页面大小为', pageSize, '（被禁用）')
  }

  const handleErrorPageChange = (page: number) => {
    console.log('Error pagination: 跳转到第', page, '页')
  }

  const handleErrorPageSizeChange = (pageSize: number) => {
    console.log('Error pagination: 页面大小改为', pageSize)
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">PaginationControls 组件示例</h1>
      
      <div className="space-y-6">
        {/* 基础用法 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">基础用法</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                标准的分页控件，包含页面导航、页面大小选择器和信息显示
              </p>
            </div>
            <PaginationControls
              paginationState={basicPagination}
              onPageChange={handleBasicPageChange}
              onPageSizeChange={handleBasicPageSizeChange}
              itemType="项目"
            />
          </div>
        </section>

        {/* 加载状态 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">加载状态</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                当 loading 为 true 时，显示加载指示器并禁用所有控件
              </p>
            </div>
            <PaginationControls
              paginationState={loadingPagination}
              onPageChange={handleLoadingPageChange}
              onPageSizeChange={handleLoadingPageSizeChange}
              itemType="文件"
            />
          </div>
        </section>

        {/* 错误状态 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">错误状态</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                当 error 不为空时，显示错误信息
              </p>
            </div>
            <PaginationControls
              paginationState={errorPagination}
              onPageChange={handleErrorPageChange}
              onPageSizeChange={handleErrorPageSizeChange}
              itemType="记录"
            />
          </div>
        </section>

        {/* 自定义配置 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">自定义配置</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                自定义页面大小选项、可见页码数量等配置
              </p>
            </div>
            <PaginationControls
              paginationState={basicPagination}
              onPageChange={handleBasicPageChange}
              onPageSizeChange={handleBasicPageSizeChange}
              pageSizeOptions={[5, 15, 25, 100]}
              maxVisiblePages={3}
              itemType="用户"
              className="border-2 border-blue-200"
            />
          </div>
        </section>

        {/* 最小化配置 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">最小化配置</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                只显示页面导航，隐藏页面大小选择器和详细信息
              </p>
            </div>
            <PaginationControls
              paginationState={basicPagination}
              onPageChange={handleBasicPageChange}
              onPageSizeChange={handleBasicPageSizeChange}
              showPageSizeSelector={false}
              showInfo={false}
            />
          </div>
        </section>

        {/* 禁用状态 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">禁用状态</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                通过 disabled 属性禁用所有控件
              </p>
            </div>
            <PaginationControls
              paginationState={basicPagination}
              onPageChange={handleBasicPageChange}
              onPageSizeChange={handleBasicPageSizeChange}
              disabled={true}
              itemType="任务"
            />
          </div>
        </section>
      </div>

      {/* 代码示例 */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">代码示例</h2>
        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <pre className="text-sm">
{`import { PaginationControls, type PaginationState } from './PaginationControls'

const [paginationState, setPaginationState] = useState<PaginationState>({
  currentPage: 1,
  pageSize: 20,
  totalPages: 10,
  totalItems: 200,
  loading: false,
  error: null
})

const handlePageChange = (page: number) => {
  setPaginationState(prev => ({ ...prev, currentPage: page }))
  // 加载新页面的数据
}

const handlePageSizeChange = (pageSize: number) => {
  setPaginationState(prev => ({
    ...prev,
    pageSize,
    currentPage: 1, // 重置到第一页
    totalPages: Math.ceil(prev.totalItems / pageSize)
  }))
  // 重新加载数据
}

<PaginationControls
  paginationState={paginationState}
  onPageChange={handlePageChange}
  onPageSizeChange={handlePageSizeChange}
  pageSizeOptions={[10, 20, 50]}
  maxVisiblePages={5}
  itemType="项目"
/>`}
          </pre>
        </div>
      </section>
    </div>
  )
}