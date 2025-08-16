import React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  XCircle
} from 'lucide-react'
import { cn } from '../../lib/utils'

export interface PaginationState {
  currentPage: number
  pageSize: number
  totalPages: number
  totalItems: number
  loading: boolean
  error: string | null
}

interface PaginationControlsProps {
  /** 分页状态 */
  paginationState: PaginationState
  /** 跳转到指定页面的回调函数 */
  onPageChange: (page: number) => void
  /** 修改页面大小的回调函数 */
  onPageSizeChange: (pageSize: number) => void
  /** 可选的页面大小选项 */
  pageSizeOptions?: number[]
  /** 最大显示的页码数量 */
  maxVisiblePages?: number
  /** 是否显示页面大小选择器 */
  showPageSizeSelector?: boolean
  /** 是否显示详细信息（总数等） */
  showInfo?: boolean
  /** 自定义样式类名 */
  className?: string
  /** 是否禁用所有控件 */
  disabled?: boolean
  /** 项目类型描述（用于显示文本） */
  itemType?: string
}

export function PaginationControls({
  paginationState,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  maxVisiblePages = 5,
  showPageSizeSelector = true,
  showInfo = true,
  className,
  disabled = false,
  itemType = '项目'
}: PaginationControlsProps) {
  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    loading,
    error
  } = paginationState

  // 生成页码数组
  const generatePageNumbers = () => {
    const pages: number[] = []
    
    if (totalPages <= maxVisiblePages) {
      // 如果总页数小于等于最大显示数，显示所有页码
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // 否则显示当前页附近的页码
      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
      
      // 调整起始页，确保显示足够的页码
      if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1)
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
      }
    }
    
    return pages
  }

  const pageNumbers = generatePageNumbers()

  // 跳转到指定页面
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage || loading || disabled) {
      return
    }
    onPageChange(page)
  }

  // 修改页面大小
  const changePageSize = (newPageSize: number) => {
    if (newPageSize === pageSize || loading || disabled) {
      return
    }
    onPageSizeChange(newPageSize)
  }

  // 如果没有数据且没有错误，不显示分页控件
  if (totalItems === 0 && !error && !loading) {
    return null
  }

  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg p-4', className)}>
      <div className="flex items-center justify-between">
        {/* 分页信息和页面大小选择器 */}
        <div className="flex items-center gap-4">
          {showInfo && (
            <div className="text-sm text-gray-600">
              共 {totalItems} 个{itemType}
              {totalPages > 1 && (
                <span className="ml-2">
                  第 {currentPage} / {totalPages} 页
                </span>
              )}
            </div>
          )}
          
          {showPageSizeSelector && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">每页显示:</label>
              <select
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                disabled={loading || disabled}
                className={cn(
                  'px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-gray-400',
                  'disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                {pageSizeOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 分页导航 */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* 第一页 */}
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1 || loading || disabled}
              className={cn(
                'p-2 text-gray-400 hover:text-gray-600 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title="第一页"
              aria-label="跳转到第一页"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* 上一页 */}
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || loading || disabled}
              className={cn(
                'p-2 text-gray-400 hover:text-gray-600 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title="上一页"
              aria-label="跳转到上一页"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* 页码 */}
            <div className="flex items-center gap-1 mx-2">
              {pageNumbers.map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  disabled={loading || disabled}
                  className={cn(
                    'px-3 py-1 text-sm rounded transition-colors',
                    'disabled:cursor-not-allowed',
                    pageNum === currentPage
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100 disabled:opacity-50'
                  )}
                  aria-label={`跳转到第${pageNum}页`}
                  aria-current={pageNum === currentPage ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            {/* 下一页 */}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || loading || disabled}
              className={cn(
                'p-2 text-gray-400 hover:text-gray-600 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title="下一页"
              aria-label="跳转到下一页"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* 最后一页 */}
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages || loading || disabled}
              className={cn(
                'p-2 text-gray-400 hover:text-gray-600 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title="最后一页"
              aria-label="跳转到最后一页"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center mt-4 py-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
          <span className="text-sm text-gray-600">加载中...</span>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="flex items-center gap-2 mt-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  )
}

// 默认导出组件
export default PaginationControls

// 导出类型供外部使用
export type { PaginationState, PaginationControlsProps }