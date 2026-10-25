import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { ExternalLink, CheckCircle, Clock, AlertCircle, ChevronRight } from 'lucide-react'
import { JOB_ESCROW_ABI, JobStatus, type OnchainJob } from '@/lib/contracts'
import { CONTRACTS, USDC_ADDRESS, ARC_TESTNET_ID } from '@/config'
import { formatUSDCFull, buildArcScanTx, formatAddress } from '@/lib/utils'
import { EscrowAmountRow } from '@/components/ui/USDCAmount'
import { toast } from 'sonner'

// Module-level current time (seconds) — computed once per page load, not per render
const NOW_SEC = Math.floor(Date.now() / 1000)

interface EscrowFlowProps {
  job: OnchainJob
  onUpdate: () => void
}

type Step = 'approve' | 'fund' | 'submit' | 'confirm' | 'done' | 'expired' | 'refunded' | 'cancelled'

function stepFromJob(job: OnchainJob, isClient: boolean, isTalent: boolean): Step {
  if (job.status === JobStatus.Cancelled) return 'cancelled'
  if (job.status === JobStatus.Refunded) return 'refunded'
  if (job.status === JobStatus.Expired) return 'expired'
  if (job.status === JobStatus.Completed) return 'done'
  if (job.status === JobStatus.Open && isClient && job.talent !== '0x0000000000000000000000000000000000000000') return 'fund'
  if (job.status === JobStatus.Funded && isTalent) return 'submit'
  if (job.status === JobStatus.Submitted && isClient) return 'confirm'
  return 'done'
}

