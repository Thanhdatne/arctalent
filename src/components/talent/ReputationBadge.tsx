import { reputationTier, formatUSDC } from '@/lib/utils'

interface ReputationBadgeProps {
  score: bigint
  jobsCompleted?: bigint
  ratingSum?: bigint
  ratingCount?: bigint
  totalEarned?: bigint
  size?: 'sm' | 'md' | 'lg'
}

export function ReputationBadge({
  score,
  jobsCompleted,
  ratingSum,
  ratingCount,
  totalEarned,
  size = 'md',
}: ReputationBadgeProps) {
  const tier = reputationTier(score)
  const avgRating =
    ratingCount && ratingCount > 0n ? Number(ratingSum ?? 0n) / Number(ratingCount) : 0
  const showTooltip = jobsCompleted !== undefined

  const textSize =
    size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl'
  const labelSize =
    size === 'lg' ? 'text-sm' : 'text-xs'

  return (
    <div className="relative group inline-flex flex-col items-center">
      <div className="flex items-baseline gap-1.5">
        <span className={`${textSize} font-bold tabular-nums display ${tier.color}`}>
          {Number(score).toLocaleString()}
        </span>
        <span className={`${labelSize} font-semibold uppercase tracking-widest ${tier.color}`}>
          {tier.label}
        </span>
      </div>

      {showTooltip && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none
                        opacity-0 group-hover:opacity-100 transition-opacity duration-150
                        bg-[var(--ink)] text-white text-xs rounded-xl p-3 w-52 shadow-lg">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-white/65">Jobs completed</span>
              <span className="font-semibold">{Number(jobsCompleted ?? 0n)}</span>
            </div>
            {avgRating > 0 && (
              <div className="flex justify-between">
                <span className="text-white/65">Avg rating</span>
                <span className="font-semibold">{'★'.repeat(Math.round(avgRating))} {avgRating.toFixed(1)}</span>
              </div>
            )}
            {totalEarned !== undefined && totalEarned > 0n && (
              <div className="flex justify-between">
                <span className="text-white/65">Total earned</span>
                <span className="font-semibold">${formatUSDC(totalEarned)}</span>
              </div>
            )}
            <div className="pt-1.5 border-t border-white/20">
              <div className="text-white/45 text-[10px] mb-1">Score formula</div>
              <div className="text-white/65 text-[10px]">jobs×10 + rating×20 + earned÷100</div>
            </div>
            <div className="pt-1 border-t border-white/20">
              <div className="text-white/45 text-[10px]">To improve: complete more jobs, earn higher ratings, and earn more USDC.</div>
            </div>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[var(--ink)]" />
        </div>
      )}
    </div>
  )
}
