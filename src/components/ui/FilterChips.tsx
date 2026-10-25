import { X } from 'lucide-react'

interface FilterChip {
  label: string
  onRemove: () => void
}

interface FilterChipsProps {
  chips: FilterChip[]
  onClearAll?: () => void
  className?: string
}

export function FilterChips({ chips, onClearAll, className = '' }: FilterChipsProps) {
  if (chips.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {chips.map(({ label, onRemove }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 pl-3 pr-2 py-1 rounded-full text-xs font-medium
                     bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20"
        >
          {label}
          <button
            onClick={onRemove}
            className="rounded-full hover:bg-[var(--accent)]/15 p-0.5 transition-colors"
            aria-label={`Remove ${label} filter`}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {onClearAll && chips.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-[var(--danger)] hover:underline font-medium"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
