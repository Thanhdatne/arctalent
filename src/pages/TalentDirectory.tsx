import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useReadContracts } from 'wagmi'
import { Search, SlidersHorizontal, Users } from 'lucide-react'
import { TalentCard } from '@/components/talent/TalentCard'
import { TalentCardSkeleton } from '@/components/talent/TalentCardSkeleton'
import { FilterChips } from '@/components/ui/FilterChips'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { TALENT_REGISTRY_ABI, type OnchainProfile, type OnchainReputation } from '@/lib/contracts'
import { CONTRACTS, ARC_TESTNET_ID } from '@/config'
import { useRegisteredTalents } from '@/hooks/useRegisteredTalents'

const SKILLS_FILTER = [
  'Solidity', 'React', 'TypeScript', 'Audit', 'Design', 'Content',
  'Community', 'Research', 'Python', 'Rust', 'DeFi', 'ZK Proofs',
]

const CATEGORIES: { label: string; skills: string[] }[] = [
  { label: 'Dev', skills: ['Solidity', 'React', 'TypeScript', 'Python', 'Rust'] },
  { label: 'Audit', skills: ['Audit', 'Solidity', 'ZK Proofs'] },
  { label: 'DeFi', skills: ['DeFi', 'Solidity'] },
  { label: 'Design', skills: ['Design'] },
  { label: 'Content', skills: ['Content', 'Community'] },
  { label: 'Research', skills: ['Research', 'ZK Proofs'] },
]

type SortKey = 'reputation' | 'jobs' | 'rate-asc' | 'newest'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'reputation', label: 'Reputation' },
  { key: 'jobs', label: 'Jobs Done' },
  { key: 'rate-asc', label: 'Rate ↑' },
  { key: 'newest', label: 'Newest' },
]

