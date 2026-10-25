import { Sun, Moon } from 'lucide-react'
import { useThemeContext } from '@/contexts/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeContext()

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="
        p-2 rounded-lg text-[var(--muted)] hover:text-[var(--ink)]
        hover:bg-[var(--surface-muted)] transition-colors duration-150
      "
    >
      {theme === 'dark'
        ? <Sun size={18} strokeWidth={1.75} />
        : <Moon size={18} strokeWidth={1.75} />}
    </button>
  )
}
