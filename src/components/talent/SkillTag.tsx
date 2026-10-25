interface SkillTagProps {
  skill: string
  selected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md'
}

export function SkillTag({ skill, selected, onClick, size = 'md' }: SkillTagProps) {
  const base =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs rounded-md'
      : 'px-3 py-1 text-sm rounded-lg'
  const style = selected
    ? 'bg-[var(--accent)] text-white font-medium'
    : onClick
    ? 'bg-[var(--surface-muted)] text-[var(--ink-2)] hover:bg-[var(--border)] cursor-pointer transition-colors'
    : 'bg-[var(--surface-muted)] text-[var(--muted)]'

  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={`inline-flex items-center font-medium ${base} ${style}`}
    >
      {skill}
    </span>
  )
}
