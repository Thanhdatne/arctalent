import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { ArrowLeft, ExternalLink, Globe, MapPin, AlertCircle, Briefcase, Star } from 'lucide-react'
import { USDCLogo } from '@/components/ui/USDCLogo'
import { ReputationBadge } from '@/components/talent/ReputationBadge'
import { Avatar } from '@/components/talent/Avatar'
import { SkillTag } from '@/components/talent/SkillTag'
import { TALENT_REGISTRY_ABI, JOB_ESCROW_ABI, type OnchainProfile, type OnchainReputation, type OnchainJob, JobStatus } from '@/lib/contracts'
import { CONTRACTS, ARC_TESTNET_ID } from '@/config'
import { formatUSDCFull, formatUSDCShort, formatAddress, buildArcScanAddr, formatDeadline } from '@/lib/utils'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Parse a URL string into a readable label: "github.com › myrepo" */
function parsePortfolioLink(url: string): { domain: string; path: string } {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const domain = u.hostname.replace(/^www\./, '')
    const path = u.pathname.replace(/\/$/, '').replace(/^\//, '')
    return { domain, path }
  } catch {
    return { domain: url, path: '' }
  }
}

// Profile skeleton
function ProfileSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-pulse">
      <div className="h-4 w-32 rounded bg-[var(--surface-muted)] mb-6" />
      <div className="rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] p-6 space-y-5">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-muted)] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 rounded bg-[var(--surface-muted)]" />
            <div className="h-4 w-32 rounded bg-[var(--surface-muted)]" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[0,1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-[var(--surface-muted)]" />)}
        </div>
        <div className="space-y-2">
          <div className="h-4 rounded bg-[var(--surface-muted)]" />
          <div className="h-4 w-5/6 rounded bg-[var(--surface-muted)]" />
        </div>
        <div className="flex gap-2">
          {[0,1,2].map((i) => <div key={i} className="h-7 w-20 rounded-full bg-[var(--surface-muted)]" />)}
        </div>
      </div>
    </div>
  )
}

// Job history max for a single profile view
const MAX_PROFILE_JOBS = 50

