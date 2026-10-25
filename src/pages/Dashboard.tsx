import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { Plus, X, Briefcase, User, Star, Bookmark, Users, ExternalLink, MapPin, ArrowRight, Info } from 'lucide-react'
import { ReputationBadge } from '@/components/talent/ReputationBadge'
import { Avatar } from '@/components/talent/Avatar'
import { AvatarUpload } from '@/components/talent/AvatarUpload'
import { JobCard } from '@/components/jobs/JobCard'
import { ReferralCard } from '@/components/referral/ReferralCard'
import { TALENT_REGISTRY_ABI, JOB_ESCROW_ABI, type OnchainProfile, type OnchainReputation, type OnchainJob } from '@/lib/contracts'
import { CONTRACTS, ARC_TESTNET_ID } from '@/config'
import { parseUSDC, parseOnchainError, formatUSDCFull, formatUSDCShort, formatAddress } from '@/lib/utils'
import { useSavedJobs } from '@/hooks/useSavedJobs'
import { toast } from 'sonner'

type Tab = 'profile' | 'talent' | 'client' | 'saved'

const SKILL_SUGGESTIONS = ['Solidity', 'React', 'TypeScript', 'Audit', 'DeFi', 'NFT', 'Security', 'Design', 'Content', 'Community', 'Research', 'Python']

// Tier thresholds (mirrors reputationTier in utils.ts)
const TIER_THRESHOLDS = [
  { min: 0, max: 50, label: 'New', nextLabel: 'Rising' },
  { min: 50, max: 200, label: 'Rising', nextLabel: 'Proven' },
  { min: 200, max: 1000, label: 'Proven', nextLabel: 'Expert' },
  { min: 1000, max: 5000, label: 'Expert', nextLabel: 'Elite' },
  { min: 5000, max: Infinity, label: 'Elite', nextLabel: null },
]

function TierProgress({ score }: { score: bigint }) {
  const s = Number(score)
  const tier = TIER_THRESHOLDS.find((t) => s >= t.min && s < t.max) ?? TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1]
  if (!tier.nextLabel) {
    return (
      <div className="mt-2">
        <p className="text-white/70 text-xs">You&apos;ve reached the top tier!</p>
      </div>
    )
  }
  const range = tier.max - tier.min
  const progress = Math.min(100, Math.round(((s - tier.min) / range) * 100))
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-white/70 mb-1">
        <span>{progress}% to {tier.nextLabel}</span>
        <span>{tier.max - s} pts needed</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/20">
        <div
          className="h-1.5 rounded-full bg-white transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

/** Read-only card preview of how the public TalentCard will look */
function ProfilePreview({
  address,
  name,
  bio,
  skills,
  preferredRate,
  location,
  avatarKey,
}: {
  address: string
  name: string
  bio: string
  skills: string[]
  preferredRate: string
  location: string
  avatarKey: number
}) {
  const primarySkill = skills[0]
  const secondarySkills = skills.slice(1, 3)
  const overflowCount = skills.length - 3
  const rateNum = parseFloat(preferredRate)
  const rateBigInt = preferredRate && !isNaN(rateNum) ? BigInt(Math.round(rateNum * 1_000_000)) : 0n

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] overflow-hidden">
      <div className="px-4 py-2.5 bg-[var(--surface-muted)] border-b border-[var(--border)]">
        <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Profile preview</p>
      </div>
      <div className="p-5">
        {/* Avatar + name */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar
            key={avatarKey}
            address={address}
            name={name || '?'}
            size={48}
            className="shadow-sm shrink-0"
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="font-semibold text-[var(--ink)] truncate text-base leading-snug">
              {name || <span className="text-[var(--subtle)]">Your name</span>}
            </p>
            <p className="text-xs text-[var(--subtle)] font-mono mt-0.5">{formatAddress(address)}</p>
          </div>
        </div>

        {/* Bio */}
        {bio && (
          <p className="text-sm text-[var(--muted)] line-clamp-2 mb-3 leading-relaxed">{bio}</p>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {primarySkill && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20">
                {primarySkill}
              </span>
            )}
            {secondarySkills.map((s) => (
              <span key={s} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--surface-muted)] text-[var(--ink-2)] border border-[var(--border)]">
                {s}
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="px-2 py-1 text-xs text-[var(--subtle)]">+{overflowCount}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {rateBigInt > 0n && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-[var(--surface-muted)] border-[var(--border)] text-[var(--ink-2)] text-xs font-semibold tabular-nums">
                {formatUSDCShort(rateBigInt)}/hr
              </span>
            )}
            {location && (
              <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
                <MapPin size={10} />
                <span className="truncate max-w-[80px]">{location}</span>
              </div>
            )}
          </div>
          <ArrowRight size={13} className="text-[var(--accent)] opacity-40" />
        </div>
      </div>
    </div>
  )
}