export function EscrowFlow({ job, onUpdate }: EscrowFlowProps) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const isClient = address?.toLowerCase() === job.client.toLowerCase()
  const isTalent = address?.toLowerCase() === job.talent.toLowerCase()
  const isWrongChain = chainId !== ARC_TESTNET_ID

  const step = stepFromJob(job, isClient, isTalent)

  const [deliverable, setDeliverable] = useState('')
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)

  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.jobEscrow] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })

  const needsApproval = (allowance ?? 0n) < job.budget

  // Approve USDC
  const { writeContract: approve, data: approveTx } = useWriteContract()
  const { isLoading: approving, isSuccess: approved } = useWaitForTransactionReceipt({ hash: approveTx })

  // Fund job
  const { writeContract: fund, data: fundTx, isPending: fundPending } = useWriteContract()
  const { isLoading: funding, isSuccess: funded } = useWaitForTransactionReceipt({ hash: fundTx })

  // Submit deliverable
  const { writeContract: submit, data: submitTx, isPending: submitPending } = useWriteContract()
  const { isLoading: submitting, isSuccess: submitted } = useWaitForTransactionReceipt({ hash: submitTx })

  // Confirm completion
  const { writeContract: confirm, data: confirmTx, isPending: confirmPending } = useWriteContract()
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: confirmTx })

  // Cancel
  const { writeContract: cancel, data: cancelTx, isPending: cancelPending } = useWriteContract()
  const { isLoading: cancelling } = useWaitForTransactionReceipt({ hash: cancelTx })

  // Claim expiry
  const { writeContract: claimExpiry, data: expiryTx, isPending: expiryPending } = useWriteContract()
  const { isLoading: expiring } = useWaitForTransactionReceipt({ hash: expiryTx })

  const switchIfNeeded = () => {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return true }
    return false
  }

  const handleApprove = () => {
    if (switchIfNeeded()) return
    approve({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [CONTRACTS.jobEscrow, job.budget] })
  }

  const handleFund = () => {
    if (switchIfNeeded()) return
    fund({ address: CONTRACTS.jobEscrow, abi: JOB_ESCROW_ABI, functionName: 'fundJob', args: [job.id] })
  }

  const handleSubmit = () => {
    if (!deliverable.trim()) { toast.error('Please enter a deliverable link or hash'); return }
    if (switchIfNeeded()) return
    submit({ address: CONTRACTS.jobEscrow, abi: JOB_ESCROW_ABI, functionName: 'submitDeliverable', args: [job.id, deliverable.trim()] })
  }

  const handleConfirm = () => {
    if (switchIfNeeded()) return
    confirm({ address: CONTRACTS.jobEscrow, abi: JOB_ESCROW_ABI, functionName: 'confirmCompletion', args: [job.id, rating] })
  }

  const handleCancel = () => {
    if (switchIfNeeded()) return
    cancel({ address: CONTRACTS.jobEscrow, abi: JOB_ESCROW_ABI, functionName: 'cancelJob', args: [job.id] })
  }

  const handleClaimExpiry = () => {
    if (switchIfNeeded()) return
    claimExpiry({ address: CONTRACTS.jobEscrow, abi: JOB_ESCROW_ABI, functionName: 'claimExpiry', args: [job.id] })
  }

  // Success side effects
  if (funded || submitted || confirmed || approved) { onUpdate() }

  const stageSteps = [
    { label: 'Open', done: job.status >= JobStatus.Funded },
    { label: 'Funded', done: job.status >= JobStatus.Submitted },
    { label: 'Submitted', done: job.status >= JobStatus.Completed },
    { label: 'Completed', done: job.status === JobStatus.Completed },
  ]

  if (job.status === JobStatus.Cancelled || job.status === JobStatus.Refunded || job.status === JobStatus.Expired) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-5">
        <div className="flex items-center gap-2 text-[var(--muted)]">
          <AlertCircle size={18} />
          <span className="font-medium">
            {job.status === JobStatus.Cancelled ? 'Job cancelled' : job.status === JobStatus.Refunded ? 'Job refunded' : 'Job expired — funds returned to client'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] overflow-hidden">
      {/* Progress stepper */}
      <div className="px-5 pt-5 pb-4 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">Escrow Status</h3>
        <div className="flex items-center gap-1">
          {stageSteps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1 flex-1 min-w-0">
              <div className={`flex items-center gap-1 min-w-0 ${i === 0 ? '' : ''}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold
                  ${s.done ? 'bg-[var(--success)] text-white' : 'bg-[var(--surface-muted)] text-[var(--muted)]'}`}>
                  {s.done ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium truncate ${s.done ? 'text-[var(--success)]' : 'text-[var(--muted)]'}`}>
                  {s.label}
                </span>
              </div>
              {i < stageSteps.length - 1 && (
                <ChevronRight size={12} className="text-[var(--border-strong)] shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Budget summary */}
        <div className="rounded-xl bg-[var(--surface-muted)] p-4 space-y-2.5">
          <EscrowAmountRow label="Total budget" raw={job.budget} />
          <EscrowAmountRow label="Talent receives (96%)" raw={(job.budget * 96n) / 100n} variant="success" />
          <EscrowAmountRow label="Platform fee (4%)" raw={(job.budget * 4n) / 100n} variant="muted" />
          {isTalent && job.talent !== '0x0000000000000000000000000000000000000000' && (
            <div className="flex items-center justify-between pt-1.5 border-t border-[var(--border)]">
              <span className="text-xs text-[var(--subtle)]">Your role</span>
              <span className="text-xs font-medium text-[var(--muted)]">Selected Talent</span>
            </div>
          )}
        </div>

        {/* Action: Fund */}
        {step === 'fund' && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--ink-2)]">
              You&apos;ve selected <span className="font-semibold mono">{formatAddress(job.talent)}</span> as talent.
              Approve and fund the escrow to start the job.
            </p>
            {needsApproval && !approved && (
              <button
                onClick={handleApprove}
                disabled={approving || approveTx != null}
                className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
              >
                {approving ? 'Approving USDC…' : approveTx ? 'Confirmed' : 'Step 1: Approve USDC'}
              </button>
            )}
            <button
              onClick={handleFund}
              disabled={fundPending || funding || (needsApproval && !approved)}
              className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
            >
              {fundPending ? 'Confirm in wallet…' : funding ? 'Funding escrow…' : funded ? 'Funded!' : 'Step 2: Fund Escrow'}
            </button>
            {fundTx && (
              <a href={buildArcScanTx(fundTx)} target="_blank" rel="noopener" className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--accent)]">
                <ExternalLink size={12} /> View on ArcScan
              </a>
            )}
          </div>
        )}

        {/* Action: Submit deliverable */}
        {step === 'submit' && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--ink-2)]">Job is funded. Submit your deliverable link or IPFS hash to notify the client.</p>
            <input
              value={deliverable}
              onChange={(e) => setDeliverable(e.target.value)}
              placeholder="https://github.com/... or ipfs://Qm..."
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-input)] text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            />
            <button
              onClick={handleSubmit}
              disabled={submitPending || submitting || !deliverable.trim()}
              className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
            >
              {submitPending ? 'Confirm in wallet…' : submitting ? 'Submitting…' : submitted ? 'Submitted!' : 'Submit Deliverable'}
            </button>
            {submitTx && (
              <a href={buildArcScanTx(submitTx)} target="_blank" rel="noopener" className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--accent)]">
                <ExternalLink size={12} /> View on ArcScan
              </a>
            )}
          </div>
        )}

        {/* Action: Confirm completion */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[var(--ink-2)] mb-1">Deliverable submitted:</p>
              <a
                href={job.deliverableHash.startsWith('http') ? job.deliverableHash : '#'}
                target="_blank" rel="noopener"
                className="flex items-center gap-1 text-sm text-[var(--accent)] hover:underline break-all font-mono"
              >
                <ExternalLink size={12} className="shrink-0" />
                {job.deliverableHash}
              </a>
            </div>
            <div>
              <p className="text-sm text-[var(--ink-2)] mb-2">Rate this talent:</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                    className={`text-2xl transition-transform hover:scale-110 ${
                      s <= (hoverRating || rating) ? 'text-yellow-400' : 'text-[var(--border-strong)]'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleConfirm}
              disabled={confirmPending || confirming}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {confirmPending ? 'Confirm in wallet…' : confirming ? 'Releasing funds…' : confirmed ? 'Completed!' : `Confirm & Release ${formatUSDCFull((job.budget * 96n) / 100n)} USDC`}
            </button>
            {confirmTx && (
              <a href={buildArcScanTx(confirmTx)} target="_blank" rel="noopener" className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--accent)]">
                <ExternalLink size={12} /> View on ArcScan
              </a>
            )}
          </div>
        )}

        {/* Done */}
        {job.status === JobStatus.Completed && (
          <div className="rounded-xl bg-[var(--success)]/8 border border-[var(--success)]/20 p-3 flex items-center gap-2.5">
            <CheckCircle size={18} className="text-[var(--success)] shrink-0" />
            <span className="font-medium text-sm text-[var(--success)]">
              Job completed!{' '}
              {isTalent
                ? `You received ${formatUSDCFull((job.budget * 96n) / 100n)} USDC`
                : `Paid ${formatUSDCFull((job.budget * 96n) / 100n)} USDC to talent`}
              {job.rating > 0 && ` · ${'★'.repeat(job.rating)} rating`}
            </span>
          </div>
        )}

        {/* Waiting states */}
        {job.status === JobStatus.Funded && !isTalent && (
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm">
            <Clock size={16} />
            Waiting for talent to submit deliverable
          </div>
        )}
        {job.status === JobStatus.Submitted && !isClient && (
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm">
            <Clock size={16} />
            Deliverable submitted — waiting for client confirmation
          </div>
        )}

        {/* Cancel (client, before submission) */}
        {isClient && (job.status === JobStatus.Open || job.status === JobStatus.Funded) && (
          <button
            onClick={handleCancel}
            disabled={cancelPending || cancelling}
            className="w-full py-2 rounded-xl border border-[var(--danger)]/30 text-[var(--danger)] text-sm font-medium hover:bg-[var(--danger)]/10 disabled:opacity-60 transition-colors"
          >
            {cancelPending ? 'Confirm in wallet…' : cancelling ? 'Cancelling…' : 'Cancel Job'}
          </button>
        )}

        {/* Claim expiry (anyone, after deadline, status=Funded) */}
        {job.status === JobStatus.Funded && NOW_SEC > Number(job.deadline) && (
          <button
            onClick={handleClaimExpiry}
            disabled={expiryPending || expiring}
            className="w-full py-2 rounded-xl border border-orange-400/30 text-orange-500 dark:text-orange-400 text-sm font-medium hover:bg-orange-400/10 disabled:opacity-60 transition-colors"
          >
            {expiryPending ? 'Confirm in wallet…' : expiring ? 'Refunding…' : 'Claim Expired — Refund to Client'}
          </button>
        )}
      </div>
    </div>
  )
}
