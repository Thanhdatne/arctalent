import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Copy, Check, Gift } from 'lucide-react'
import { REFERRAL_MANAGER_ABI } from '@/lib/contracts'
import { CONTRACTS, ARC_TESTNET_ID } from '@/config'
import { buildShareLink } from '@/lib/share'
import { toast } from 'sonner'

export function ReferralCard() {
  const { address } = useAccount()
  const [copied, setCopied] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)

  const { data: myCode } = useReadContract({
    address: CONTRACTS.referralManager,
    abi: REFERRAL_MANAGER_ABI,
    functionName: 'myCode',
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })

  useEffect(() => {
    if (!myCode) return
    const codeHex = (myCode as string).toString()
    void buildShareLink(`/talent?ref=${codeHex}`).then(setShareLink)
  }, [myCode])

  const { writeContract: activate, data: activateTx, isPending: activating } = useWriteContract()
  const { isLoading: activatingTx } = useWaitForTransactionReceipt({ hash: activateTx })

  const handleActivate = () => {
    activate({
      address: CONTRACTS.referralManager,
      abi: REFERRAL_MANAGER_ABI,
      functionName: 'activateReferralCode',
    })
  }

  const handleCopy = async () => {
    if (!shareLink) return
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      toast.success('Referral link copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Gift size={18} className="text-indigo-500" />
        <h3 className="font-semibold text-[var(--ink)]">Referral Program</h3>
      </div>

      <p className="text-sm text-[var(--muted)] mb-4">
        Earn 1% of the job budget when someone you refer completes their first job.
        Activate your code once, then share your link.
      </p>

      {!myCode ? (
        <p className="text-sm text-[var(--subtle)]">Connect your wallet to generate a referral code.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-xs text-[var(--subtle)] mb-1">Your referral code</div>
            <code className="mono text-sm text-[var(--ink-2)] bg-[var(--surface-muted)] px-3 py-1.5 rounded-lg block">
              {(myCode as string).toString()}
            </code>
          </div>

          {shareLink ? (
            <div>
              <div className="text-xs text-[var(--subtle)] mb-1">Your referral link</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 text-xs text-[var(--muted)] bg-[var(--surface-muted)] px-3 py-1.5 rounded-lg truncate mono">
                  {shareLink}
                </div>
                <button
                  onClick={() => void handleCopy()}
                  className="p-2 rounded-lg bg-[var(--surface-muted)] hover:bg-[var(--border)] text-[var(--muted)] transition-colors"
                >
                  {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleActivate}
              disabled={activating || activatingTx}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
            >
              {activating ? 'Confirm in wallet…' : activatingTx ? 'Activating…' : 'Activate Referral Code'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
