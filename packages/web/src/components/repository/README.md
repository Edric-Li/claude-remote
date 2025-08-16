# 响应式仓库对话框组件

## 概述

`RepositoryDialog` 是一个专为仓库管理设计的响应式对话框组件，基于 Radix UI 构建，集成了 Task 14 的改进样式，解决了原有的纯黑背景问题。

## 主要特性

### ✅ 已实现功能（来自 Requirement 6）

1. **半透明背景遮罩** - 使用改进的样式替代纯黑背景
2. **适当的阴影和圆角边框** - 增强视觉效果
3. **内容居中显示且有适当内边距** - 优化布局
4. **平滑的过渡动画** - 60fps 动画效果
5. **点击遮罩或取消关闭** - 支持多种关闭方式
6. **垂直滚动支持** - 长内容自动滚动
7. **响应式设计** - 适配不同屏幕尺寸

### 🚀 额外功能

- **键盘导航** - ESC 键关闭
- **无障碍访问** - ARIA 标签和屏幕阅读器支持
- **加载和错误状态** - 视觉反馈
- **TypeScript 支持** - 完整的类型定义
- **表单验证组件** - 内置表单字段组件

## 响应式断点

- **桌面端 (>1024px)**: 标准对话框 (max-width: 32rem)
- **平板端 (768px-1024px)**: 自适应宽度
- **手机端 (<768px)**: 接近全屏，向上偏移优化

## 组件结构

```
RepositoryDialog.tsx              # 主要组件文件
├── ResponsiveDialog             # 通用响应式对话框
├── RepositoryDialog            # 专用仓库对话框
├── ResponsiveDialogContent     # 对话框内容
├── ResponsiveDialogHeader      # 头部区域
├── ResponsiveDialogFooter      # 底部区域
├── ResponsiveDialogFormSection # 表单区域
└── ResponsiveDialogFormField   # 表单字段
```

## 使用示例

### 基础用法

```tsx
import { RepositoryDialog } from '@/components/repository/RepositoryDialog'

function MyComponent() {
  const [open, setOpen] = useState(false)
  
  return (
    <RepositoryDialog
      mode="create"
      open={open}
      onOpenChange={setOpen}
      title="添加新仓库"
      description="配置新的代码仓库连接信息"
    >
      {/* 对话框内容 */}
    </RepositoryDialog>
  )
}
```

### 完整表单示例

```tsx
import {
  RepositoryDialog,
  ResponsiveDialogFormSection,
  ResponsiveDialogFormField,
  ResponsiveDialogFooter,
} from '@/components/repository/RepositoryDialog'

function CreateRepositoryDialog() {
  return (
    <RepositoryDialog mode="create" open={open} onOpenChange={setOpen}>
      <form onSubmit={handleSubmit}>
        <ResponsiveDialogFormSection>
          <ResponsiveDialogFormField label="仓库名称" required>
            <Input placeholder="输入仓库名称" />
          </ResponsiveDialogFormField>
          
          <ResponsiveDialogFormField label="仓库URL" required>
            <Input placeholder="https://github.com/user/repo.git" />
          </ResponsiveDialogFormField>
        </ResponsiveDialogFormSection>
        
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button type="submit">创建仓库</Button>
        </ResponsiveDialogFooter>
      </form>
    </RepositoryDialog>
  )
}
```

## Props 接口

### RepositoryDialogProps

```tsx
interface RepositoryDialogProps extends ResponsiveDialogProps {
  mode?: 'create' | 'edit' | 'view'    // 对话框模式
  repositoryId?: string                // 仓库ID（编辑模式）
}
```

### ResponsiveDialogProps

```tsx
interface ResponsiveDialogProps {
  open?: boolean                       // 是否打开
  onOpenChange?: (open: boolean) => void // 打开状态变化回调
  children: React.ReactNode            // 子内容
  title?: string                       // 标题
  description?: string                 // 描述
  className?: string                   // 自定义样式类
  loading?: boolean                    // 加载状态
  error?: boolean                      // 错误状态
  maxHeight?: string                   // 最大高度
  onClose?: () => void                 // 关闭回调
}
```

## 样式文件

组件使用 `RepositoryDialog.module.css` 提供样式，该文件由 Task 14 创建，包含：

- 半透明背景遮罩
- 增强的阴影效果
- 响应式断点
- 平滑动画
- 无障碍支持
- 深色模式适配

## 键盘交互

- **ESC** - 关闭对话框
- **Tab/Shift+Tab** - 焦点导航
- **Enter** - 确认操作（在按钮上）
- **Space** - 激活按钮

## 无障碍支持

- ARIA 标签和角色
- 屏幕阅读器支持
- 键盘导航
- 焦点管理
- 高对比度模式支持

## 测试

使用 `RepositoryDialogExample.tsx` 进行功能测试：

1. 响应式设计测试
2. 表单验证测试
3. 加载状态测试
4. 错误状态测试
5. 键盘导航测试

## 技术栈

- **React 18** - 函数组件和 Hooks
- **TypeScript** - 类型安全
- **Radix UI** - 无障碍基础组件
- **Tailwind CSS** - 样式工具类
- **CSS Modules** - 组件级样式

## 性能优化

- React.memo 用于防止不必要的重渲染
- useCallback 优化事件处理函数
- 懒加载支持（可配置）
- 动画性能优化（硬件加速）

## 浏览器支持

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

支持现代浏览器的所有响应式和动画特性。