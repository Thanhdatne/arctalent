import { Link } from 'react-router-dom'
import { Clock, Users, Bookmark, ArrowRight } from 'lucide-react'
import { SkillTag } from '@/components/talent/SkillTag'
import { USDCBadge } from '@/components/ui/USDCAmount'
import { formatDeadline, deadlineStatus } from '@/lib/utils'
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS, JOB_TYPE_LABELS, type OnchainJob, JobStatus } from '@/lib/contracts'

interface JobCardProps {
  job: OnchainJob
  showClient?: boolean
  /** Number of applicants — undefined = not yet loaded (show nothing) */
  applicantCount?: number
  isSaved?: boolean
  onToggleSave?: () => void
}

export function JobCard({ job, showClient, applicantCount, isSaved, onToggleSave }: JobCardProps) {
  const statusLabel = JOB_STATUS_LABELS[job.status] ?? 'Unknown'
  const statusColor = JOB_STATUS_COLORS[job.status] ?? 'bg-[var(--surface-muted)] text-[var(--muted)]'
  const dl = deadlineStatus(job.deadline)
  const isActive = job.status === JobStatus.Open || job.status === JobStatus.Funded

  return (
    <div className="card rounded-2xl group relative overflow-hidden">
      {/* Left accent border — appears on hover */}
      <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

      {/* Save button */}
      {onToggleSave && (
        <button
          onClick={(e) => { e.preventDefault(); onToggleSave() }}
          title={isSaved ? 'Remove bookmark (device-local)' : 'Save job (device-local)'}
          className={`absolute top-3.5 right-3.5 z-10 p-1.5 rounded-lg transition-all duration-150 ${
            isSaved
              ? 'text-[var(--accent)] bg-[var(--accent-subtle)]'
              : 'text-[var(--subtle)] hover:text-[var(--accent)] hover:bg-[var(--surface-muted)]'
          }`}
          aria-label={isSaved ? 'Remove saved job' : 'Save job'}
        >
          <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} strokeWidth={isSaved ? 0 : 1.75} />
        </button>
      )}

      <Link to={`/jobs/${Number(job.id)}`} className="block p-5">
        {/* Status + type badges */}
        <div className="flex items-center gap-2 mb-3 pr-8 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--surface-muted)] text-[var(--muted)] border border-[var(--border)]">
            {JOB_TYPE_LABELS[job.jobType] ?? 'Fixed'}
          </span>
          {job.referralEligible && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent-subtle)] text-[var(--accent)]">
              Referral
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[var(--ink)] text-base group-hover:text-[var(--accent)] transition-colors line-clamp-2 leading-snug mb-2">
          {job.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-[var(--muted)] line-clamp-2 mb-4 leading-relaxed">
          {job.description}
        </p>

        {/* Skills */}
        {job.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {job.skills.slice(0, 4).map((s) => (
              <SkillTag key={s} skill={s} size="sm" />
            ))}
            {job.skills.length > 4 && (
              <span className="px-2 py-0.5 text-xs text-[var(--subtle)]">
                +{job.skills.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2 flex-wrap">
          {/* Budget with official USDC badge */}
          <USDCBadge raw={job.budget} variant="blue" size="md" />

          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
            {isActive && (
              <span className={`flex items-center gap-1 ${dl === 'past' ? 'text-[var(--danger)]' : dl === 'soon' ? 'text-amber-500' : ''}`}>
                <Clock size={12} />
                {dl === 'past' ? 'Expired' : `Due ${formatDeadline(job.deadline)}`}
              </span>
            )}
            {applicantCount !== undefined && applicantCount > 0 && (
              <span className="flex items-center gap-1">
                <Users size={12} />
                <span className="tabular-nums">{applicantCount}</span>
              </span>
            )}
            {/* Hover view arrow */}
            <span className="flex items-center gap-0.5 text-[var(--accent)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View <ArrowRight size={12} />
            </span>
          </div>
        </div>

        {showClient && (
          <div className="mt-2 text-xs text-[var(--subtle)] mono">
            {job.client.slice(0, 8)}…{job.client.slice(-4)}
          </div>
        )}
      </Link>
    </div>
  )
}