export function TalentDirectory() {
  const [search, setSearch] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('reputation')
  const [maxRate, setMaxRate] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const { talents, loading: talentsLoading, error: talentsError } = useRegisteredTalents()

  const profileResults = useReadContracts({
    contracts: talents.map((addr) => ({
      address: CONTRACTS.talentRegistry,
      abi: TALENT_REGISTRY_ABI,
      functionName: 'getProfile' as const,
      args: [addr] as [`0x${string}`],
      chainId: ARC_TESTNET_ID,
    })),
  })

  const reputationResults = useReadContracts({
    contracts: talents.map((addr) => ({
      address: CONTRACTS.talentRegistry,
      abi: TALENT_REGISTRY_ABI,
      functionName: 'getReputation' as const,
      args: [addr] as [`0x${string}`],
      chainId: ARC_TESTNET_ID,
    })),
  })

  const scoreResults = useReadContracts({
    contracts: talents.map((addr) => ({
      address: CONTRACTS.talentRegistry,
      abi: TALENT_REGISTRY_ABI,
      functionName: 'reputationScore' as const,
      args: [addr] as [`0x${string}`],
      chainId: ARC_TESTNET_ID,
    })),
  })

  const isLoading = talentsLoading || (talents.length > 0 && (profileResults.isLoading || !profileResults.data))

  const talentData = useMemo(() =>
    talents
      .map((addr, i) => ({
        address: addr,
        profile: profileResults.data?.[i]?.result as OnchainProfile | undefined,
        reputation: reputationResults.data?.[i]?.result as OnchainReputation | undefined,
        score: (scoreResults.data?.[i]?.result as bigint | undefined) ?? 0n,
      }))
      .filter((t) => t.profile?.exists),
    [talents, profileResults.data, reputationResults.data, scoreResults.data])

  const maxRateNum = maxRate ? parseFloat(maxRate) : null
  const hasActiveFilters = selectedSkills.length > 0 || maxRate !== '' || search !== ''

  const filtered = useMemo(() => talentData.filter((t) => {
    const p = t.profile!
    if (search) {
      const q = search.toLowerCase()
      const matchesName = p.name.toLowerCase().includes(q)
      const matchesBio = p.bio.toLowerCase().includes(q)
      const matchesSkill = p.skills.some((sk) => sk.toLowerCase().includes(q))
      if (!matchesName && !matchesBio && !matchesSkill) return false
    }
    if (selectedSkills.length > 0 && !selectedSkills.some((s) => p.skills.map((sk) => sk.toLowerCase()).includes(s.toLowerCase()))) return false
    if (maxRateNum !== null && p.preferredRate > 0n && Number(p.preferredRate) / 1e6 > maxRateNum) return false
    return true
  }), [talentData, search, selectedSkills, maxRateNum])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortKey === 'reputation') return Number(b.score - a.score)
    if (sortKey === 'jobs') return Number((b.reputation?.jobsCompleted ?? 0n) - (a.reputation?.jobsCompleted ?? 0n))
    if (sortKey === 'rate-asc') {
      const ar = Number(a.profile?.preferredRate ?? 0n)
      const br = Number(b.profile?.preferredRate ?? 0n)
      if (ar === 0 && br === 0) return 0
      if (ar === 0) return 1
      if (br === 0) return -1
      return ar - br
    }
    return Number((b.profile?.registeredAt ?? 0n) - (a.profile?.registeredAt ?? 0n))
  }), [filtered, sortKey])

  const toggleSkill = (s: string) =>
    setSelectedSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])

  const filterChips = [
    ...(search ? [{ label: `"${search}"`, onRemove: () => setSearch('') }] : []),
    ...selectedSkills.map((s) => ({ label: s, onRemove: () => toggleSkill(s) })),
    ...(maxRate ? [{ label: `Max $${maxRate}/hr`, onRemove: () => setMaxRate('') }] : []),
  ]

  // Shortcuts shown inline — most common categories, no panel needed
  const SKILL_SHORTCUTS = ['Solidity', 'React', 'Audit', 'DeFi', 'Design', 'Research']

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Page header */}
      <div className="mb-8">
        <SectionLabel>Directory</SectionLabel>
        <h1 className="heading-lg text-[var(--ink)]">Find Web3 talent</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Discover professionals with verifiable onchain reputations.</p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or skills…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
          />
        </div>

        {/* Sort */}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)] cursor-pointer"
        >
          {SORT_OPTIONS.map(({ key, label }) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {/* Filter toggle */}
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
          {hasActiveFilters && (
            <span className="ml-0.5 text-xs font-bold">
              ({selectedSkills.length + (maxRate ? 1 : 0)})
            </span>
          )}
        </button>

        {/* Result count */}
        {!isLoading && sorted.length > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-[var(--subtle)] whitespace-nowrap self-center px-1">
            <Users size={14} />
            {sorted.length} builder{sorted.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Skill shortcuts row ── always visible, no panel click needed ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SKILL_SHORTCUTS.map((s) => (
          <button
            key={s}
            onClick={() => toggleSkill(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              selectedSkills.includes(s)
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-[var(--surface-muted)] text-[var(--ink-2)] border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Expanded filters ── */}
      {showFilters && (
        <div className="card rounded-2xl p-5 mb-5">
          <div className="grid sm:grid-cols-2 gap-5">
            {/* Categories */}
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Categories</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    onClick={() => setSelectedSkills(cat.skills)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--ink-2)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-colors"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Max rate */}
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Max Rate (USDC/hr)</p>
              <div className="relative max-w-xs">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  value={maxRate}
                  onChange={(e) => setMaxRate(e.target.value)}
                  placeholder="Any"
                  className="w-full pl-8 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
                />
              </div>
            </div>
          </div>

          {/* Skill tags */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {SKILLS_FILTER.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSkill(s)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    selectedSkills.includes(s)
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--surface-muted)] text-[var(--ink-2)] border-[var(--border)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Active filter chips ── */}
      <FilterChips
        chips={filterChips}
        onClearAll={() => { setSelectedSkills([]); setMaxRate(''); setSearch('') }}
        className="mb-5"
      />

      {/* ── Results ── */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <TalentCardSkeleton key={i} />)}
        </div>
      ) : talentsError ? (
        <div className="text-center py-20 text-[var(--muted)]">
          <Users size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-semibold text-[var(--ink)] mb-1">Could not load talent profiles</p>
          <p className="text-sm text-[var(--muted)]">RPC error — check your connection and try refreshing.</p>
        </div>
      ) : talents.length === 0 ? (
        <div className="text-center py-20 text-[var(--muted)]">
          <Users size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-semibold text-[var(--ink)] mb-1">No profiles registered yet</p>
          <p className="text-sm">
            <Link to="/dashboard" className="text-[var(--accent)] hover:underline">Create the first profile.</Link>
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 text-[var(--muted)]">
          <SlidersHorizontal size={36} className="mx-auto mb-3 opacity-25" />
          <p className="font-semibold text-[var(--ink)] mb-1">No talent match these filters</p>
          <button
            onClick={() => { setSelectedSkills([]); setMaxRate(''); setSearch('') }}
            className="text-sm text-[var(--accent)] hover:underline mt-1"
          >
            Clear search and filters
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sorted.map((t) => (
            <TalentCard
              key={t.address}
              address={t.address}
              profile={t.profile!}
              reputation={t.reputation ?? { jobsCompleted: 0n, ratingSum: 0n, ratingCount: 0n, totalUSDCEarned: 0n }}
              score={t.score}
            />
          ))}
        </div>
      )}
    </div>
  )
}