export function TalentProfile() {
  const { address: paramAddr } = useParams<{ address: string }>()
  const { address: connectedAddr } = useAccount()
  // Use the URL param as the canonical address — never fall back to connectedAddr for displaying someone else's profile
  const talentAddr = (paramAddr ?? '0x0000000000000000000000000000000000000000') as `0x${string}`
  const isSelf = connectedAddr?.toLowerCase() === talentAddr.toLowerCase()
  const [showHistory, setShowHistory] = useState(false)

  const {
    data: profile,
    isLoading: isLoadingProfile,
    isError: isErrorProfile,
  } = useReadContract({
    address: CONTRACTS.talentRegistry,
    abi: TALENT_REGISTRY_ABI,
    functionName: 'getProfile',
    args: [talentAddr],
    chainId: ARC_TESTNET_ID,
    query: { enabled: talentAddr !== '0x0000000000000000000000000000000000000000' },
  })

  const { data: reputation, isLoading: isLoadingRep } = useReadContract({
    address: CONTRACTS.talentRegistry,
    abi: TALENT_REGISTRY_ABI,
    functionName: 'getReputation',
    args: [talentAddr],
    chainId: ARC_TESTNET_ID,
    query: { enabled: talentAddr !== '0x0000000000000000000000000000000000000000' },
  })

  const { data: score, isLoading: isLoadingScore } = useReadContract({
    address: CONTRACTS.talentRegistry,
    abi: TALENT_REGISTRY_ABI,
    functionName: 'reputationScore',
    args: [talentAddr],
    chainId: ARC_TESTNET_ID,
    query: { enabled: talentAddr !== '0x0000000000000000000000000000000000000000' },
  })

  // ── On-demand job history ──────────────────────────────────────────────────
  const { data: jobCount } = useReadContract({
    address: CONTRACTS.jobEscrow,
    abi: JOB_ESCROW_ABI,
    functionName: 'getJobCount',
    chainId: ARC_TESTNET_ID,
    query: { enabled: showHistory },
  })

  const historyCount = Number(jobCount ?? 0n)
  const fetchCount = Math.min(historyCount, MAX_PROFILE_JOBS)

  // Stable fixed-length array — always MAX_PROFILE_JOBS entries, safe for hooks
  const jobContracts = useMemo(
    () =>
      Array.from({ length: MAX_PROFILE_JOBS }, (_, i) => ({
        address: CONTRACTS.jobEscrow,
        abi: JOB_ESCROW_ABI,
        functionName: 'getJob' as const,
        args: [BigInt(Math.max(0, historyCount - 1 - i))] as [bigint],
        chainId: ARC_TESTNET_ID,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyCount]
  )

  const { data: jobResults, isLoading: isLoadingJobs } = useReadContracts({
    contracts: jobContracts,
    query: { enabled: showHistory && historyCount > 0 },
  })

  const completedJobs = useMemo((): OnchainJob[] => {
    if (!jobResults || !showHistory) return []
    return jobResults
      .slice(0, fetchCount)
      .map((r) => r.result as OnchainJob | undefined)
      .filter((j): j is OnchainJob =>
        j !== undefined &&
        j.talent.toLowerCase() === talentAddr.toLowerCase() &&
        j.status === JobStatus.Completed
      )
  }, [jobResults, fetchCount, talentAddr, showHistory])

  // ── Derived ───────────────────────────────────────────────────────────────
  const p = profile as OnchainProfile | undefined
  const r = reputation as OnchainReputation | undefined
  const s = (score as bigint | undefined) ?? 0n
  const avgRating = r && r.ratingCount > 0n ? Number(r.ratingSum) / Number(r.ratingCount) : 0

  const isLoading = isLoadingProfile || isLoadingRep || isLoadingScore

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) return <ProfileSkeleton />

  // ── Error state ───────────────────────────────────────────────────────────
  if (isErrorProfile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Link to="/talent" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] mb-6">
          <ArrowLeft size={15} /> Talent Directory
        </Link>
        <div className="rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] p-8">
          <AlertCircle size={36} className="mx-auto mb-3 text-[var(--danger)]" />
          <p className="font-semibold text-[var(--ink)] mb-1">Could not load profile</p>
          <p className="text-sm text-[var(--muted)]">Check your connection and try refreshing the page.</p>
        </div>
      </div>
    )
  }

  // ── Empty / unregistered state (only after data has loaded) ───────────────
  if (!p?.exists) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Link to="/talent" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] mb-6">
          <ArrowLeft size={15} /> Talent Directory
        </Link>
        <div className="rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] p-8">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-muted)] flex items-center justify-center mx-auto mb-4 text-2xl text-[var(--subtle)]">?</div>
          <p className="font-semibold text-[var(--ink)] mb-1">No profile registered</p>
          <p className="text-sm text-[var(--muted)] mb-1">
            {formatAddress(talentAddr)} hasn&apos;t created an ArcTalent profile yet.
          </p>
          {isSelf && (
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)]">
              Create your profile
            </Link>
          )}
        </div>
      </div>
    )
  }

  const featuredSkills = p.skills.slice(0, 3)
  const remainingSkills = p.skills.slice(3)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link to="/talent" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] mb-6 transition-colors">
        <ArrowLeft size={15} /> Talent Directory
      </Link>

      {/* ── Profile header card with banner ── */}
      <div className="card rounded-2xl overflow-hidden mb-5">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-br from-[var(--accent-subtle)] via-[var(--surface-muted)] to-[var(--surface-strong)]" />

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Avatar overlapping banner */}
          <div className="flex items-end justify-between -mt-10 mb-4">
            <div className="border-4 border-[var(--surface-strong)] rounded-2xl shadow-md">
              <Avatar
                fetchRemote
                address={talentAddr}
                name={p.name}
                size={80}
                className="shadow-none"
              />
            </div>
            <div className="flex items-center gap-2 mb-1">
              {/* Verified on Arc badge */}
              <a
                href={buildArcScanAddr(CONTRACTS.talentRegistry)}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20 hover:border-[var(--accent)]/50 transition-colors"
              >
                <ExternalLink size={10} /> Verified on Arc
              </a>
            </div>
          </div>

          {/* Name + address */}
          <div className="mb-4">
            <h1 className="heading-lg text-[var(--ink)] mb-1">{p.name}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={buildArcScanAddr(talentAddr)}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-xs text-[var(--subtle)] mono hover:text-[var(--accent)] transition-colors"
              >
                {formatAddress(talentAddr)} <ExternalLink size={10} />
              </a>
              {p.location && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                  <MapPin size={11} /> {p.location}
                </span>
              )}
              {isSelf && (
                <Link to="/dashboard" className="text-xs text-[var(--accent)] hover:underline font-medium">Edit profile</Link>
              )}
            </div>
          </div>

          {/* Stats pills row */}
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)]">
              <Briefcase size={14} className="text-[var(--accent)]" />
              <div>
                <div className="text-base font-bold tabular-nums text-[var(--ink)] leading-none">{Number(r?.jobsCompleted ?? 0n)}</div>
                <div className="text-xs text-[var(--muted)]">Jobs Done</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)]">
              <Star size={14} className="text-amber-500" />
              <div>
                <div className="text-base font-bold tabular-nums text-[var(--ink)] leading-none">
                  {avgRating > 0 ? avgRating.toFixed(1) : '–'}
                </div>
                <div className="text-xs text-[var(--muted)]">Avg Rating</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)]">
              <USDCLogo size={14} />
              <div>
                <div className="text-base font-bold tabular-nums text-[var(--ink)] leading-none">
                  {r && r.totalUSDCEarned > 0n ? formatUSDCFull(r.totalUSDCEarned) : '–'}
                </div>
                <div className="text-xs text-[var(--muted)]">Earned</div>
              </div>
            </div>
            {p.preferredRate > 0n && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)]">
                <USDCLogo size={14} />
                <div>
                  <div className="text-base font-bold tabular-nums text-[var(--ink)] leading-none">
                    {formatUSDCShort(p.preferredRate)}/hr
                  </div>
                  <div className="text-xs text-[var(--muted)]">Rate</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)]">
              <ReputationBadge
                score={s}
                jobsCompleted={r?.jobsCompleted}
                ratingSum={r?.ratingSum}
                ratingCount={r?.ratingCount}
                totalEarned={r?.totalUSDCEarned}
                size="md"
              />
            </div>
          </div>

          {/* Bio */}
          {p.bio && (
            <p className="text-sm text-[var(--ink-2)] leading-relaxed mb-5">
              {p.bio}
            </p>
          )}

          {/* Skills */}
          {p.skills.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Skills</p>
              <div className="flex flex-wrap gap-2">
                {featuredSkills.map((skill, i) => (
                  <span key={skill} className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                    i === 0
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20'
                      : 'bg-[var(--surface-muted)] text-[var(--ink-2)] border border-[var(--border)]'
                  }`}>
                    {skill}
                  </span>
                ))}
                {remainingSkills.map((skill) => (
                  <SkillTag key={skill} skill={skill} />
                ))}
              </div>
            </div>
          )}

          {/* Portfolio links */}
          {p.portfolioLinks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Portfolio</p>
              <div className="space-y-2">
                {p.portfolioLinks.map((link) => {
                  const { domain, path } = parsePortfolioLink(link)
                  return (
                    <a
                      key={link}
                      href={link.startsWith('http') ? link : `https://${link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)] transition-colors group"
                    >
                      <Globe size={15} className="text-[var(--accent)] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors truncate">
                          {domain}
                        </div>
                        {path && (
                          <div className="text-xs text-[var(--subtle)] truncate">/{path}</div>
                        )}
                      </div>
                      <ExternalLink size={12} className="text-[var(--subtle)] shrink-0 group-hover:text-[var(--accent)] transition-colors" />
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ratings summary */}
      {r && r.ratingCount > 0n && (
        <div className="card rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="heading-md text-[var(--ink)]">Ratings</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-5xl font-bold display text-amber-500 leading-none">{avgRating.toFixed(1)}</div>
            <div>
              <div className="flex gap-0.5 text-2xl mb-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={i <= Math.round(avgRating) ? 'text-amber-400' : 'text-[var(--border-strong)]'}>★</span>
                ))}
              </div>
              <div className="text-sm text-[var(--muted)]">
                from {Number(r.ratingCount)} completed job{Number(r.ratingCount) !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* On-demand work history */}
      <div className="card rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-muted)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-[var(--accent)]" />
            <span className="font-semibold text-[var(--ink)] text-sm">Work History</span>
            <span className="text-xs text-[var(--subtle)]">(last {MAX_PROFILE_JOBS} on-chain jobs)</span>
          </div>
          <span className="text-xs font-semibold text-[var(--accent)]">{showHistory ? 'Hide ↑' : 'Show ↓'}</span>
        </button>

        {showHistory && (
          <div className="border-t border-[var(--border)] px-5 py-4">
            {isLoadingJobs ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-[var(--surface-muted)] animate-pulse" />
                ))}
              </div>
            ) : completedJobs.length === 0 ? (
              <div className="text-center py-6 text-[var(--muted)]">
                <Star size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No completed jobs found in the last {MAX_PROFILE_JOBS} on-chain records.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {completedJobs.map((job) => (
                  <Link
                    key={Number(job.id)}
                    to={`/jobs/${Number(job.id)}`}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[var(--surface-muted)] hover:bg-[var(--surface-strong)] border border-transparent hover:border-[var(--border)] transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--ink)] truncate group-hover:text-[var(--accent)] transition-colors">{job.title}</p>
                      <p className="text-xs text-[var(--subtle)] mt-0.5">{formatDeadline(job.postedAt)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-[var(--success)]">
                        {formatUSDCFull((job.budget * 96n) / 100n)}
                      </div>
                      {job.rating > 0 && (
                        <div className="text-xs text-amber-500">{'★'.repeat(job.rating)}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
