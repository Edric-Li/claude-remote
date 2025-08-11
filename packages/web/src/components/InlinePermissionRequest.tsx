import { useState } from 'react'
import { Check, X } from 'lucide-react'

interface PermissionRequest {
  id: string
  toolName: string
  toolInput: Record<string, any>
  description?: string
  timestamp: string
  sessionId?: string
  taskId?: string
}

interface InlinePermissionRequestProps {
  request: PermissionRequest | null
  onApprove: (request: PermissionRequest) => void
  onDeny: (request: PermissionRequest, reason?: string) => void
}

export function InlinePermissionRequest({ request, onApprove, onDeny }: InlinePermissionRequestProps) {
  const [denyFeedback, setDenyFeedback] = useState('')
  const [showDenyInput, setShowDenyInput] = useState(false)

  if (!request) return null

  const handleApprove = () => {
    onApprove(request)
  }

  const handleDeny = () => {
    onDeny(request, denyFeedback || 'User denied permission')
    setDenyFeedback('')
    setShowDenyInput(false)
  }

  // 渲染代码内容（Write工具）
  const renderWriteContent = () => {
    const { file_path, content } = request.toolInput
    if (!content) return null

    const lines = content.split('\n')
    return (
      <div className="bg-gray-900 rounded-md overflow-hidden mt-3">
        <div className="px-3 py-2 text-xs text-gray-400 font-mono border-b border-gray-800">
          {file_path || 'new file'}
        </div>
        <div className="max-h-64 overflow-y-auto">
          <div className="p-3 font-mono text-sm">
            {lines.map((line: string, i: number) => (
              <div key={i} className="flex hover:bg-gray-800/50">
                <span className="text-gray-600 select-none pr-3 text-right" style={{ minWidth: '3em' }}>
                  {i + 1}
                </span>
                <span className="text-green-400 select-none pr-2">+</span>
                <span className="text-gray-300 whitespace-pre">{line || ' '}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // 渲染编辑内容（Edit工具）
  const renderEditContent = () => {
    const { file_path, old_string, new_string } = request.toolInput
    
    if (old_string || new_string) {
      const oldLines = (old_string || '').split('\n')
      const newLines = (new_string || '').split('\n')
      
      return (
        <div className="bg-gray-900 rounded-md overflow-hidden mt-3">
          <div className="px-3 py-2 text-xs text-gray-400 font-mono border-b border-gray-800">
            {file_path || 'file'}
          </div>
          <div className="max-h-64 overflow-y-auto">
            <div className="p-3 font-mono text-sm">
              {old_string && oldLines.map((line: string, i: number) => (
                <div key={`old-${i}`} className="flex hover:bg-gray-800/50">
                  <span className="text-gray-600 select-none pr-3 text-right" style={{ minWidth: '3em' }}>
                    {i + 1}
                  </span>
                  <span className="text-red-400 select-none pr-2">-</span>
                  <span className="text-gray-500 whitespace-pre line-through">{line || ' '}</span>
                </div>
              ))}
              {new_string && newLines.map((line: string, i: number) => (
                <div key={`new-${i}`} className="flex hover:bg-gray-800/50">
                  <span className="text-gray-600 select-none pr-3 text-right" style={{ minWidth: '3em' }}>
                    {oldLines.length + i + 1}
                  </span>
                  <span className="text-green-400 select-none pr-2">+</span>
                  <span className="text-gray-300 whitespace-pre">{line || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-gray-900 rounded-md p-3 mt-3">
        <div className="font-mono text-sm text-gray-400">
          📝 编辑文件: <span className="text-gray-300">{file_path || '检测到的文件路径'}</span>
        </div>
      </div>
    )
  }

  // 渲染命令内容（Bash工具）
  const renderBashContent = () => {
    const { command } = request.toolInput
    
    return (
      <div className="bg-gray-900 rounded-md overflow-hidden mt-3">
        <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-800">
          Terminal
        </div>
        <div className="p-3 font-mono text-sm">
          <span className="text-gray-500">$</span> <span className="text-green-400">{command || '执行系统命令'}</span>
        </div>
      </div>
    )
  }

  // 根据工具类型渲染内容
  const renderToolContent = () => {
    switch (request.toolName) {
      case 'Write':
        return renderWriteContent()
      case 'Edit':
      case 'MultiEdit':
        return renderEditContent()
      case 'Bash':
        return renderBashContent()
      default:
        return (
          <div className="bg-gray-900 rounded-md p-3 mt-3">
            <div className="font-mono text-xs text-gray-400">
              {JSON.stringify(request.toolInput, null, 2)}
            </div>
          </div>
        )
    }
  }

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800 shadow-xl animate-slideUp">
      {/* 头部 - 模仿CUI的黑色标题栏 */}
      <div className="bg-gray-950 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          PERMISSION REQUEST:
        </h3>
      </div>

      {/* 内容区域 */}
      <div className="bg-gray-850 p-4">
        {/* 工具信息 */}
        <div className="flex items-start gap-3 mb-2">
          <div className="flex-1">
            <div className="text-sm text-gray-300 font-mono">
              <span className="text-gray-500">{request.toolName}(</span>
              <span className="text-blue-400">file_path: </span>
              <span className="text-green-400">"{request.toolInput.file_path || '...'}"</span>
              {request.toolInput.command && (
                <>
                  <span className="text-blue-400">, command: </span>
                  <span className="text-green-400">"{request.toolInput.command}"</span>
                </>
              )}
              <span className="text-gray-500">)</span>
            </div>
          </div>
        </div>

        {/* 工具内容预览 */}
        {renderToolContent()}

        {/* 拒绝输入框 */}
        {showDenyInput && (
          <div className="mt-3">
            <input
              type="text"
              value={denyFeedback}
              onChange={(e) => setDenyFeedback(e.target.value)}
              placeholder="Deny and tell Claude what to do"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDeny()
                if (e.key === 'Escape') {
                  setShowDenyInput(false)
                  setDenyFeedback('')
                }
              }}
            />
          </div>
        )}

        {/* 操作按钮区域 */}
        <div className="flex items-center justify-end gap-3 mt-4">
          {!showDenyInput ? (
            <>
              <button
                onClick={() => setShowDenyInput(true)}
                className="px-4 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="w-4 h-4 inline mr-1.5" />
                Deny
              </button>
              <button
                onClick={handleApprove}
                className="px-5 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors font-medium flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Accept
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setShowDenyInput(false)
                  setDenyFeedback('')
                }}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeny}
                className="px-4 py-1.5 text-sm text-gray-400 hover:text-gray-200 border border-gray-600 rounded-md transition-colors"
              >
                <X className="w-4 h-4 inline mr-1.5" />
                Deny
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}