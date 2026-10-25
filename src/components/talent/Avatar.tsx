/**
 * Shared avatar renderer — TalentCard, TalentProfile, Dashboard, AvatarUpload.
 *
 * Display priority:
 *  1. previewUrl prop (live preview before saving — owner only)
 *  2. Remote IPFS URL from useRemoteAvatar (cross-device, when fetchRemote=true)
 *  3. Cached IPFS URL from localStorage (instant — set after first remote fetch)
 *  4. Local dataUrl from localStorage (device-only legacy / fallback)
 *  5. Deterministic initials gradient (always available)
 *
 * fetchRemote=true  → used for public-facing views (TalentCard, TalentProfile)
 * fetchRemote=false → used in upload controls where the owner's own cached URL
 *                     is always current without a network round-trip
 */
import { useState } from 'react'
import { loadBestAvatarUrl } from '@/hooks/useAvatar'
import { useRemoteAvatar } from '@/hooks/useRemoteAvatar'

export interface AvatarProps {
  address: string
  name: string
  /** Size in pixels — renders as a square. */
  size?: number
  /** Extra Tailwind classes on the outer element. */
  className?: string
  /** Override the displayed URL (live preview before saving). */
  previewUrl?: string | null
  /**
   * When true, fetches the avatar from Pinata if not locally cached.
   * Use for public-facing profile views (TalentCard, TalentProfile).
   * Default false — avoids network calls in upload contexts.
   */
  fetchRemote?: boolean
}

/** Deterministic hue from the first 8 hex chars of the address. */
function avatarHue(address: string): number {
  let hash = 0
  for (let i = 2; i < 10; i++) hash = (hash * 31 + parseInt(address[i] ?? '0', 16)) | 0
  return Math.abs(hash) % 360
}

function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

// Inner component that uses the remote hook — only mounted when fetchRemote=true
function AvatarWithRemote({ address, name, size, className, previewUrl }: AvatarProps) {
  const { url: remoteUrl, loading } = useRemoteAvatar(address)
  const localUrl = loadBestAvatarUrl(address)
  const resolvedUrl = previewUrl ?? remoteUrl ?? localUrl

  return (
    <AvatarDisplay
      address={address}
      name={name}
      size={size}
      className={className}
      resolvedUrl={resolvedUrl}
      loading={loading && !resolvedUrl}
    />
  )
}

interface DisplayProps {
  address: string
  name: string
  size?: number
  className?: string
  resolvedUrl: string | null
  loading?: boolean
}

function AvatarDisplay({ address, name, size = 48, className = '', resolvedUrl, loading }: DisplayProps) {
  const [imgError, setImgError] = useState(false)
  const [imgKey, setImgKey] = useState(0)

  const hue = avatarHue(address)
  const gradientStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, hsl(${hue},60%,45%) 0%, hsl(${(hue + 30) % 360},55%,35%) 100%)`,
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    fontSize: Math.round(size * 0.35),
  }

  function handleError() {
    setImgError(true)
    setImgKey((k) => k + 1)
  }

  // Loading shimmer — shown while remote fetch is in progress and no URL yet
  if (loading) {
    return (
      <div
        className={`rounded-xl animate-pulse bg-[var(--surface-strong)] ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        aria-label="Loading avatar"
      />
    )
  }

  if (resolvedUrl && !imgError) {
    return (
      <img
        key={`${imgKey}-${resolvedUrl}`}
        src={resolvedUrl}
        alt={`${name} avatar`}
        width={size}
        height={size}
        className={`rounded-xl object-cover ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        onError={handleError}
      />
    )
  }

  return (
    <div
      className={`rounded-xl flex items-center justify-center text-white font-bold shrink-0 ${className}`}
      style={gradientStyle}
      aria-label={`${name} avatar`}
    >
      {getInitials(name)}
    </div>
  )
}

export function Avatar({ fetchRemote = false, ...props }: AvatarProps) {
  if (fetchRemote) {
    return <AvatarWithRemote {...props} fetchRemote />
  }

  // No remote fetch — read from localStorage synchronously
  const localUrl = props.previewUrl ?? loadBestAvatarUrl(props.address)
  return <AvatarDisplay {...props} resolvedUrl={localUrl} />
}
