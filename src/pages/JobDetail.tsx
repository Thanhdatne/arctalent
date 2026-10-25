import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { ArrowLeft, Clock, ExternalLink, CheckCircle } from 'lucide-react'
import { USDCLogo } from '@/components/ui/USDCLogo'
import { ConnectKitButton } from 'connectkit'
import { EscrowFlow } from '@/components/jobs/EscrowFlow'
import { SkillTag } from '@/components/talent/SkillTag'
import { JOB_ESCROW_ABI, TALENT_REGISTRY_ABI, JOB_STATUS_LABELS, JOB_STATUS_COLORS, JOB_TYPE_LABELS, type OnchainJob, type OnchainProfile, JobStatus } from '@/lib/contracts'
import { CONTRACTS, ARC_TESTNET_ID } from '@/config'
import { formatUSDCFull, formatDeadline, formatAddress, deadlineStatus, buildArcScanAddr } from '@/lib/utils'

// Max applicants we will fetch profiles for — keeps hook count stable
const MAX_APPLICANT_PROFILES = 20

// Loading skeleton shown while job data is fetching
function JobSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-pulse">
      <div className="h-4 w-32 rounded bg-[var(--surface-muted)] mb-6" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] p-6 space-y-4">
            <div className="h-7 w-2/3 rounded bg-[var(--surface-muted)]" />
            <div className="flex gap-3">
              <div className="h-5 w-24 rounded bg-[var(--surface-muted)]" />
              <div className="h-5 w-24 rounded bg-[var(--surface-muted)]" />
            </div>
            <div className="space-y-2">
              <div className="h-4 rounded bg-[var(--surface-muted)]" />
              <div className="h-4 w-5/6 rounded bg-[var(--surface-muted)]" />
              <div className="h-4 w-4/6 rounded bg-[var(--surface-muted)]" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] p-5 h-40" />
      </div>
    </div>
  )
}

