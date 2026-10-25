/**
 * Reusable USDC amount display components.
 * Uses the official USDC visual mark alongside formatted amounts.
 * All formatting delegates to utils — no financial logic here.
 */
import { USDCLogo } from './USDCLogo'
import { formatUSDCShort, formatUSDCFull } from '@/lib/utils'

interface USDCAmountProps {
  /** Raw on-chain amount in 6-decimal USDC units */
  raw: bigint
  /** Display size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Show full precision (e.g. in escrow summary rows) */
  full?: boolean
  /** Color treatment */
  variant?: 'default' | 'success' | 'muted'
  className?: string
  /** Show the USDC logo icon */
  showLogo?: boolean
}

const SIZE_MAP = {
  sm: { text: 'text-sm font-semibold', logo: 14, gap: 'gap-1' },
  md: { text: 'text-base font-bold', logo: 16, gap: 'gap-1.5' },
  lg: { text: 'text-xl font-bold', logo: 20, gap: 'gap-2' },
  xl: { text: 'text-3xl font-bold', logo: 28, gap: 'gap-2.5' },
}

const VARIANT_MAP = {
  default: 'text-[var(--ink)]',
  success: 'text-[var(--success)]',
  muted: 'text-[var(--muted)]',
}

export function USDCAmount({
  raw,
  size = 'md',
  full = false,
  variant = 'default',
  className = '',
  showLogo = true,
}: USDCAmountProps) {
  const { text, logo, gap } = SIZE_MAP[size]
  const color = VARIANT_MAP[variant]
  const formatted = full ? formatUSDCFull(raw) : formatUSDCShort(raw)

  return (
    <span className={`inline-flex items-center ${gap} ${className}`}>
      {showLogo && <USDCLogo size={logo} className="shrink-0" />}
      <span className={`tabular-nums ${text} ${color}`}>{formatted}</span>
    </span>
  )
}

/**
 * Compact USDC badge — for card footers, job budget lines, and list rows.
 * Shows a small colored pill with the USDC logo and amount.
 */
interface USDCBadgeProps {
  raw: bigint
  variant?: 'blue' | 'green' | 'neutral'
  size?: 'sm' | 'md'
}

export function USDCBadge({ raw, variant = 'blue', size = 'md' }: USDCBadgeProps) {
  const bgColor = {
    blue: 'bg-[#2775CA]/10 border-[#2775CA]/20 text-[#2775CA]',
    green: 'bg-[var(--success)]/10 border-[var(--success)]/20 text-[var(--success)]',
    neutral: 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--ink-2)]',
  }[variant]

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs gap-1'
    : 'px-2.5 py-1 text-sm gap-1.5'

  const logoSize = size === 'sm' ? 12 : 14

  return (
    <span className={`inline-flex items-center rounded-full border font-semibold tabular-nums ${bgColor} ${sizeClasses}`}>
      <USDCLogo size={logoSize} className="shrink-0" />
      {formatUSDCShort(raw)}
    </span>
  )
}

/**
 * Escrow summary row — used in EscrowFlow and JobDetail sidebar.
 * Shows a labeled amount with semantic coloring.
 */
interface EscrowRowProps {
  label: string
  raw: bigint
  variant?: 'default' | 'success' | 'muted'
  showLogo?: boolean
}

export function EscrowAmountRow({ label, raw, variant = 'default', showLogo = true }: EscrowRowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-[var(--subtle)]">{label}</span>
      <USDCAmount raw={raw} size="sm" variant={variant} full showLogo={showLogo} />
    </div>
  )
}
