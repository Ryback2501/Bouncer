import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from './cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed',
          size === 'md' && 'px-4 py-2 text-sm',
          size === 'sm' && 'px-3 py-1.5 text-xs',
          variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
          variant === 'secondary' && 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
          variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
          variant === 'ghost' && 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
