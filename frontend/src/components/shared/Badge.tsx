import { cn } from './cn'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'green' | 'red' | 'yellow' | 'blue' | 'gray'
}

export function Badge({ children, variant = 'gray' }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      variant === 'green' && 'bg-green-100 text-green-800',
      variant === 'red' && 'bg-red-100 text-red-800',
      variant === 'yellow' && 'bg-yellow-100 text-yellow-800',
      variant === 'blue' && 'bg-blue-100 text-blue-800',
      variant === 'gray' && 'bg-gray-100 text-gray-700',
    )}>
      {children}
    </span>
  )
}
