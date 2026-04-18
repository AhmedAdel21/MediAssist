import { clsx } from 'clsx'
import type { UserRole } from '@/types'

type BadgeVariant = UserRole | 'success' | 'warning' | 'danger' | 'default'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  admin: 'bg-purple-100 text-purple-800',
  doctor: 'bg-blue-100 text-blue-800',
  nurse: 'bg-teal-100 text-teal-800',
  patient: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  default: 'bg-gray-100 text-gray-700',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
