/**
 * ThemeContext — shares the current theme and toggle across the tree.
 * Wrap the app root with <ThemeProvider>.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { useTheme, type Theme } from '@/hooks/useTheme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useTheme()
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeContext() {
  return useContext(ThemeContext)
}
