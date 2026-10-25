/**
 * Utility helpers for ArcTalent
 */

export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function formatUSDC(raw: bigint, decimals = 6): string {
  const n = Number(raw) / 10 ** decimals
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatUSDCFull(raw: bigint, decimals = 6): string {
  return `$${formatUSDC(raw, decimals)}`
}

/** Short format: omit cents when the amount is a whole number >= $1 */
export function formatUSDCShort(raw: bigint, decimals = 6): string {
  const n = Number(raw) / 10 ** decimals
  if (n >= 1 && n === Math.floor(n)) {
    return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)}`
  }
  return `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`
}

export function parseUSDC(value: string): bigint {
  const n = parseFloat(value.replace(/[^0-9.]/g, ''))
  if (isNaN(n)) return 0n
  return BigInt(Math.round(n * 1_000_000))
}

export function formatDeadline(ts: bigint): string {
  const date = new Date(Number(ts) * 1000)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function deadlineStatus(ts: bigint): 'future' | 'soon' | 'past' {
  const now = Math.floor(Date.now() / 1000)
  const deadline = Number(ts)
  const diff = deadline - now
  if (diff < 0) return 'past'
  if (diff < 86400 * 3) return 'soon'
  return 'future'
}

export function reputationTier(score: bigint): { label: string; color: string } {
  const s = Number(score)
  if (s === 0) return { label: 'New', color: 'text-[var(--subtle)]' }
  if (s < 50) return { label: 'Rising', color: 'text-blue-500 dark:text-blue-400' }
  if (s < 200) return { label: 'Proven', color: 'text-indigo-500 dark:text-indigo-400' }
  if (s < 1000) return { label: 'Expert', color: 'text-purple-500 dark:text-purple-400' }
  return { label: 'Elite', color: 'text-amber-500 dark:text-amber-400' }
}

export function parseOnchainError(error: unknown): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || (error as { code?: number })?.code === 4001) {
    return 'Transaction cancelled.'
  }
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) {
    return 'Insufficient USDC balance. Get test USDC from the sidebar.'
  }
  if (msg.includes('reverted')) {
    const reasonMatch = msg.match(/reason="([^"]+)"/)
    return reasonMatch ? `Transaction failed: ${reasonMatch[1]}` : 'Transaction reverted. Check your inputs and try again.'
  }
  if (msg.includes('network') || msg.includes('timeout')) {
    return 'Network error. Check your connection and retry.'
  }
  return 'Something went wrong. Please try again.'
}

export function buildArcScanTx(txHash: string): string {
  return `https://explorer.testnet.arc.io/tx/${txHash}`
}

export function buildArcScanAddr(address: string): string {
  return `https://explorer.testnet.arc.io/address/${address}`
}
