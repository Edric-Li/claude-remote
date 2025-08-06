import * as React from 'react'
import { cn } from '@/lib/utils'

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'vertical' | 'horizontal' | 'both'
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, orientation = 'vertical', ...props }, ref) => {
    const scrollClass = orientation === 'horizontal' 
      ? 'overflow-x-auto overflow-y-hidden'
      : orientation === 'both'
      ? 'overflow-auto'
      : 'overflow-y-auto overflow-x-hidden'
      
    return (
      <div
        ref={ref}
        className={cn(
          'relative',
          scrollClass,
          'scrollbar-custom',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ScrollArea.displayName = 'ScrollArea'

export { ScrollArea }