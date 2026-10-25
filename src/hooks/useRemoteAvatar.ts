/**
 * useRemoteAvatar — React hook for cross-device avatar resolution.
 *
 * Resolution order:
 *  1. localStorage cache (`arctalent-avatar-url-{address}`) — instant, no network
 *  2. Pinata pinList query — async, public, no auth required
 *  3. null — show initials placeholder
 *
 * The result is cached back into localStorage on first successful fetch so
 * subsequent renders are instant.
 *
 * Used by TalentCard and TalentProfile when rendering OTHER users' profiles.
 * The owning user's AvatarUpload writes to localStorage on save, so their
 * own Avatar reads from cache without a network round-trip.
 */
import { useState, useEffect, useRef } from 'react'
import { loadAvatarUrl, saveAvatarUrl, fetchRemoteAvatar } from './useAvatar'

interface RemoteAvatarState {
  url: string | null
  loading: boolean
}

// Module-level in-flight request cache — prevents duplicate fetches for the
// same address when multiple Avatar components mount simultaneously.
const inflight = new Map<string, Promise<string | null>>()

export function useRemoteAvatar(address: string | undefined): RemoteAvatarState {
  const addr = address?.toLowerCase() ?? ''

  // Synchronous cache check — no loading state if already cached
  const cached = addr ? loadAvatarUrl(addr) : null

  const [state, setState] = useState<RemoteAvatarState>({
    url: cached,
    loading: !cached && !!addr,
  })

  // Track the address this effect was mounted for so we don't apply a stale result
  const mountedAddr = useRef(addr)
  mountedAddr.current = addr

  useEffect(() => {
    if (!addr) {
      setState({ url: null, loading: false })
      return
    }

    // Already cached — use it, no fetch needed
    const cachedUrl = loadAvatarUrl(addr)
    if (cachedUrl) {
      setState({ url: cachedUrl, loading: false })
      return
    }

    // Reuse in-flight request if one is already running for this address
    let req = inflight.get(addr)
    if (!req) {
      req = fetchRemoteAvatar(addr)
      inflight.set(addr, req)
      void req.finally(() => inflight.delete(addr))
    }

    let cancelled = false
    req.then((url) => {
      if (cancelled || mountedAddr.current !== addr) return
      if (url) saveAvatarUrl(addr, url)
      setState({ url: url ?? null, loading: false })
    }).catch(() => {
      if (cancelled || mountedAddr.current !== addr) return
      setState({ url: null, loading: false })
    })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr])

  return state
}
