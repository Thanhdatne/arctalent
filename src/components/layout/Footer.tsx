import { Link } from 'react-router-dom'
import { CONTRACTS } from '@/config'

const EXPLORER = 'https://explorer.testnet.arc.io'

const NAV = [
  {
    heading: 'Product',
    links: [
      { label: 'Job Board', to: '/jobs' },
      { label: 'Talent Directory', to: '/talent' },
      { label: 'Post a Job', to: '/post-job' },
      { label: 'Dashboard', to: '/dashboard' },
    ],
  },
  {
    heading: 'For Talent',
    links: [
      { label: 'Create Profile', to: '/dashboard' },
      { label: 'Browse Jobs', to: '/jobs' },
      { label: 'Referral Program', to: '/dashboard' },
    ],
  },
  {
    heading: 'For Clients',
    links: [
      { label: 'Post a Job', to: '/post-job' },
      { label: 'Find Talent', to: '/talent' },
      { label: 'How Escrow Works', to: '/jobs' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Arc Testnet Explorer', href: EXPLORER },
      { label: 'JobEscrow Contract', href: CONTRACTS.jobEscrow ? `${EXPLORER}/address/${CONTRACTS.jobEscrow}` : EXPLORER },
      { label: 'USDC on Arc', href: 'https://developers.circle.com' },
      { label: 'Built with Arc Studio', href: 'https://studio.arc.io' },
    ],
  },
]

const CURRENT_YEAR = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="bg-[var(--surface-muted)] border-t border-[var(--border)] mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Brand row */}
        <div className="flex items-start justify-between gap-8 mb-10 flex-wrap">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm display">AT</span>
              </div>
              <span className="font-bold text-[var(--ink)] display text-lg">ArcTalent</span>
            </div>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              The onchain talent marketplace for Web3 builders. Hire, pay, and earn with USDC escrow on Arc.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {NAV.map(({ heading, links }) => (
              <div key={heading}>
                <p className="section-label mb-3">{heading}</p>
                <ul className="space-y-2">
                  {links.map(({ label, to, href } : { label: string; to?: string; href?: string }) => (
                    <li key={label}>
                      {to ? (
                        <Link
                          to={to}
                          className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                        >
                          {label}
                        </Link>
                      ) : (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                        >
                          {label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className="border-t border-[var(--border)] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[var(--subtle)]">
            © {CURRENT_YEAR} ArcTalent. Built on Arc, powered by USDC.
          </p>
          <p className="text-xs text-[var(--subtle)]">
            Deployed on Arc Testnet — not for production use.
          </p>
        </div>
      </div>
    </footer>
  )
}
