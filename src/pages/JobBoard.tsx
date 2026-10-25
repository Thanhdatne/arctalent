import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useReadContract, useReadContracts, useAccount } from 'wagmi'
import { Search, Briefcase, Plus, Bookmark, SlidersHorizontal } from 'lucide-react'
import { JobCard } from '@/components/jobs/JobCard'
import { JobCardSkeleton } from '@/components/jobs/JobCardSkeleton'
import { SkillTag } from '@/components/talent/SkillTag'
import { FilterChips } from '@/components/ui/FilterChips'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { JOB_ESCROW_ABI, type OnchainJob, JobStatus, JobType } from '@/lib/contracts'
import { CONTRACTS, ARC_TESTNET_ID } from '@/config'
import { useSavedJobs } from '@/hooks/useSavedJobs'

const COMMON_SKILLS = ['Solidity', 'React', 'TypeScript', 'Audit', 'Design', 'Content', 'Community', 'Research', 'Python', 'Rust']
const MAX_JOBS = 50

type StatusFilter = 'open' | 'all' | 'saved'
type TypeFilter = 'all' | 'fixed' | 'bounty' | 'referral'

export function JobBoard() {
  const { isConnected, address } = useAccount()
  const [search, setSearch] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [showFilters, setShowFilters] = useState(false)

  const { saved, isSaved, toggleSave } = useSavedJobs(address)

  const { data: jobCount } = useReadContract({
    address: CONTRACTS.jobEscrow,
    abi: JOB_ESCROW_ABI,
    functionName: 'getJobCount',
    chainId: ARC_TESTNET_ID,
  })

  const count = Number(jobCount ?? 0n)
  const fetchCount = Math.min(count, MAX_JOBS)
  const isLoading = jobCount === undefined

  // Stable fixed-length contract list — always MAX_JOBS entries
  const jobContracts = useMemo(
    () =>
      Array.from({ length: MAX_JOBS }, (_, i) => ({
        address: CONTRACTS.jobEscrow,
        abi: JOB_ESCROW_ABI,
        functionName: 'getJob' as const,
        args: [BigInt(count - 1 - i)] as [bigint],
        chainId: ARC_TESTNET_ID,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count]
  )

  const { data: jobResults } = useReadContracts({
    contracts: jobContracts,
    query: { enabled: count > 0 },
  })

  // Stable fixed-length applicant count batch
  const applicantContracts = useMemo(
    () =>
      Array.from({ length: MAX_JOBS }, (_, i) => ({
        address: CONTRACTS.jobEscrow,
        abi: JOB_ESCROW_ABI,
        functionName: 'getApplicants' as const,
        args: [BigInt(count - 1 - i)] as [bigint],
        chainId: ARC_TESTNET_ID,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count]
  )

  const { data: applicantResults } = useReadContracts({
    contracts: applicantContracts,
    query: { enabled: count > 0 },
  })

  const jobs: OnchainJob[] = useMemo(() => {
    if (!jobResults) return []
    return jobResults
      .slice(0, fetchCount)
      .map((r) => r.result as OnchainJob | undefined)
      .filter((j): j is OnchainJob => j !== undefined)
  }, [jobResults, fetchCount])

  const applicantCounts = useMemo((): Map<number, number> => {
    const m = new Map<number, number>()
    if (!applicantResults) return m
    applicantResults.slice(0, fetchCount).forEach((r, i) => {
      const jobId = count - 1 - i
      const arr = r.result as `0x${string}`[] | undefined
      m.set(jobId, arr?.length ?? 0)
    })
    return m
  }, [applicantResults, fetchCount, count])

  const filtered = useMemo(() => jobs.filter((j) => {
    if (statusFilter === 'open' && j.status !== JobStatus.Open) return false
    if (statusFilter === 'saved' && !isSaved(Number(j.id))) return false
    if (typeFilter === 'fixed' && j.jobType !== JobType.Fixed) return false
    if (typeFilter === 'bounty' && j.jobType !== JobType.Bounty) return false
    if (typeFilter === 'referral' && j.jobType !== JobType.ReferralEligible) return false
    if (search && !j.title.toLowerCase().includes(search.toLowerCase()) && !j.description.toLowerCase().includes(search.toLowerCase())) return false
    if (selectedSkills.length > 0 && !selectedSkills.some((s) => j.skills.map((sk) => sk.toLowerCase()).includes(s.toLowerCase()))) return false
    return true
  }), [jobs, statusFilter, typeFilter, search, selectedSkills, isSaved])

  const toggleSkill = (skill: string) =>
    setSelectedSkills((prev) => prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill])

  const hasActiveFilters = selectedSkills.length > 0 || typeFilter !== 'all'

  const filterChips = [
    ...selectedSkills.map((s) => ({ label: s, onRemove: () => toggleSkill(s) })),
    ...(typeFilter !== 'all' ? [{ label: typeFilter === 'fixed' ? 'Fixed Price' : typeFilter === 'bounty' ? 'Bounty' : 'Referral', onRemove: () => setTypeFilter('all') }] : []),
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Page header */}
      <div className="mb-8">
        <SectionLabel>Opportunities</SectionLabel>
        <h1 className="heading-lg text-[var(--ink)]">Job Board</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Web3 jobs with USDC escrow on Arc.</p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
          />
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
            hasActiveFilters || showFilters
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'bg-[var(--surface-input)] border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]'
          }`}
        >
          <SlidersHorizontal size={14} />
          Filters
          {hasActiveFilters && <span className="text-xs font-bold">({filterChips.length})</span>}
        </button>

        {isConnected && (
          <Link
            to="/post-job"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Plus size={15} /> Post Job
          </Link>
        )}
      </div>

      {/* ── Status tabs ── */}
      <div className="flex gap-1 bg-[var(--surface-muted)] rounded-xl p-1 mb-4 w-fit">
        {([
          { id: 'open' as StatusFilter, label: 'Open' },
          { id: 'all' as StatusFilter, label: 'All Jobs' },
          ...(isConnected ? [{ id: 'saved' as StatusFilter, label: `Saved${saved.length > 0 ? ` (${saved.length})` : ''}` }] : []),
        ]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setStatusFilter(id)}
            className={`flex items-center gap-1.5 py-1.5 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              statusFilter === id
                ? 'bg-[var(--surface-strong)] text-[var(--ink)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink-2)]'
            }`}
          >
            {id === 'saved' && <Bookmark size={13} />}
            {label}
          </button>
        ))}
      </div>

      {/* ── Expanded filters ── */}
      {showFilters && (
        <div className="card rounded-2xl p-5 mb-5">
          <div className="grid sm:grid-cols-2 gap-5">
            {/* Job type */}
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Job Type</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { id: 'all' as TypeFilter, label: 'Any Type' },
                  { id: 'fixed' as TypeFilter, label: 'Fixed Price' },
                  { id: 'bounty' as TypeFilter, label: 'Bounty' },
                  { id: 'referral' as TypeFilter, label: 'Referral' },
                ]).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setTypeFilter(id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      typeFilter === id
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--surface-muted)] text-[var(--ink-2)] border-[var(--border)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SKILLS.map((s) => (
                  <SkillTag
                    key={s}
                    skill={s}
                    selected={selectedSkills.includes(s)}
                    onClick={() => toggleSkill(s)}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      <FilterChips
        chips={filterChips}
        onClearAll={() => { setSelectedSkills([]); setTypeFilter('all') }}
        className="mb-5"
      />

      {/* ── Results ── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)}
        </div>
      ) : count === 0 ? (
        <div className="text-center py-20 text-[var(--muted)]">
          <Briefcase size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-semibold text-[var(--ink)] mb-1">No jobs yet</p>
          <p className="text-sm">
            {isConnected ? (
              <Link to="/post-job" className="text-[var(--accent)] hover:underline">Post the first one</Link>
            ) : (
              'Connect your wallet to post a job'
            )}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-[var(--muted)]">
          <SlidersHorizontal size={36} className="mx-auto mb-3 opacity-25" />
          <p className="font-semibold text-[var(--ink)] mb-1">
            {statusFilter === 'saved' ? 'No saved jobs' : 'No matching jobs'}
          </p>
          <p className="text-sm mt-1">
            {statusFilter === 'saved'
              ? 'Bookmark jobs using the save button on each card.'
              : (
                <button
                  onClick={() => { setSelectedSkills([]); setTypeFilter('all'); setSearch('') }}
                  className="text-[var(--accent)] hover:underline"
                >
                  Clear filters
                </button>
              )
            }
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--subtle)] mb-4">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((job) => (
              <JobCard
                key={Number(job.id)}
                job={job}
                applicantCount={applicantCounts.get(Number(job.id))}
                isSaved={isSaved(Number(job.id))}
                onToggleSave={isConnected ? () => toggleSave(Number(job.id)) : undefined}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
