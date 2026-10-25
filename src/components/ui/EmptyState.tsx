import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** Icon slot — pass a Lucide icon or custom SVG component */
  icon?: ReactNode
  title: string
  description?: string
  /** Optional CTA button or link */
  action?: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_MAP = {
  sm: { icon: 'w-10 h-10', wrapper: 'py-8', title: 'text-sm', desc: 'text-xs' },
  md: { icon: 'w-12 h-12', wrapper: 'py-12', title: 'text-base', desc: 'text-sm' },
  lg: { icon: 'w-16 h-16', wrapper: 'py-16', title: 'text-lg', desc: 'text-sm' },
}

/**
 * Consistent branded empty state with icon, title, optional description, and CTA.
 * Used across JobBoard, TalentDirectory, Dashboard, and Landing.
 */
export function EmptyState({ icon, title, description, action, className = '', size = 'md' }: EmptyStateProps) {
  const s = SIZE_MAP[size]
  return (
    <div className={`flex flex-col items-center text-center ${s.wrapper} ${className}`}>
      {icon && (
        <div className={`${s.icon} rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] flex items-center justify-center mb-4 text-[var(--subtle)]`}>
          {icon}
        </div>
      )}
      <p className={`font-semibold text-[var(--ink)] mb-1 ${s.title}`}>{title}</p>
      {description && (
        <p className={`text-[var(--muted)] max-w-xs leading-relaxed ${s.desc}`}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
