import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { ArrowRight, Shield, Zap, Users, CheckCircle, Star, ClipboardList, UserPlus, Link2 } from 'lucide-react'
import { ConnectKitButton } from 'connectkit'
import { TalentCard } from '@/components/talent/TalentCard'
import { JobCard } from '@/components/jobs/JobCard'
import { TalentCardSkeleton } from '@/components/talent/TalentCardSkeleton'
import { JobCardSkeleton } from '@/components/jobs/JobCardSkeleton'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { HeroIllustration, EscrowIcon } from '@/components/ui/HeroIllustration'
import { USDCLogo, USDCLogoPrecise } from '@/components/ui/USDCLogo'
import { useRegisteredTalents } from '@/hooks/useRegisteredTalents'
import { TALENT_REGISTRY_ABI, JOB_ESCROW_ABI, type OnchainProfile, type OnchainReputation, type OnchainJob, JobStatus } from '@/lib/contracts'
import { CONTRACTS, ARC_TESTNET_ID } from '@/config'

const MAX_PREVIEW = 3
const MAX_PREVIEW_JOBS = 6

// Neutral role badge — shared across Client and Talent steps
const ROLE_BADGE = 'bg-[var(--surface-muted)] text-[var(--ink-2)] border border-[var(--border)]'

// ── Platform features
const FEATURES: { icon: React.ElementType; title: string; desc: string; useUSDC?: boolean }[] = [
  {
    icon: Shield,
    title: 'USDC Escrow',
    desc: 'Every job is secured in a smart contract. Funds release only when you confirm delivery.',
  },
  {
    icon: Star,
    title: 'Onchain Reputation',
    desc: 'Earn a verifiable score from completed jobs, ratings, and USDC earned — all public on Arc.',
  },
  {
    icon: Zap,
    title: 'Sub-second Settlement',
    desc: "USDC is Arc's native gas. Payments confirm in milliseconds with no token juggling.",
  },
  {
    // USDCLogo used directly via useUSDC flag — no inline component in data array
    icon: Shield,
    title: 'Transparent Fees',
    desc: 'Talent always receives 96% of the agreed budget. 4% platform fee, no hidden charges.',
    useUSDC: true,
  },
  {
    icon: Users,
    title: 'Referral Rewards',
    desc: 'Earn 1% when talent you referred completes their first job — credited automatically.',
  },
]

// ── How it works steps — Lucide icons only, no emoji
const STEPS = [
  {
    role: 'Client',
    label: 'Post a Job',
    desc: 'Set title, description, required skills, budget, and deadline.',
    LucideIcon: ClipboardList,
    color: 'from-[var(--accent)]/8 to-[var(--accent)]/3',
    border: 'border-[var(--accent)]/15',
  },
  {
    role: 'Talent',
    label: 'Apply',
    desc: 'Talent applies onchain. Client reviews applicants and selects one.',
    LucideIcon: UserPlus,
    color: 'from-[var(--surface-muted)] to-[var(--surface-muted)]',
    border: 'border-[var(--border)]',
  },
  {
    role: 'Client',
    label: 'Fund Escrow',
    desc: 'Client approves USDC into the smart contract. Work begins.',
    LucideIcon: null, // rendered as USDCLogo
    color: 'from-[#2775CA]/10 to-[#2775CA]/4',
    border: 'border-[#2775CA]/20',
  },
  {
    role: 'Talent',
    label: 'Submit Work',
    desc: 'Talent submits a link or hash as verifiable proof of delivery.',
    LucideIcon: Link2,
    color: 'from-[var(--surface-muted)] to-[var(--surface-muted)]',
    border: 'border-[var(--border)]',
  },
  {
    role: 'Client',
    label: 'Confirm & Pay',
    desc: 'Client reviews, rates 1–5 stars, and releases 96% of funds.',
    LucideIcon: null, // rendered as CheckCircle
    color: 'from-green-500/10 to-green-600/3',
    border: 'border-green-500/20',
  },
]