export function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const isWrongChain = chainId !== ARC_TESTNET_ID
  const jobId = id ? BigInt(id) : 0n
  const [refreshKey, setRefreshKey] = useState(0)

  const { data: rawJob, refetch } = useReadContract({
    address: CONTRACTS.jobEscrow,
    abi: JOB_ESCROW_ABI,
    functionName: 'getJob',
    args: [jobId],
    chainId: ARC_TESTNET_ID,
  })

  const { data: rawApplicants } = useReadContract({
    address: CONTRACTS.jobEscrow,
    abi: JOB_ESCROW_ABI,
    functionName: 'getApplicants',
    args: [jobId],
    chainId: ARC_TESTNET_ID,
    query: { refetchInterval: refreshKey >= 0 ? 10000 : undefined },
  })

  const job = rawJob as OnchainJob | undefined
  const applicants = (rawApplicants as `0x${string}`[] | undefined) ?? []

  // ── Display name lookups ──────────────────────────────────────────────
  // Stable fixed-length array: always MAX_APPLICANT_PROFILES entries.
  // Slots beyond the real applicant count are left disabled via `query.enabled`.
  // This keeps the hook call count constant between renders (Rules of Hooks safe).
  const applicantProfileContracts = useMemo(
    () =>
      Array.from({ length: MAX_APPLICANT_PROFILES }, (_, i) => ({
        address: CONTRACTS.talentRegistry,
        abi: TALENT_REGISTRY_ABI,
        functionName: 'getProfile' as const,
        args: [(applicants[i] ?? '0x0000000000000000000000000000000000000000')],
        chainId: ARC_TESTNET_ID,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applicants.length]
  )

  const { data: applicantProfileResults } = useReadContracts({
    contracts: applicantProfileContracts,
    query: { enabled: applicants.length > 0 },
  })

  // Map address → display name (falls back to formatted address)
  const applicantNames = useMemo(() => {
    const map = new Map<string, string>()
    applicants.slice(0, MAX_APPLICANT_PROFILES).forEach((addr, i) => {
      const profile = applicantProfileResults?.[i]?.result as OnchainProfile | undefined
      map.set(addr.toLowerCase(), profile?.exists && profile.name ? profile.name : formatAddress(addr))
    })
    return map
  }, [applicants, applicantProfileResults])

  // Client display name lookup (single call — stable, always runs)
  const { data: clientProfileRaw } = useReadContract({
    address: CONTRACTS.talentRegistry,
    abi: TALENT_REGISTRY_ABI,
    functionName: 'getProfile',
    args: [job?.client ?? '0x0000000000000000000000000000000000000000'],
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!job?.client },
  })
  const clientProfile = clientProfileRaw as OnchainProfile | undefined
  const clientDisplayName = clientProfile?.exists && clientProfile.name
    ? clientProfile.name
    : job ? formatAddress(job.client) : ''

  // ── Derived state ─────────────────────────────────────────────────────
  const isClient = address?.toLowerCase() === job?.client.toLowerCase()
  const isTalent = address?.toLowerCase() === job?.talent.toLowerCase()
  const hasApplied = address ? applicants.some((a) => a.toLowerCase() === address.toLowerCase()) : false
  const hasTalentSelected = job?.talent && job.talent !== '0x0000000000000000000000000000000000000000'

  // Apply
  const { writeContract: applyFn, data: applyTx, isPending: applying } = useWriteContract()
  const { isLoading: applyConfirming, isSuccess: applied } = useWaitForTransactionReceipt({ hash: applyTx })

  // Select talent
  const { writeContract: selectFn, data: selectTx, isPending: selectPending } = useWriteContract()
  const { isLoading: selectConfirming, isSuccess: selected } = useWaitForTransactionReceipt({ hash: selectTx })

  const handleApply = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }
    applyFn({ address: CONTRACTS.jobEscrow, abi: JOB_ESCROW_ABI, functionName: 'applyToJob', args: [jobId] })
  }

  const handleSelect = (talent: `0x${string}`) => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }
    selectFn({ address: CONTRACTS.jobEscrow, abi: JOB_ESCROW_ABI, functionName: 'selectTalent', args: [jobId, talent] })
  }

  if (applied || selected) { void refetch(); setRefreshKey((k) => k + 1) }

  // Show skeleton while job is loading
  if (!job) return <JobSkeleton />

  const dl = deadlineStatus(job.deadline)
  const statusLabel = JOB_STATUS_LABELS[job.status] ?? 'Unknown'
  const statusColor = JOB_STATUS_COLORS[job.status] ?? ''

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/jobs" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] mb-6">
        <ArrowLeft size={15} /> Back to Job Board
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className="text-2xl font-bold text-[var(--ink)] display leading-tight">{job.title}</h1>
              <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)] mb-5">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                <USDCLogo size={15} />
                {formatUSDCFull(job.budget)} USDC
              </span>
              <span className={`flex items-center gap-1 ${dl === 'past' ? 'text-[var(--danger)]' : dl === 'soon' ? 'text-orange-500' : ''}`}>
                <Clock size={14} />
                Due {formatDeadline(job.deadline)}
              </span>
              <span className="text-[var(--subtle)]">{JOB_TYPE_LABELS[job.jobType]}</span>
              {job.referralEligible && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--surface-muted)] text-[var(--muted)] border border-[var(--border)]">
                  Referral Eligible
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-[var(--ink-2)] leading-relaxed whitespace-pre-wrap mb-5">
              {job.description}
            </p>

            {/* Skills */}
            {job.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {job.skills.map((s) => <SkillTag key={s} skill={s} />)}
              </div>
            )}

            {/* Posted by — shows display name when profile exists */}
            <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between text-sm">
              <span className="text-[var(--subtle)]">Posted by</span>
              <a
                href={buildArcScanAddr(job.client)}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors"
              >
                <span className="font-medium text-[var(--ink)]">{clientDisplayName}</span>
                <span className="text-[var(--subtle)] mono text-xs">{formatAddress(job.client)}</span>
                <ExternalLink size={11} className="text-[var(--subtle)]" />
              </a>
            </div>
          </div>

          {/* Apply button (talent, Open status, not client) */}
          {job.status === JobStatus.Open && !isClient && !hasTalentSelected && (
            <div className="rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] p-5">
              {!isConnected ? (
                <div className="text-center">
                  <p className="text-sm text-[var(--muted)] mb-3">Connect your wallet to apply</p>
                  <ConnectKitButton />
                </div>
              ) : hasApplied || applied ? (
                <div className="flex items-center gap-2 text-[var(--success)] text-sm font-medium">
                  <CheckCircle size={18} />
                  Application submitted! The client will review and select a talent.
                </div>
              ) : (
                <div>
                  <p className="text-sm text-[var(--muted)] mb-3">
                    Interested in this job? Apply now — the client will review and select a talent, then fund the escrow.
                  </p>
                  <button
                    onClick={handleApply}
                    disabled={applying || applyConfirming}
                    className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
                  >
                    {applying ? 'Confirm in wallet…' : applyConfirming ? 'Submitting…' : 'Apply to This Job'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Applicant list (client view) — shows display name + address */}
          {isClient && job.status === JobStatus.Open && applicants.length > 0 && !hasTalentSelected && (
            <div className="rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] p-5">
              <h3 className="font-semibold text-[var(--ink)] mb-4">Applicants ({applicants.length})</h3>
              <div className="space-y-3">
                {applicants.map((applicant) => {
                  const displayName = applicantNames.get(applicant.toLowerCase()) ?? formatAddress(applicant)
                  const isNameResolved = displayName !== formatAddress(applicant)
                  return (
                    <div key={applicant} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--surface-muted)]">
                      <Link to={`/talent/${applicant}`} className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[var(--surface-muted)] border border-[var(--border)] shrink-0 flex items-center justify-center text-[var(--ink-2)] text-xs font-bold">
                          {isNameResolved ? displayName[0].toUpperCase() : '?'}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-sm font-medium text-[var(--ink)] hover:text-[var(--accent)] transition-colors truncate">
                            {displayName}
                          </span>
                          {isNameResolved && (
                            <span className="block text-xs text-[var(--subtle)] mono">{formatAddress(applicant)}</span>
                          )}
                        </div>
                      </Link>
                      <button
                        onClick={() => handleSelect(applicant)}
                        disabled={selectPending || selectConfirming}
                        className="shrink-0 px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
                      >
                        {selectPending || selectConfirming ? 'Selecting…' : 'Select'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Escrow flow — sticky on scroll */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          {(isClient || isTalent) ? (
            <EscrowFlow job={job} onUpdate={() => { void refetch(); setRefreshKey((k) => k + 1) }} />
          ) : (
            <div className="card rounded-2xl p-5 space-y-3">
              {/* Escrow status pill */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-1 ${
                job.status === JobStatus.Funded || job.status === JobStatus.Submitted
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : job.status === JobStatus.Open
                    ? 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-400'
                    : 'bg-[var(--surface-muted)] text-[var(--muted)]'
              }`}>
                {job.status === JobStatus.Funded || job.status === JobStatus.Submitted
                  ? 'Funds in escrow'
                  : job.status === JobStatus.Open
                    ? 'Accepting applications'
                    : job.status === JobStatus.Completed
                      ? 'Completed'
                      : 'Escrow'}
              </div>
              <h3 className="font-semibold text-[var(--ink)] text-sm">Escrow Summary</h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Budget</span>
                  <span className="font-bold">{formatUSDCFull(job.budget)} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Talent receives</span>
                  <span className="font-bold text-[var(--success)]">{formatUSDCFull((job.budget * 96n) / 100n)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Platform fee (4%)</span>
                  <span className="text-[var(--muted)]">{formatUSDCFull((job.budget * 4n) / 100n)}</span>
                </div>
              </div>
              <div className="pt-3 border-t border-[var(--border)] text-xs text-[var(--subtle)]">
                Funds are held in the smart contract until the client confirms delivery.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
