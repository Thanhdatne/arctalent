import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { Briefcase, Users, LayoutDashboard, Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { ThemeToggle } from './ThemeToggle'

export function Header() {
  const location = useLocation()
  const { isConnected } = useAccount()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = [
    { href: '/jobs', label: 'Job Board', icon: Briefcase },
    { href: '/talent', label: 'Talent', icon: Users },
    ...(isConnected
      ? [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
      : []),
  ]

  const isActive = (href: string) => location.pathname.startsWith(href)

  return (
    <header className="sticky top-0 z-50 bg-[var(--surface-strong)] backdrop-blur border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
            <span className="text-white font-bold text-sm display">AT</span>
          </div>
          <span className="font-bold text-[var(--ink)] display text-lg hidden sm:block">ArcTalent</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              to={href}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)]'
              }`}
            >
              <Icon size={15} />
              {label}
              {isActive(href) && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[var(--accent)]" />
              )}
            </Link>
          ))}
        </nav>

        {/* Right cluster: Post a Job + theme toggle + wallet + hamburger */}
        <div className="flex items-center gap-2 shrink-0">
          {isConnected && (
            <Link
              to="/post-job"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl
                         bg-[var(--accent)] text-white text-sm font-semibold
                         hover:bg-[var(--accent-hover)] transition-colors"
            >
              Post a Job
            </Link>
          )}

          <ThemeToggle />
          <ConnectKitButton />

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--surface-muted)] transition-colors"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu — animated */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="md:hidden border-t border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 space-y-1"
          >
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                to={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-[var(--surface-muted)] text-[var(--accent)] font-semibold'
                    : 'text-[var(--ink-2)] hover:bg-[var(--surface-muted)]'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
            {isConnected && (
              <Link
                to="/post-job"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-muted)]"
              >
                Post a Job
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