export function Landing() {
  const { isConnected } = useAccount()

  // ── Featured talent (up to 3)
  const { talents, loading: talentsLoading } = useRegisteredTalents()
  const previewTalents = talents.slice(0, MAX_PREVIEW)

  const profileContracts = useMemo(() =>
    previewTalents.map((addr) => ({
      address: CONTRACTS.talentRegistry,
      abi: TALENT_REGISTRY_ABI,
      functionName: 'getProfile' as const,
      args: [addr] as [`0x${string}`],
      chainId: ARC_TESTNET_ID,
    })), [previewTalents])

  const repContracts = useMemo(() =>
    previewTalents.map((addr) => ({
      address: CONTRACTS.talentRegistry,
      abi: TALENT_REGISTRY_ABI,
      functionName: 'getReputation' as const,
      args: [addr] as [`0x${string}`],
      chainId: ARC_TESTNET_ID,
    })), [previewTalents])

  const scoreContracts = useMemo(() =>
    previewTalents.map((addr) => ({
      address: CONTRACTS.talentRegistry,
      abi: TALENT_REGISTRY_ABI,
      functionName: 'reputationScore' as const,
      args: [addr] as [`0x${string}`],
      chainId: ARC_TESTNET_ID,
    })), [previewTalents])

  const { data: profileResults, isLoading: loadingProfiles } = useReadContracts({ contracts: profileContracts, query: { enabled: previewTalents.length > 0 } })
  const { data: repResults } = useReadContracts({ contracts: repContracts, query: { enabled: previewTalents.length > 0 } })
  const { data: scoreResults } = useReadContracts({ contracts: scoreContracts, query: { enabled: previewTalents.length > 0 } })

  const talentData = useMemo(() =>
    previewTalents.map((addr, i) => ({
      address: addr,
      profile: profileResults?.[i]?.result as OnchainProfile | undefined,
      reputation: repResults?.[i]?.result as OnchainReputation | undefined,
      score: (scoreResults?.[i]?.result as bigint | undefined) ?? 0n,
    })).filter((t) => t.profile?.exists),
    [previewTalents, profileResults, repResults, scoreResults])

  // ── Featured jobs (up to 3 open jobs)
  const { data: jobCount } = useReadContract({
    address: CONTRACTS.jobEscrow,
    abi: JOB_ESCROW_ABI,
    functionName: 'getJobCount',
    chainId: ARC_TESTNET_ID,
  })

  const count = Number(jobCount ?? 0n)
  const fetchCount = Math.min(count, MAX_PREVIEW_JOBS)

  const jobContracts = useMemo(() =>
    Array.from({ length: MAX_PREVIEW_JOBS }, (_, i) => ({
      address: CONTRACTS.jobEscrow,
      abi: JOB_ESCROW_ABI,
      functionName: 'getJob' as const,
      args: [BigInt(count - 1 - i)] as [bigint],
      chainId: ARC_TESTNET_ID,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count])

  const { data: jobResults, isLoading: loadingJobs } = useReadContracts({
    contracts: jobContracts,
    query: { enabled: count > 0 },
  })

  const openJobs = useMemo((): OnchainJob[] => {
    if (!jobResults) return []
    return jobResults
      .slice(0, fetchCount)
      .map((r) => r.result as OnchainJob | undefined)
      .filter((j): j is OnchainJob => j !== undefined && j.status === JobStatus.Open)
      .slice(0, MAX_PREVIEW)
  }, [jobResults, fetchCount])

  return (
    <div className="flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Layered background */}
        <div className="absolute inset-0 bg-[var(--surface-muted)]" />
        {/* Subtle dot grid texture */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--accent) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            opacity: 0.04,
          }}
        />
        {/* Accent glow top-right */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[var(--accent)] opacity-[0.04] blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left: headline + CTAs */}
            <div className="text-center lg:text-left">
              {/* Live status pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20 text-xs font-semibold mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse inline-block" />
                Live on Arc Testnet — USDC as native gas
              </div>

              <h1 className="heading-xl text-[var(--ink)] mb-5">
                The onchain talent<br />
                marketplace for<br />
                <span className="text-[var(--accent)]">Web3 builders.</span>
              </h1>

              <p className="body-lead max-w-lg mx-auto lg:mx-0 mb-8">
                ArcTalent connects clients and freelancers through transparent USDC escrow on Arc.
                Post jobs, get paid, and build an onchain reputation — no trust required.
              </p>

              {/* USDC trust signal */}
              <div className="flex items-center justify-center lg:justify-start gap-2 mb-8">
                <USDCLogoPrecise size={22} />
                <span className="text-sm text-[var(--muted)] font-medium">
                  All payments in USDC — secured by smart contract
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link
                  to="/talent"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
                >
                  Find Talent <ArrowRight size={16} />
                </Link>
                {isConnected ? (
                  <Link
                    to="/jobs"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-[var(--border-strong)] text-[var(--ink)] font-semibold text-sm hover:bg-[var(--surface-strong)] transition-colors"
                  >
                    Browse Jobs
                  </Link>
                ) : (
                  <ConnectKitButton />
                )}
              </div>

              {/* Credibility chips */}
              <div className="flex flex-wrap gap-2 mt-6 justify-center lg:justify-start">
                {['Smart contract escrow', '96% payout to talent', 'Onchain reputation'].map((chip) => (
                  <span key={chip} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-xs text-[var(--muted)] font-medium">
                    <CheckCircle size={11} className="text-[var(--success)]" />
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: hero illustration */}
            <div className="relative lg:flex items-center justify-center hidden">
              {/* Illustration backdrop card */}
              <div className="relative w-full max-w-lg">
                {/* Outer glow ring */}
                <div className="absolute inset-4 rounded-3xl bg-[var(--accent)] opacity-[0.04] blur-2xl" />
                <div className="relative rounded-3xl border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-[0_8px_40px_rgba(15,31,46,0.08)]">
                  <HeroIllustration className="w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── For Clients / For Talent ─────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <SectionLabel className="text-center block mb-2">Built for both sides</SectionLabel>
          <h2 className="heading-lg text-[var(--ink)]">Built for both sides of the market</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {/* For clients */}
          <div className="card rounded-2xl p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[var(--accent)] opacity-[0.03] -translate-y-8 translate-x-8 group-hover:opacity-[0.06] transition-opacity" />
            <SectionLabel>For Clients</SectionLabel>
            <h3 className="heading-md text-[var(--ink)] mt-2 mb-4">Hire with confidence</h3>
            <ul className="space-y-3 mb-6">
              {[
                'Post a job with a fixed USDC budget',
                'Review applicants and select your talent',
                'Funds stay in escrow until you confirm delivery',
                'Rate work and build verifiable hiring history',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--muted)]">
                  <CheckCircle size={15} className="text-[var(--success)] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/post-job"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors"
            >
              Post a Job <ArrowRight size={14} />
            </Link>
          </div>

          {/* For talent */}
          <div className="card rounded-2xl p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[var(--success)] opacity-[0.03] -translate-y-8 translate-x-8 group-hover:opacity-[0.06] transition-opacity" />
            <SectionLabel>For Talent</SectionLabel>
            <h3 className="heading-md text-[var(--ink)] mt-2 mb-4">Earn and grow onchain</h3>
            <ul className="space-y-3 mb-6">
              {[
                'Create a public profile with your skills and rate',
                'Apply to jobs and get selected by clients',
                'Receive 96% of agreed budget directly in USDC',
                'Build a verifiable reputation from real completed work',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--muted)]">
                  <CheckCircle size={15} className="text-[var(--success)] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3">
              <Link
                to="/talent"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-[var(--border-strong)] text-[var(--ink)] text-sm font-semibold hover:bg-[var(--surface-muted)] transition-colors"
              >
                Explore Talent <ArrowRight size={14} />
              </Link>
              {/* USDC payout signal */}
              <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#2775CA]/8 border border-[#2775CA]/15">
                <USDCLogo size={14} />
                <span className="text-xs font-semibold text-[#2775CA]">USDC payout</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Talent ──────────────────────────────────────────── */}
      <section className="bg-[var(--surface-muted)] py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <SectionLabel>Talent</SectionLabel>
              <h2 className="heading-lg text-[var(--ink)] mt-1">Featured builders</h2>
            </div>
            <Link to="/talent" className="text-sm text-[var(--accent)] hover:underline font-medium flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {talents.length === 0 && !talentsLoading && !loadingProfiles ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] mb-4">
                <Users size={22} className="text-[var(--subtle)]" />
              </div>
              <p className="font-medium text-[var(--ink)] mb-1">No profiles registered yet</p>
              <p className="text-sm text-[var(--muted)]">
                <Link to="/dashboard" className="text-[var(--accent)] hover:underline">Be the first to register your profile.</Link>
              </p>
            </div>
          ) : talentsLoading || loadingProfiles || (previewTalents.length > 0 && talentData.length === 0) ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: MAX_PREVIEW }).map((_, i) => <TalentCardSkeleton key={i} />)}
            </div>
          ) : talentData.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {talentData.map((t) => (
                <TalentCard
                  key={t.address}
                  address={t.address}
                  profile={t.profile!}
                  reputation={t.reputation ?? { jobsCompleted: 0n, ratingSum: 0n, ratingCount: 0n, totalUSDCEarned: 0n }}
                  score={t.score}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Featured Jobs ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <SectionLabel>Opportunities</SectionLabel>
            <h2 className="heading-lg text-[var(--ink)] mt-1">Open jobs</h2>
          </div>
          <Link to="/jobs" className="text-sm text-[var(--accent)] hover:underline font-medium flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {count === 0 && !loadingJobs ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--surface-strong)] border border-[var(--border)] mb-4">
              <EscrowIcon size={28} className="text-[var(--subtle)]" />
            </div>
            <p className="font-medium text-[var(--ink)] mb-1">No jobs posted yet</p>
            <p className="text-sm text-[var(--muted)]">
              <Link to="/post-job" className="text-[var(--accent)] hover:underline">Post the first one.</Link>
            </p>
          </div>
        ) : loadingJobs ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: MAX_PREVIEW }).map((_, i) => <JobCardSkeleton key={i} />)}
          </div>
        ) : openJobs.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {openJobs.map((job) => <JobCard key={Number(job.id)} job={job} />)}
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--muted)]">
            <p className="text-sm">No open jobs right now. <Link to="/post-job" className="text-[var(--accent)] hover:underline">Post one.</Link></p>
          </div>
        )}
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section className="bg-[var(--surface-muted)] py-20 relative overflow-hidden">
        {/* Background accent */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute right-0 top-0 w-64 h-64 rounded-full bg-[var(--accent)] opacity-[0.03] blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative">
          <div className="text-center mb-14">
            <SectionLabel className="text-center block mb-2">Process</SectionLabel>
            <h2 className="heading-lg text-[var(--ink)]">How it works</h2>
            <p className="body-lead mt-3 max-w-md mx-auto text-[var(--muted)]">
              Five onchain steps from job post to USDC payout.
            </p>
          </div>

          {/* Steps — horizontal connector on desktop */}
          <div className="relative">
            {/* Desktop connector line */}
            <div className="hidden lg:block absolute top-[26px] left-[52px] right-[52px] h-px bg-gradient-to-r from-[var(--accent)]/30 via-[var(--accent)]/20 to-[var(--success)]/30" />

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 lg:gap-3">
              {STEPS.map(({ role, label, desc, color, border, LucideIcon }, i) => (
                <div key={i} className="relative flex flex-col items-center text-center sm:items-center">
                  {/* Step icon tile */}
                  <div className={`relative z-10 w-12 h-12 rounded-2xl bg-gradient-to-br ${color} border ${border} flex items-center justify-center mb-3 shrink-0`}>
                    {i === 2 ? (
                      // Fund Escrow — USDC logo
                      <USDCLogo size={22} />
                    ) : i === 4 ? (
                      // Confirm & Pay — check mark in success color
                      <CheckCircle size={20} className="text-[var(--success)]" strokeWidth={2} />
                    ) : LucideIcon ? (
                      <LucideIcon size={19} className="text-[var(--ink-2)]" strokeWidth={1.75} />
                    ) : null}
                    {/* Step number */}
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--ink)] text-[var(--bg)] text-[9px] font-bold flex items-center justify-center shadow-sm">
                      {i + 1}
                    </div>
                  </div>

                  {/* Role badge — neutral, not accent */}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium mb-2 ${ROLE_BADGE}`}>
                    {role}
                  </span>

                  {/* Label */}
                  <h3 className="text-sm font-semibold text-[var(--ink)] mb-1 leading-snug">{label}</h3>

                  {/* Description */}
                  <p className="text-xs text-[var(--muted)] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom trust strip */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <USDCLogo size={16} />
              <span>All payments in USDC</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-[var(--border)]" />
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Shield size={14} className="text-[var(--accent)]" />
              <span>Smart contract secured</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-[var(--border)]" />
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Zap size={14} className="text-amber-500" />
              <span>Sub-second on Arc</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Arc ───────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <SectionLabel className="text-center block mb-2">Platform</SectionLabel>
          <h2 className="heading-lg text-[var(--ink)]">Built for the onchain economy</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc, useUSDC }) => (
            <div key={title} className="card rounded-2xl p-6 group hover:border-[var(--accent)]/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center mb-4 transition-colors">
                {useUSDC ? (
                  <USDCLogo size={20} />
                ) : (
                  <Icon size={19} className="text-[var(--accent)]" />
                )}
              </div>
              <h3 className="heading-md text-[var(--ink)] mb-2">{title}</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20">
        {/* Rich background */}
        <div className="absolute inset-0 bg-[var(--surface-muted)]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 via-transparent to-[var(--success)]/3 pointer-events-none" />
        {/* Decorative circles */}
        <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-[var(--accent)]/10 pointer-events-none" />
        <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full border border-[var(--accent)]/08 pointer-events-none" />
        <div className="absolute -right-20 top-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-[var(--accent)]/10 pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-4 text-center">
          {/* USDC coin mark */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2775CA]/15 to-[#2775CA]/5 border border-[#2775CA]/20 flex items-center justify-center shadow-sm">
                <USDCLogoPrecise size={36} />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--success)] flex items-center justify-center shadow-sm">
                <CheckCircle size={11} className="text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <h2 className="heading-lg text-[var(--ink)] mb-4">Ready to start?</h2>
          <p className="text-[var(--muted)] mb-8 text-base leading-relaxed max-w-lg mx-auto">
            Connect your wallet, create a profile, and start building your onchain reputation — or post your first job today.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Link
              to="/talent"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
            >
              Find Talent <ArrowRight size={16} />
            </Link>
            <Link
              to="/jobs"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-[var(--border-strong)] text-[var(--ink)] font-semibold text-sm hover:bg-[var(--surface-strong)] transition-colors"
            >
              Browse Jobs
            </Link>
          </div>

          {/* Platform stats strip — no fabricated numbers, just feature callouts */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[
              { icon: <Shield size={13} />, text: 'Smart contract escrow' },
              { icon: <USDCLogo size={13} />, text: 'USDC payments' },
              { icon: <Zap size={13} className="text-amber-500" />, text: 'Arc network' },
            ].map(({ icon, text }) => (
              <span key={text} className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <span className="text-[var(--accent)]">{icon}</span>
                {text}
              </span>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