/** Section divider label with optional on-chain/off-chain badge */
function SectionHeader({ title, storage }: { title: string; storage?: 'onchain' | 'device' }) {
  return (
    <div className="flex items-center justify-between pt-2 pb-1 border-b border-[var(--border)] mb-4">
      <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{title}</h3>
      {storage === 'onchain' && (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--accent)] font-medium">
          <Info size={10} /> Saved on-chain
        </span>
      )}
      {storage === 'device' && (
        <span className="inline-flex items-center gap-1 text-xs text-[var(--subtle)] font-medium">
          <Info size={10} /> This device only
        </span>
      )}
    </div>
  )
}

export function Dashboard() {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const [tab, setTab] = useState<Tab>('profile')
  const isWrongChain = chainId !== ARC_TESTNET_ID

  const { saved, isSaved, toggleSave } = useSavedJobs(address)

  // Avatar re-render key — incremented after save/remove so ProfilePreview refreshes
  const [avatarKey, setAvatarKey] = useState(0)
  const handleAvatarChange = useCallback(() => setAvatarKey((k) => k + 1), [])

  // Profile form state
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [portfolioLinks, setPortfolioLinks] = useState<string[]>([''])
  const [preferredRate, setPreferredRate] = useState('')
  const [location, setLocation] = useState('')
  const [profileLoaded, setProfileLoaded] = useState(false)

  const { data: profile, refetch: refetchProfile } = useReadContract({
    address: CONTRACTS.talentRegistry,
    abi: TALENT_REGISTRY_ABI,
    functionName: 'getProfile',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })

  // Populate form fields once profile loads
  useEffect(() => {
    const p = profile as OnchainProfile | undefined
    if (p?.exists && !profileLoaded) {
      setName(p.name)
      setBio(p.bio)
      setSkills(p.skills)
      setPortfolioLinks(p.portfolioLinks.length > 0 ? p.portfolioLinks : [''])
      setPreferredRate(p.preferredRate > 0n ? (Number(p.preferredRate) / 1e6).toString() : '')
      setLocation(p.location)
      setProfileLoaded(true)
    }
  }, [profile, profileLoaded])

  const { data: reputation } = useReadContract({
    address: CONTRACTS.talentRegistry,
    abi: TALENT_REGISTRY_ABI,
    functionName: 'getReputation',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })

  const { data: score } = useReadContract({
    address: CONTRACTS.talentRegistry,
    abi: TALENT_REGISTRY_ABI,
    functionName: 'reputationScore',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })

  const { data: jobCount } = useReadContract({
    address: CONTRACTS.jobEscrow,
    abi: JOB_ESCROW_ABI,
    functionName: 'getJobCount',
    chainId: ARC_TESTNET_ID,
  })

  const count = Number(jobCount ?? 0n)
  const MAX_DASH_JOBS = 30
  const fetchCount = Math.min(count, MAX_DASH_JOBS)

  const jobContracts = useMemo(
    () =>
      Array.from({ length: MAX_DASH_JOBS }, (_, i) => ({
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

  // Stable fixed-length applicant count batch for My Posts
  const applicantContracts = useMemo(
    () =>
      Array.from({ length: MAX_DASH_JOBS }, (_, i) => ({
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
    query: { enabled: count > 0 && tab === 'client' },
  })

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

  const allJobs: OnchainJob[] = useMemo(() => {
    if (!jobResults) return []
    return jobResults
      .slice(0, fetchCount)
      .map((r) => r.result as OnchainJob | undefined)
      .filter((j): j is OnchainJob => j !== undefined)
  }, [jobResults, fetchCount])

  const myClientJobs = allJobs.filter((j) => j.client.toLowerCase() === address?.toLowerCase())
  const myTalentJobs = allJobs.filter((j) => j.talent.toLowerCase() === address?.toLowerCase())
  const savedJobs = allJobs.filter((j) => isSaved(Number(j.id)))

  // Register / update profile
  const { writeContract: registerFn, data: registerTx, isPending: registering, error: registerError } = useWriteContract()
  const { isLoading: registerConfirming, isSuccess: registered } = useWaitForTransactionReceipt({ hash: registerTx })

  const handleRegisterProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name is required'); return }
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }
    const rateBigInt = parseUSDC(preferredRate || '0')
    const cleanLinks = portfolioLinks.filter((l) => l.trim())
    registerFn({
      address: CONTRACTS.talentRegistry,
      abi: TALENT_REGISTRY_ABI,
      functionName: 'registerProfile',
      args: [name.trim(), bio.trim(), skills, cleanLinks, rateBigInt, location.trim()],
    })
  }

  if (registered) { void refetchProfile() }

  const p = profile as OnchainProfile | undefined
  const r = reputation as OnchainReputation | undefined
  const s = (score as bigint | undefined) ?? 0n

  // Profile completeness (0–100)
  const completeness = useMemo(() => {
    let filled = 0
    const total = 6
    if (name.trim()) filled++
    if (bio.trim()) filled++
    if (skills.length > 0) filled++
    if (portfolioLinks.some((l) => l.trim())) filled++
    if (preferredRate) filled++
    if (location.trim()) filled++
    return Math.round((filled / total) * 100)
  }, [name, bio, skills, portfolioLinks, preferredRate, location])

  if (!isConnected) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold display mb-3">Dashboard</h2>
        <p className="text-[var(--muted)] mb-6">Connect your wallet to manage your profile, jobs, and reputation.</p>
        <ConnectKitButton />
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'talent', label: `Selected Jobs (${myTalentJobs.length})`, icon: Star },
    { id: 'client', label: `My Posts (${myClientJobs.length})`, icon: Briefcase },
    { id: 'saved', label: `Saved (${saved.length})`, icon: Bookmark },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="heading-lg text-[var(--ink)]">
            {p?.exists ? `Hello, ${p.name}` : 'Dashboard'}
          </h1>
          {p?.exists ? (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-[var(--muted)] mono">{formatAddress(address ?? '')}</p>
              <Link
                to={`/talent/${address ?? ''}`}
                className="text-xs text-[var(--accent)] hover:underline flex items-center gap-0.5 font-medium"
              >
                <ExternalLink size={10} /> View public profile
              </Link>
            </div>
          ) : (
            <p className="text-[var(--muted)] text-sm mt-1">Manage your profile, jobs, and reputation.</p>
          )}
        </div>
        <Link to="/post-job" className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors shadow-sm">
          <Plus size={15} /> Post Job
        </Link>
      </div>

      {/* Reputation hero */}
      {p?.exists && (
        <div className="card rounded-2xl p-6 mb-6 bg-gradient-to-br from-[var(--accent-subtle)] to-[var(--surface-strong)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Reputation Score</p>
              <ReputationBadge score={s} jobsCompleted={r?.jobsCompleted} ratingSum={r?.ratingSum} ratingCount={r?.ratingCount} totalEarned={r?.totalUSDCEarned} size="lg" />
              <div className="mt-3">
                <TierProgress score={s} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">Total Earned</p>
              <div className="text-2xl font-bold tabular-nums text-[var(--success)] display">
                {r && r.totalUSDCEarned > 0n ? formatUSDCFull(r.totalUSDCEarned) : '$0.00'}
              </div>
              {r && r.ratingCount > 0n && (
                <div className="text-xs text-[var(--muted)] mt-1">
                  {Number(r.ratingCount)} rating{Number(r.ratingCount) !== 1 ? 's' : ''} · avg {(Number(r.ratingSum) / Number(r.ratingCount)).toFixed(1)}★
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-[var(--surface-muted)] rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tab === id ? 'bg-[var(--surface-strong)] text-[var(--ink)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink-2)]'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Profile tab ────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
          {/* Left: form */}
          <form onSubmit={handleRegisterProfile} className="rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] p-6 space-y-6">
            {/* Header + completeness */}
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--ink)]">{p?.exists ? 'Update Profile' : 'Create Your Profile'}</h2>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-[var(--surface-muted)]">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${completeness === 100 ? 'bg-[var(--success)]' : 'bg-[var(--accent)]'}`}
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--muted)]">{completeness}%</span>
              </div>
            </div>

            {/* ── Section: Identity ── */}
            <div>
              <SectionHeader title="Identity" storage="device" />
              {address && (
                <AvatarUpload
                  address={address}
                  name={name}
                  onChange={handleAvatarChange}
                />
              )}
            </div>

            {/* ── Section: About ── */}
            <div>
              <SectionHeader title="About" storage="onchain" />
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">
                      Display Name <span className="text-[var(--danger)]">*</span>
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Your name or pseudonym"
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
                    />
                    <p className="text-xs text-[var(--subtle)] mt-1">Shown as your primary identity across ArcTalent.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Location</label>
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City, Country or Remote"
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Describe your experience and expertise…"
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)] resize-none"
                  />
                </div>
              </div>
            </div>

            {/* ── Section: Skills ── */}
            <div>
              <SectionHeader title="Skills" storage="onchain" />
              <div className="flex flex-wrap gap-2 mb-2">
                {skills.map((skill) => (
                  <span key={skill} className="flex items-center gap-1 pl-3 pr-2 py-1 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20 text-sm font-medium">
                    {skill}
                    <button type="button" onClick={() => setSkills(skills.filter((x) => x !== skill))} className="hover:opacity-70"><X size={11} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const t = skillInput.trim()
                      if (t && !skills.includes(t) && skills.length < 20) { setSkills([...skills, t]); setSkillInput('') }
                    }
                  }}
                  placeholder="Type a skill and press Enter"
                  className="flex-1 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
                />
                <button
                  type="button"
                  onClick={() => { const t = skillInput.trim(); if (t && !skills.includes(t) && skills.length < 20) { setSkills([...skills, t]); setSkillInput('') } }}
                  className="px-3 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-muted)]"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SKILL_SUGGESTIONS.filter((sk) => !skills.includes(sk)).map((sk) => (
                  <button
                    key={sk}
                    type="button"
                    onClick={() => { if (skills.length < 20) setSkills([...skills, sk]) }}
                    className="px-2 py-0.5 text-xs rounded-md bg-[var(--surface-muted)] text-[var(--muted)] hover:bg-[var(--border)]"
                  >
                    + {sk}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Section: Work Preferences ── */}
            <div>
              <SectionHeader title="Work Preferences" storage="onchain" />
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Preferred Rate (USDC/hr)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">$</span>
                  <input
                    value={preferredRate}
                    onChange={(e) => setPreferredRate(e.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
                  />
                </div>
              </div>
            </div>

            {/* ── Section: Portfolio ── */}
            <div>
              <SectionHeader title="Portfolio" storage="onchain" />
              {portfolioLinks.map((link, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    value={link}
                    onChange={(e) => { const updated = [...portfolioLinks]; updated[i] = e.target.value; setPortfolioLinks(updated) }}
                    placeholder="https://github.com/..."
                    type="url"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
                  />
                  {portfolioLinks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPortfolioLinks(portfolioLinks.filter((_, j) => j !== i))}
                      className="p-2 rounded-xl border border-[var(--border)] text-[var(--danger)] hover:bg-[var(--danger)]/10"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
              {portfolioLinks.length < 10 && (
                <button
                  type="button"
                  onClick={() => setPortfolioLinks([...portfolioLinks, ''])}
                  className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
                >
                  <Plus size={13} /> Add link
                </button>
              )}
            </div>

            {registerError && (
              <p className="text-sm text-[var(--danger)] rounded-xl bg-[var(--danger)]/10 px-4 py-2.5">
                {parseOnchainError(registerError)}
              </p>
            )}

            <button
              type="submit"
              disabled={registering || registerConfirming}
              className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
            >
              {registering ? 'Confirm in wallet…' : registerConfirming ? 'Saving…' : registered ? 'Profile saved!' : p?.exists ? 'Update Profile' : 'Create Profile'}
            </button>
          </form>

          {/* Right: live preview (desktop only) */}
          <div className="hidden lg:block sticky top-24 space-y-3">
            <ProfilePreview
              key={avatarKey}
              address={address ?? '0x0000000000000000000000000000000000000000'}
              name={name}
              bio={bio}
              skills={skills}
              preferredRate={preferredRate}
              location={location}
              avatarKey={avatarKey}
            />
            {p?.exists && (
              <Link
                to={`/talent/${address ?? ''}`}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--border-strong)] transition-colors"
              >
                <ExternalLink size={13} /> View full profile
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Referral card (below form on mobile, below preview on desktop) ── */}
      {tab === 'profile' && p?.exists && (
        <div className="mt-6 lg:hidden">
          <ReferralCard />
        </div>
      )}

      {/* ── Selected Jobs tab ── */}
      {tab === 'talent' && (
        <div>
          {myTalentJobs.length === 0 ? (
            <div className="text-center py-16 text-[var(--muted)]">
              <Star size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium text-[var(--ink)] mb-1">No selected jobs yet</p>
              <p className="text-sm">Jobs appear here once a client selects you. Apply on the Job Board to get started.</p>
              <Link to="/jobs" className="text-[var(--accent)] hover:underline text-sm mt-2 block">Browse open jobs</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {myTalentJobs.map((job) => <JobCard key={Number(job.id)} job={job} showClient isSaved={isSaved(Number(job.id))} onToggleSave={() => toggleSave(Number(job.id))} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Client jobs tab ── */}
      {tab === 'client' && (
        <div>
          {myClientJobs.length === 0 ? (
            <div className="text-center py-16 text-[var(--muted)]">
              <Briefcase size={36} className="mx-auto mb-3 opacity-30" />
              <p>You haven&apos;t posted any jobs yet.</p>
              <Link to="/post-job" className="text-[var(--accent)] hover:underline text-sm mt-1 block">Post your first job</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {myClientJobs.map((job) => (
                <div key={Number(job.id)} className="relative">
                  <JobCard
                    job={job}
                    applicantCount={applicantCounts.get(Number(job.id))}
                    isSaved={isSaved(Number(job.id))}
                    onToggleSave={() => toggleSave(Number(job.id))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Saved jobs tab ── */}
      {tab === 'saved' && (
        <div>
          {savedJobs.length === 0 ? (
            <div className="text-center py-16 text-[var(--muted)]">
              <Bookmark size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No saved jobs</p>
              <p className="text-sm mt-1 text-[var(--subtle)]">Bookmark jobs on the Job Board to find them here.</p>
              <div className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[var(--surface-muted)] text-xs text-[var(--subtle)]">
                <Users size={11} /> Saved jobs are stored on this device only
              </div>
              <div className="mt-3">
                <Link to="/jobs" className="text-[var(--accent)] hover:underline text-sm">Browse open jobs</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4 px-1">
                <Users size={13} className="text-[var(--subtle)]" />
                <span className="text-xs text-[var(--subtle)]">Saved jobs are stored on this device only and are not synchronized across wallets or browsers.</span>
              </div>
              <div className="space-y-4">
                {savedJobs.map((job) => (
                  <JobCard key={Number(job.id)} job={job} isSaved={true} onToggleSave={() => toggleSave(Number(job.id))} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Referral card — shown in profile tab on desktop */}
      {tab === 'profile' && p?.exists && (
        <div className="hidden lg:block mt-6">
          <ReferralCard />
        </div>
      )}
    </div>
  )
}
