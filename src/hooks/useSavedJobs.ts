/**
 * Device-local saved jobs.
 * Stored in localStorage keyed by wallet address.
 * NOT synchronized across devices or wallets.
 */
import { useState, useCallback, useEffect } from 'react'

const storageKey = (addr: string) => `arctalent-saved-${addr.toLowerCase()}`

export function useSavedJobs(address: string | undefined) {
  const key = address ? storageKey(address) : null

  const readSaved = (): number[] => {
    if (!key) return []
    try {
      return JSON.parse(localStorage.getItem(key) ?? '[]') as number[]
    } catch {
      return []
    }
  }

  const [saved, setSaved] = useState<number[]>(readSaved)

  // Re-sync when address changes
  useEffect(() => {
    setSaved(readSaved())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const toggleSave = useCallback(
    (jobId: number) => {
      if (!key) return
      setSaved((prev) => {
        const next = prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
        localStorage.setItem(key, JSON.stringify(next))
        return next
      })
    },
    [key]
  )

  const isSaved = useCallback((jobId: number) => saved.includes(jobId), [saved])

  return { saved, isSaved, toggleSave }
}
