import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import styles from './RepositoryDialog.module.css'

// 导出基础 Dialog 组件供外部使用
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal

// 响应式对话框 Props 接口
export interface ResponsiveDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  title?: string
  description?: string
  className?: string
  loading?: boolean
  error?: boolean
  maxHeight?: string
  onClose?: () => void
}

// 响应式对话框内容组件 Props
interface ResponsiveDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  loading?: boolean
  error?: boolean
  maxHeight?: string
  hideCloseButton?: boolean
  onEscapeKeyDown?: (event: KeyboardEvent) => void
  onPointerDownOutside?: (event: PointerEvent) => void
}

// 自定义 Overlay 组件 - 使用改进的样式
const ResponsiveDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(styles.overlay, className)}
    {...props}
  />
))
ResponsiveDialogOverlay.displayName = 'ResponsiveDialogOverlay'

// 响应式对话框内容组件
const ResponsiveDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ResponsiveDialogContentProps
>(({ 
  className, 
  children, 
  loading = false, 
  error = false, 
  maxHeight = '90vh',
  hideCloseButton = false,
  onEscapeKeyDown,
  onPointerDownOutside,
  ...props 
}, ref) => {
  // 键盘事件处理
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (onEscapeKeyDown) {
          onEscapeKeyDown(event)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onEscapeKeyDown])

  return (
    <DialogPortal>
      <ResponsiveDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          styles.content,
          loading && styles.loading,
          error && styles.error,
          className
        )}
        style={{
          maxHeight,
          ...props.style
        }}
        onEscapeKeyDown={onEscapeKeyDown}
        onPointerDownOutside={onPointerDownOutside}
        {...props}
      >
        {/* 滚动区域包装器 */}
        <div className={styles.scrollArea}>
          {children}
        </div>
        
        {/* 关闭按钮 - 可选择隐藏 */}
        {!hideCloseButton && (
          <DialogPrimitive.Close className={styles.closeButton}>
            <X className="h-4 w-4" />
            <span className="sr-only">关闭对话框</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
ResponsiveDialogContent.displayName = 'ResponsiveDialogContent'

// 响应式对话框头部组件
const ResponsiveDialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(styles.header, className)}
    {...props}
  />
))
ResponsiveDialogHeader.displayName = 'ResponsiveDialogHeader'

// 响应式对话框标题组件
const ResponsiveDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(styles.title, className)}
    {...props}
  />
))
ResponsiveDialogTitle.displayName = 'ResponsiveDialogTitle'

// 响应式对话框描述组件
const ResponsiveDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(styles.description, className)}
    {...props}
  />
))
ResponsiveDialogDescription.displayName = 'ResponsiveDialogDescription'

// 响应式对话框底部组件
const ResponsiveDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(styles.footer, className)}
    {...props}
  />
))
ResponsiveDialogFooter.displayName = 'ResponsiveDialogFooter'

// 表单区域组件
const ResponsiveDialogFormSection = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(styles.formSection, className)}
    {...props}
  />
))
ResponsiveDialogFormSection.displayName = 'ResponsiveDialogFormSection'

// 表单字段组件
interface ResponsiveDialogFormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
  error?: string
  required?: boolean
}

const ResponsiveDialogFormField = React.forwardRef<
  HTMLDivElement,
  ResponsiveDialogFormFieldProps
>(({ className, label, error, required, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(styles.formField, className)}
    {...props}
  >
    {label && (
      <label className={styles.fieldLabel}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    {children}
    {error && (
      <span className={styles.fieldError} role="alert">
        {error}
      </span>
    )}
  </div>
))
ResponsiveDialogFormField.displayName = 'ResponsiveDialogFormField'

// 主要的响应式对话框组件
export const ResponsiveDialog: React.FC<ResponsiveDialogProps> = ({
  open,
  onOpenChange,
  children,
  title,
  description,
  className,
  loading = false,
  error = false,
  maxHeight = '90vh',
  onClose,
}) => {
  // 处理对话框关闭
  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    if (!newOpen && onClose) {
      onClose()
    }
    onOpenChange?.(newOpen)
  }, [onOpenChange, onClose])

  // ESC 键关闭处理
  const handleEscapeKeyDown = React.useCallback((event: KeyboardEvent) => {
    event.preventDefault()
    handleOpenChange(false)
  }, [handleOpenChange])

  // 点击外部关闭处理
  const handlePointerDownOutside = React.useCallback((event: PointerEvent) => {
    event.preventDefault()
    handleOpenChange(false)
  }, [handleOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent
        className={className}
        loading={loading}
        error={error}
        maxHeight={maxHeight}
        onEscapeKeyDown={handleEscapeKeyDown}
        onPointerDownOutside={handlePointerDownOutside}
      >
        {(title || description) && (
          <ResponsiveDialogHeader>
            {title && <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>}
            {description && <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription>}
          </ResponsiveDialogHeader>
        )}
        {children}
      </ResponsiveDialogContent>
    </Dialog>
  )
}

ResponsiveDialog.displayName = 'ResponsiveDialog'

// 导出所有组件
export {
  ResponsiveDialogContent,
  ResponsiveDialogOverlay,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogFormSection,
  ResponsiveDialogFormField,
}

// 导出组合使用的便捷组件
export interface RepositoryDialogProps extends ResponsiveDialogProps {
  mode?: 'create' | 'edit' | 'view'
  repositoryId?: string
}

// 专门用于仓库管理的对话框组件
export const RepositoryDialog: React.FC<RepositoryDialogProps> = ({
  mode = 'create',
  repositoryId,
  title,
  ...props
}) => {
  // 根据模式设置默认标题
  const defaultTitle = React.useMemo(() => {
    switch (mode) {
      case 'create':
        return '添加新仓库'
      case 'edit':
        return '编辑仓库'
      case 'view':
        return '查看仓库详情'
      default:
        return '仓库管理'
    }
  }, [mode])

  return (
    <ResponsiveDialog
      title={title || defaultTitle}
      description={mode === 'create' ? '配置新的代码仓库连接信息' : undefined}
      {...props}
    />
  )
}

RepositoryDialog.displayName = 'RepositoryDialog'