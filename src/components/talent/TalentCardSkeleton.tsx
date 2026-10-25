/** Skeleton placeholder for TalentCard — matches updated card layout */
export function TalentCardSkeleton() {
  return (
    <div className="card rounded-2xl p-5 animate-pulse" aria-hidden="true">
      {/* Avatar + name row */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--surface-muted)] shrink-0" />
        <div className="flex-1 pt-0.5 space-y-2">
          <div className="h-4 w-32 rounded-full bg-[var(--surface-muted)]" />
          <div className="h-3 w-24 rounded-full bg-[var(--surface-muted)]" />
        </div>
        <div className="w-14 h-5 rounded-full bg-[var(--surface-muted)] shrink-0" />
      </div>
      {/* Bio */}
      <div className="space-y-2 mb-3">
        <div className="h-3 w-full rounded-full bg-[var(--surface-muted)]" />
        <div className="h-3 w-4/5 rounded-full bg-[var(--surface-muted)]" />
      </div>
      {/* Skills */}
      <div className="flex gap-1.5 mb-4">
        <div className="h-6 w-20 rounded-full bg-[var(--accent-subtle)]" />
        <div className="h-6 w-16 rounded-full bg-[var(--surface-muted)]" />
        <div className="h-6 w-14 rounded-full bg-[var(--surface-muted)]" />
      </div>
      {/* Footer */}
      <div className="flex justify-between pt-3 border-t border-[var(--border)]">
        <div className="h-5 w-20 rounded-full bg-[var(--surface-muted)]" />
        <div className="h-4 w-12 rounded-full bg-[var(--surface-muted)]" />
      </div>
    </div>
  )
}
