import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { Plus, X, ExternalLink, CheckCircle } from 'lucide-react'
import { ConnectKitButton } from 'connectkit'
import { JOB_ESCROW_ABI, JobType } from '@/lib/contracts'
import { CONTRACTS, ARC_TESTNET_ID } from '@/config'
import { parseUSDC, parseOnchainError, buildArcScanTx } from '@/lib/utils'
import { toast } from 'sonner'

const JOB_TYPES = [
  { value: JobType.Fixed, label: 'Fixed Price', desc: 'Agreed price for a defined scope' },
  { value: JobType.Bounty, label: 'Bounty', desc: 'Open reward for completing a task' },
  { value: JobType.ReferralEligible, label: 'Referral Eligible', desc: 'Pay bonus when talent was referred' },
]

const SKILL_SUGGESTIONS = ['Solidity', 'React', 'TypeScript', 'Audit', 'DeFi', 'NFT', 'Security', 'Design', 'Content', 'Community', 'Research', 'Python', 'Rust', 'Go', 'ZK Proofs']

export function PostJob() {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const navigate = useNavigate()
  const isWrongChain = chainId !== ARC_TESTNET_ID

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [budget, setBudget] = useState('')
  const [daysUntilDeadline, setDaysUntilDeadline] = useState(14)
  const [jobType, setJobType] = useState<JobType>(JobType.Fixed)
  const [referralEligible, setReferralEligible] = useState(false)

  const { writeContract, data: txHash, isPending, error } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const addSkill = (s: string) => {
    const trimmed = s.trim()
    if (trimmed && !skills.includes(trimmed) && skills.length < 20) {
      setSkills([...skills, trimmed])
      setSkillInput('')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!address) return
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }

    const budgetBigInt = parseUSDC(budget)
    if (budgetBigInt === 0n) { toast.error('Budget must be greater than 0'); return }
    if (!title.trim()) { toast.error('Title is required'); return }
    if (!description.trim()) { toast.error('Description is required'); return }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + daysUntilDeadline * 86400)

    try {
      writeContract({
        address: CONTRACTS.jobEscrow,
        abi: JOB_ESCROW_ABI,
        functionName: 'postJob',
        args: [title.trim(), description.trim(), skills, budgetBigInt, deadline, jobType, referralEligible],
      })
    } catch (err) {
      toast.error(parseOnchainError(err))
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold display mb-3">Post a Job</h2>
        <p className="text-[var(--muted)] mb-6">Connect your wallet to post a job and attract top Web3 talent.</p>
        <ConnectKitButton />
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 mb-5">
          <CheckCircle size={32} className="text-green-600 dark:text-green-400" strokeWidth={1.75} />
        </div>
        <h2 className="text-2xl font-bold display mb-2">Job Posted!</h2>
        <p className="text-[var(--muted)] mb-6">Your job is now live on the Job Board. Talents can apply right away.</p>
        {txHash && (
          <a href={buildArcScanTx(txHash)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--accent)] mb-6">
            <ExternalLink size={14} /> View transaction on ArcScan
          </a>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={() => { void navigate('/jobs') }} className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-[var(--ink)] text-sm font-medium hover:bg-[var(--surface-muted)]">
            See Job Board
          </button>
          <button onClick={() => { void navigate('/dashboard') }} className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)]">
            My Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="heading-lg text-[var(--ink)]">Post a Job</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Describe what you need. Budget is locked in USDC escrow until you confirm delivery.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Section: Job Details ── */}
        <p className="section-label border-b border-[var(--border)] pb-2">Job Details</p>
        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-[var(--ink-2)] mb-1.5">Job Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Smart Contract Audit for DeFi Protocol"
            maxLength={100}
            required
            className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-[var(--ink-2)] mb-1.5">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the scope, deliverables, and requirements…"
            rows={5}
            required
            className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)] resize-none"
          />
        </div>

        {/* ── Section: Requirements ── */}
        <p className="section-label border-b border-[var(--border)] pb-2 !mt-8">Requirements</p>
        {/* Skills */}
        <div>
          <label className="block text-sm font-semibold text-[var(--ink-2)] mb-1.5">Required Skills</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {skills.map((s) => (
              <span key={s} className="flex items-center gap-1 pl-3 pr-2 py-1 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20 text-sm font-medium">
                {s}
                <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))} className="hover:opacity-70">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) } }}
              placeholder="Type a skill and press Enter"
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            />
            <button type="button" onClick={() => addSkill(skillInput)} className="px-3 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-muted)]">
              <Plus size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).map((s) => (
              <button key={s} type="button" onClick={() => addSkill(s)} className="px-2 py-0.5 text-xs rounded-md bg-[var(--surface-muted)] text-[var(--muted)] hover:bg-[var(--border)] transition-colors">
                + {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── Section: Compensation ── */}
        <p className="section-label border-b border-[var(--border)] pb-2 !mt-8">Compensation</p>
        {/* Budget */}
        <div>
          <label className="block text-sm font-semibold text-[var(--ink-2)] mb-1.5">Budget (USDC) *</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] font-semibold">$</span>
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0.00"
              type="number"
              min="1"
              step="0.01"
              required
              className="w-full pl-8 pr-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            />
          </div>
          {budget && (() => {
            const raw = parseUSDC(budget)
            const talent = (raw * 96n) / 100n
            const fee = raw - talent
            const fmt = (v: bigint) => `$${(Number(v) / 1_000_000).toFixed(2)}`
            return (
              <p className="text-xs text-[var(--muted)] mt-1.5">
                Talent receives {fmt(talent)} (96%) · Platform fee {fmt(fee)} (4%)
              </p>
            )
          })()}
        </div>

        {/* Deadline */}
        <div>
          <label className="block text-sm font-semibold text-[var(--ink-2)] mb-1.5">
            Deadline — {daysUntilDeadline} days from now
          </label>
          <input
            type="range"
            min={3}
            max={90}
            value={daysUntilDeadline}
            onChange={(e) => setDaysUntilDeadline(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <div className="flex justify-between text-xs text-[var(--subtle)] mt-1">
            <span>3 days</span>
            <span>90 days</span>
          </div>
        </div>

        {/* Job type */}
        <div>
          <label className="block text-sm font-semibold text-[var(--ink-2)] mb-2">Job Type</label>
          <div className="grid grid-cols-3 gap-2">
            {JOB_TYPES.map((jt) => (
              <button
                key={jt.value}
                type="button"
                onClick={() => setJobType(jt.value)}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  jobType === jt.value ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className={`text-sm font-semibold ${jobType === jt.value ? 'text-[var(--accent)]' : 'text-[var(--ink-2)]'}`}>{jt.label}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{jt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Referral */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={referralEligible}
            onChange={(e) => setReferralEligible(e.target.checked)}
            className="w-4 h-4 rounded accent-[var(--accent)]"
          />
          <div>
            <div className="text-sm font-medium text-[var(--ink-2)]">Referral eligible</div>
            <div className="text-xs text-[var(--muted)]">1% of budget paid to talent&apos;s referrer on completion</div>
          </div>
        </label>

        {/* Error */}
        {error && <p className="text-sm text-[var(--danger)] rounded-xl bg-[var(--danger)]/10 px-4 py-2.5">{parseOnchainError(error)}</p>}
        {isWrongChain && <p className="text-sm text-orange-500 rounded-xl bg-orange-500/10 px-4 py-2.5">Please switch to Arc Testnet to post a job.</p>}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending || confirming}
          className="w-full py-3.5 rounded-xl bg-[var(--accent)] text-white font-bold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
        >
          {isPending ? 'Confirm in wallet…' : confirming ? 'Posting job…' : 'Post Job on Arc Testnet'}
        </button>
        <p className="text-xs text-center text-[var(--subtle)]">
          Funds are NOT locked yet. Budget is pulled from your wallet when you select and fund a talent.
        </p>
      </form>
    </div>
  )
}
