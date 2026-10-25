/**
 * ArcTalent hero illustration — a composed SVG scene communicating:
 * Web3 talent, USDC escrow, onchain payments, Arc network.
 *
 * Pure SVG, no external images, no fabricated data.
 * Supports light/dark via CSS custom properties.
 */

interface HeroIllustrationProps {
  className?: string
}

export function HeroIllustration({ className = '' }: HeroIllustrationProps) {
  return (
    <svg
      viewBox="0 0 480 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        {/* Accent blue gradient */}
        <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2775CA" />
          <stop offset="100%" stopColor="#1a5fa8" />
        </linearGradient>

        {/* Card surface gradient light */}
        <linearGradient id="cardLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.97" />
          <stop offset="100%" stopColor="#f4f5f8" stopOpacity="0.95" />
        </linearGradient>

        {/* Card surface gradient dark */}
        <linearGradient id="cardDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c2128" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#161b22" stopOpacity="0.98" />
        </linearGradient>

        {/* USDC coin gradient */}
        <radialGradient id="usdcCoin" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#4a9de8" />
          <stop offset="100%" stopColor="#1a5fa8" />
        </radialGradient>

        {/* Green success glow */}
        <radialGradient id="successGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>

        {/* Soft ambient background */}
        <radialGradient id="ambientBg" cx="55%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#2775CA" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#2775CA" stopOpacity="0" />
        </radialGradient>

        {/* Drop shadow filter */}
        <filter id="cardShadow" x="-8%" y="-8%" width="116%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#0f1f2e" floodOpacity="0.08" />
        </filter>
        <filter id="coinShadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#1a5fa8" floodOpacity="0.30" />
        </filter>
        <filter id="glowFilter">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Clip paths */}
        <clipPath id="cardClip1">
          <rect x="40" y="70" width="196" height="120" rx="16" />
        </clipPath>
        <clipPath id="cardClip2">
          <rect x="256" y="130" width="196" height="120" rx="16" />
        </clipPath>
      </defs>

      {/* ── Ambient background glow ── */}
      <ellipse cx="260" cy="160" rx="200" ry="140" fill="url(#ambientBg)" />

      {/* ── Subtle grid dots ── */}
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 12 }, (_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={col * 44 + 10}
            cy={row * 44 + 10}
            r="1"
            fill="#2775CA"
            fillOpacity="0.08"
          />
        ))
      )}

      {/* ── Connection lines (chain links) ── */}
      {/* Line from talent card to escrow */}
      <path
        d="M 236 130 Q 248 130 248 160 Q 248 190 256 190"
        stroke="#2775CA"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeOpacity="0.4"
      />
      {/* Line from escrow to payout card */}
      <path
        d="M 452 190 Q 464 190 464 220 Q 464 248 452 260"
        stroke="#22c55e"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeOpacity="0.4"
      />
      {/* Arc network node dots */}
      <circle cx="248" cy="160" r="4" fill="#2775CA" fillOpacity="0.6" />
      <circle cx="464" cy="220" r="4" fill="#22c55e" fillOpacity="0.6" />

      {/* ── Card 1: Talent Profile ── */}
      <g filter="url(#cardShadow)">
        <rect x="40" y="70" width="196" height="120" rx="16" fill="url(#cardLight)" className="dark-card" />
        <rect x="40" y="70" width="196" height="120" rx="16" stroke="#0f1f2e" strokeOpacity="0.07" strokeWidth="1" />
      </g>
      {/* Avatar */}
      <circle cx="80" cy="110" r="22" fill="url(#accentGrad)" opacity="0.9" />
      {/* Initials */}
      <text x="80" y="116" textAnchor="middle" fill="white" fontSize="12" fontWeight="700" fontFamily="'Space Grotesk', sans-serif">AJ</text>
      {/* Name line */}
      <rect x="112" y="96" width="88" height="9" rx="4.5" fill="#0f1f2e" fillOpacity="0.12" />
      {/* Role line */}
      <rect x="112" y="112" width="64" height="7" rx="3.5" fill="#0f1f2e" fillOpacity="0.08" />
      {/* Skill chips */}
      <rect x="60" y="144" width="52" height="18" rx="9" fill="#eef4ff" />
      <text x="86" y="156.5" textAnchor="middle" fill="#122d45" fontSize="7.5" fontWeight="600" fontFamily="'DM Sans', sans-serif">Solidity</text>
      <rect x="120" y="144" width="46" height="18" rx="9" fill="#eef4ff" />
      <text x="143" y="156.5" textAnchor="middle" fill="#122d45" fontSize="7.5" fontWeight="600" fontFamily="'DM Sans', sans-serif">React</text>
      <rect x="174" y="144" width="44" height="18" rx="9" fill="#eef4ff" />
      <text x="196" y="156.5" textAnchor="middle" fill="#122d45" fontSize="7.5" fontWeight="600" fontFamily="'DM Sans', sans-serif">DeFi</text>
      {/* Rate */}
      <circle cx="68" cy="174" r="6" fill="#2775CA" />
      <text x="68" y="177.5" textAnchor="middle" fill="white" fontSize="7" fontWeight="700" fontFamily="'DM Sans', sans-serif">$</text>
      <rect x="80" y="170" width="48" height="7" rx="3.5" fill="#0f1f2e" fillOpacity="0.10" />

      {/* ── Card 2: Escrow / Job ── */}
      <g filter="url(#cardShadow)">
        <rect x="256" y="130" width="196" height="130" rx="16" fill="url(#cardLight)" />
        <rect x="256" y="130" width="196" height="130" rx="16" stroke="#0f1f2e" strokeOpacity="0.07" strokeWidth="1" />
      </g>
      {/* Escrow header */}
      <rect x="272" y="146" width="80" height="8" rx="4" fill="#0f1f2e" fillOpacity="0.13" />
      <rect x="360" y="144" width="52" height="12" rx="6" fill="#eef4ff" />
      <text x="386" y="153.5" textAnchor="middle" fill="#122d45" fontSize="7" fontWeight="700" fontFamily="'DM Sans', sans-serif">In Escrow</text>
      {/* Budget display with USDC */}
      <circle cx="292" cy="180" r="14" fill="url(#usdcCoin)" filter="url(#coinShadow)" />
      <circle cx="292" cy="180" r="10.5" stroke="white" strokeWidth="1" strokeOpacity="0.2" fill="none" />
      <text x="292" y="184.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="'DM Sans', sans-serif">$</text>
      <text x="316" y="176" fill="#0f1f2e" fillOpacity="0.75" fontSize="8" fontFamily="'DM Sans', sans-serif">Budget</text>
      <text x="316" y="188" fill="#0f1f2e" fillOpacity="0.9" fontSize="13" fontWeight="700" fontFamily="'Space Grotesk', sans-serif">2,500</text>
      <text x="358" y="188" fill="#2775CA" fontSize="8" fontWeight="600" fontFamily="'DM Sans', sans-serif">USDC</text>
      {/* Progress stepper */}
      <circle cx="280" cy="218" r="6" fill="#2775CA" />
      <text x="280" y="221.5" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700">✓</text>
      <rect x="290" y="217" width="28" height="1.5" rx="0.75" fill="#2775CA" fillOpacity="0.3" />
      <circle cx="324" cy="218" r="6" fill="#2775CA" />
      <text x="324" y="221.5" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700">✓</text>
      <rect x="334" y="217" width="28" height="1.5" rx="0.75" fill="#0f1f2e" fillOpacity="0.12" />
      <circle cx="368" cy="218" r="6" fill="#0f1f2e" fillOpacity="0.10" />
      <text x="368" y="221.5" textAnchor="middle" fill="#0f1f2e" fillOpacity="0.4" fontSize="6.5" fontWeight="700">3</text>
      <text x="272" y="242" fill="#0f1f2e" fillOpacity="0.4" fontSize="7" fontFamily="'DM Sans', sans-serif">Funded</text>
      <text x="318" y="242" fill="#0f1f2e" fillOpacity="0.4" fontSize="7" fontFamily="'DM Sans', sans-serif">Submitted</text>
      <text x="358" y="242" fill="#0f1f2e" fillOpacity="0.4" fontSize="7" fontFamily="'DM Sans', sans-serif">Confirm</text>

      {/* ── Card 3: Payout ── */}
      <g filter="url(#cardShadow)">
        <rect x="148" y="228" width="172" height="96" rx="16" fill="url(#cardLight)" />
        <rect x="148" y="228" width="172" height="96" rx="16" stroke="#22c55e" strokeOpacity="0.20" strokeWidth="1" />
      </g>
      {/* Success glow */}
      <ellipse cx="234" cy="270" rx="70" ry="42" fill="url(#successGlow)" />
      {/* Check badge */}
      <circle cx="178" cy="264" r="18" fill="#22c55e" fillOpacity="0.12" />
      <circle cx="178" cy="264" r="12" fill="#22c55e" />
      <text x="178" y="268.5" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">✓</text>
      {/* Payout text */}
      <rect x="204" y="254" width="52" height="8" rx="4" fill="#0f1f2e" fillOpacity="0.10" />
      <text x="204" y="275" fill="#0f1f2e" fillOpacity="0.9" fontSize="16" fontWeight="700" fontFamily="'Space Grotesk', sans-serif">$2,400</text>
      <text x="252" y="275" fill="#2775CA" fontSize="8.5" fontWeight="600" fontFamily="'DM Sans', sans-serif">USDC</text>
      <text x="204" y="290" fill="#22c55e" fontSize="8" fontFamily="'DM Sans', sans-serif">96% released to talent</text>
      {/* Stars */}
      <text x="204" y="308" fill="#f59e0b" fontSize="10">★★★★★</text>

      {/* ── Floating USDC coins ── */}
      {/* Large coin top-right */}
      <g filter="url(#coinShadow)">
        <circle cx="418" cy="68" r="24" fill="url(#usdcCoin)" />
        <circle cx="418" cy="68" r="18" stroke="white" strokeWidth="1.2" strokeOpacity="0.2" fill="none" />
        <text x="418" y="73.5" textAnchor="middle" fill="white" fontSize="15" fontWeight="700" fontFamily="'DM Sans', sans-serif">$</text>
      </g>
      {/* Small coin left */}
      <g filter="url(#coinShadow)">
        <circle cx="30" cy="240" r="14" fill="url(#usdcCoin)" fillOpacity="0.7" />
        <circle cx="30" cy="240" r="10.5" stroke="white" strokeWidth="1" strokeOpacity="0.2" fill="none" />
        <text x="30" y="244.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="'DM Sans', sans-serif">$</text>
      </g>
      {/* Tiny coin */}
      <circle cx="460" cy="290" r="9" fill="url(#usdcCoin)" fillOpacity="0.5" filter="url(#coinShadow)" />
      <text x="460" y="293.5" textAnchor="middle" fill="white" fontSize="6" fontWeight="700" fontFamily="'DM Sans', sans-serif">$</text>

      {/* ── Arc network badge ── */}
      <g filter="url(#cardShadow)">
        <rect x="390" y="280" width="76" height="32" rx="12" fill="url(#cardLight)" />
        <rect x="390" y="280" width="76" height="32" rx="12" stroke="#0f1f2e" strokeOpacity="0.07" strokeWidth="1" />
      </g>
      <circle cx="408" cy="296" r="7" fill="url(#accentGrad)" />
      <text x="408" y="299.5" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700" fontFamily="'Space Grotesk', sans-serif">A</text>
      <text x="420" y="293" fill="#0f1f2e" fillOpacity="0.5" fontSize="6.5" fontFamily="'DM Sans', sans-serif">Arc</text>
      <text x="420" y="303" fill="#0f1f2e" fillOpacity="0.75" fontSize="7" fontWeight="600" fontFamily="'DM Sans', sans-serif">Testnet</text>

      {/* ── Decorative ring (top left) ── */}
      <circle cx="28" cy="60" r="28" stroke="#2775CA" strokeWidth="1" strokeOpacity="0.12" strokeDasharray="5 4" fill="none" />
      <circle cx="28" cy="60" r="18" stroke="#2775CA" strokeWidth="1" strokeOpacity="0.08" fill="none" />
    </svg>
  )
}

/** Compact escrow-lock icon for empty states and illustrations */
export function EscrowIcon({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <rect x="4" y="4" width="40" height="40" rx="12" fill="currentColor" fillOpacity="0.06" />
      <rect x="4" y="4" width="40" height="40" rx="12" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1.5" fill="none" />
      {/* Lock body */}
      <rect x="14" y="22" width="20" height="16" rx="4" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      {/* Lock shackle */}
      <path d="M17 22v-5a7 7 0 0 1 14 0v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Keyhole */}
      <circle cx="24" cy="30" r="2.5" fill="currentColor" fillOpacity="0.4" />
      <rect x="23.25" y="30" width="1.5" height="4" rx="0.75" fill="currentColor" fillOpacity="0.4" />
    </svg>
  )
}

/** Onchain badge — used in How It Works */
export function OnchainBadge({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      <rect width="40" height="40" rx="10" fill="#2775CA" fillOpacity="0.1" />
      <circle cx="20" cy="20" r="8" stroke="#2775CA" strokeWidth="1.5" fill="none" />
      <circle cx="20" cy="20" r="3.5" fill="#2775CA" />
      <path d="M12 20 H20" stroke="#2775CA" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 20 H28" stroke="#2775CA" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" />
    </svg>
  )
}
