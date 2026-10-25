/** Skeleton placeholder for JobCard — matches updated card layout */
export function JobCardSkeleton() {
  return (
    <div className="card rounded-2xl p-5 animate-pulse" aria-hidden="true">
      {/* Badge row */}
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-16 rounded-full bg-[var(--surface-muted)]" />
        <div className="h-5 w-12 rounded-full bg-[var(--surface-muted)]" />
      </div>
      {/* Title */}
      <div className="h-5 w-3/4 rounded-full bg-[var(--surface-muted)] mb-2" />
      <div className="h-4 w-1/2 rounded-full bg-[var(--surface-muted)] mb-4" />
      {/* Description lines */}
      <div className="space-y-2 mb-4">
        <div className="h-3 w-full rounded-full bg-[var(--surface-muted)]" />
        <div className="h-3 w-5/6 rounded-full bg-[var(--surface-muted)]" />
      </div>
      {/* Skills */}
      <div className="flex gap-1.5 mb-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-5 w-14 rounded-full bg-[var(--surface-muted)]" />
        ))}
      </div>
      {/* Footer */}
      <div className="flex justify-between items-center pt-3 border-t border-[var(--border)]">
        {/* USDC badge shape */}
        <div className="h-6 w-24 rounded-full bg-[#2775CA]/10" />
        <div className="h-3 w-20 rounded-full bg-[var(--surface-muted)]" />
      </div>
    </div>
  )
}
