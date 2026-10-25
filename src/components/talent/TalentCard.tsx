import { Link } from 'react-router-dom'
import { MapPin, Star, ArrowRight } from 'lucide-react'
import { ReputationBadge } from './ReputationBadge'
import { Avatar } from './Avatar'
import { USDCBadge } from '@/components/ui/USDCAmount'
import type { OnchainProfile, OnchainReputation } from '@/lib/contracts'

interface TalentCardProps {
  address: `0x${string}`
  profile: OnchainProfile
  reputation: OnchainReputation
  score: bigint
}

export function TalentCard({ address, profile, reputation, score }: TalentCardProps) {
  const avgRating =
    reputation.ratingCount > 0n
      ? Number(reputation.ratingSum) / Number(reputation.ratingCount)
      : 0

  // Skills: first is "primary" (accent-subtle), rest neutral, overflow count
  const primarySkill = profile.skills[0]
  const secondarySkills = profile.skills.slice(1, 3)
  const overflowCount = profile.skills.length - 3

  return (
    <Link
      to={`/talent/${address}`}
      className="card card-lift block rounded-2xl group relative overflow-hidden"
    >
      <div className="p-5">
        {/* Avatar + name row */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar
            fetchRemote
            address={address}
            name={profile.name}
            size={48}
            className="shadow-sm shrink-0"
          />

          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="font-semibold text-[var(--ink)] truncate group-hover:text-[var(--accent)] transition-colors text-base leading-snug">
              {profile.name}
            </h3>
            <p className="text-xs text-[var(--subtle)] font-mono mt-0.5">
              {address.slice(0, 6)}…{address.slice(-4)}
            </p>
          </div>

          {/* Reputation badge */}
          <div className="shrink-0 pt-0.5">
            <ReputationBadge score={score} size="sm" />
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-[var(--muted)] line-clamp-2 mb-3 leading-relaxed">
            {profile.bio}
          </p>
        )}

        {/* Skills */}
        {profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {primarySkill && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20">
                {primarySkill}
              </span>
            )}
            {secondarySkills.map((s) => (
              <span
                key={s}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--surface-muted)] text-[var(--ink-2)] border border-[var(--border)]"
              >
                {s}
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="px-2 py-1 text-xs text-[var(--subtle)]">+{overflowCount}</span>
            )}
          </div>
        )}

        {/* Footer: rate + location + rating + jobs */}
        <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {profile.preferredRate > 0n && (
              <USDCBadge raw={profile.preferredRate} variant="neutral" size="sm" />
            )}
            {profile.location && (
              <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
                <MapPin size={10} className="shrink-0" />
                <span className="truncate max-w-[80px]">{profile.location}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {avgRating > 0 && (
              <div className="flex items-center gap-0.5 text-xs text-amber-500">
                <Star size={11} fill="currentColor" />
                <span className="font-semibold tabular-nums">{avgRating.toFixed(1)}</span>
              </div>
            )}
            {reputation.jobsCompleted > 0n && (
              <span className="px-2 py-0.5 rounded-full bg-[var(--surface-muted)] text-xs font-semibold text-[var(--ink-2)] border border-[var(--border)] tabular-nums">
                {Number(reputation.jobsCompleted)} job{Number(reputation.jobsCompleted) !== 1 ? 's' : ''}
              </span>
            )}
            <ArrowRight
              size={13}
              className="text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-150"
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
