interface TabItem<T extends string> {
  id: T
  label: string
  count?: number
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
}

export function Tabs<T extends string>({ tabs, active, onChange, className = '' }: TabsProps<T>) {
  return (
    <div className={`flex gap-1 bg-[var(--surface-muted)] rounded-xl p-1 overflow-x-auto ${className}`}>
      {tabs.map(({ id, label, count }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-shrink-0 flex items-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            active === id
              ? 'bg-[var(--surface-strong)] text-[var(--ink)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--ink-2)]'
          }`}
        >
          {label}
          {count !== undefined && count > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              active === id
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--border)] text-[var(--muted)]'
            }`}>
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
