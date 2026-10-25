/**
 * Avatar management — crop, validate, and local/remote storage.
 *
 * Storage tiers (priority order on read):
 *  1. previewUrl prop  — live preview before saving
 *  2. arctalent-avatar-url-{address}  — IPFS gateway URL cached in localStorage
 *  3. arctalent-avatar-{address}      — local dataUrl (device-only, legacy fallback)
 *  4. Initials gradient               — always available
 *
 * Write path (browser):
 *  processAvatarFile  — validate + crop to 256×256 JPEG dataUrl (client-side canvas)
 *  POST /api/avatar/upload  — server uploads to Pinata, returns { url }
 *  saveAvatarUrl      — cache the returned IPFS URL in localStorage
 *  saveAvatar         — cache the dataUrl as local fallback
 *
 * Discovery (cross-device):
 *  GET /api/avatar/lookup?address=0x...  — server queries Pinata pinList with auth,
 *  returns { url } or { url: null }. Result cached in localStorage by useRemoteAvatar.
 *
 * No Pinata credentials ever appear in browser code.
 */

const LS_KEY_DATA = (address: string) => `arctalent-avatar-${address.toLowerCase()}`
const LS_KEY_URL  = (address: string) => `arctalent-avatar-url-${address.toLowerCase()}`

const MAX_SIZE_BYTES  = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES   = ['image/jpeg', 'image/png', 'image/webp']
const OUTPUT_SIZE     = 256 // pixels

// ─── Error class ──────────────────────────────────────────────────────────────

export class AvatarValidationError extends Error {
  code: 'too_large' | 'wrong_type' | 'crop_failed' | 'upload_failed'
  constructor(code: AvatarValidationError['code'], message: string) {
    super(message)
    this.code = code
    this.name = 'AvatarValidationError'
  }
}

// ─── Crop / validate ──────────────────────────────────────────────────────────

/** Crop a File to a centered 256×256 square and return a JPEG data URL. */
export async function cropToSquare(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const size = Math.min(img.naturalWidth, img.naturalHeight)
      const sx   = (img.naturalWidth  - size) / 2
      const sy   = (img.naturalHeight - size) / 2
      const canvas = document.createElement('canvas')
      canvas.width  = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas unavailable')); return }
      ctx.drawImage(img, sx, sy, size, size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')) }
    img.src = url
  })
}

/** Validate type + size, then crop. Returns dataUrl or throws AvatarValidationError. */
export async function processAvatarFile(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new AvatarValidationError('wrong_type', 'Please choose a JPEG, PNG, or WebP image.')
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new AvatarValidationError('too_large', 'Image must be under 2 MB.')
  }
  try {
    return await cropToSquare(file)
  } catch {
    throw new AvatarValidationError('crop_failed', 'Could not process the image. Please try another file.')
  }
}

// ─── Local storage ────────────────────────────────────────────────────────────

/** Save local dataUrl fallback (device-only). */
export function saveAvatar(address: string, dataUrl: string): void {
  try { localStorage.setItem(LS_KEY_DATA(address), dataUrl) } catch { /* quota */ }
}

/** Remove local dataUrl and cached remote URL for this address. */
export function removeAvatar(address: string): void {
  localStorage.removeItem(LS_KEY_DATA(address))
  localStorage.removeItem(LS_KEY_URL(address))
}

/** Read the local dataUrl, or null. */
export function loadAvatar(address: string): string | null {
  try { return localStorage.getItem(LS_KEY_DATA(address)) } catch { return null }
}

/** Cache the remote IPFS URL for instant reads (no network roundtrip). */
export function saveAvatarUrl(address: string, url: string): void {
  try { localStorage.setItem(LS_KEY_URL(address), url) } catch { /* quota */ }
}

/** Remove only the cached remote URL. */
export function removeAvatarUrl(address: string): void {
  localStorage.removeItem(LS_KEY_URL(address))
}

/** Read the cached remote IPFS gateway URL, or null. */
export function loadAvatarUrl(address: string): string | null {
  try { return localStorage.getItem(LS_KEY_URL(address)) } catch { return null }
}

/** Best available URL for displaying an avatar — IPFS URL preferred over dataUrl. */
export function loadBestAvatarUrl(address: string): string | null {
  return loadAvatarUrl(address) ?? loadAvatar(address)
}

// ─── Server-side upload (via /api/avatar/upload) ──────────────────────────────

/**
 * POST the cropped JPEG to the /api/avatar/upload serverless function.
 * The server validates and uploads to Pinata using PINATA_JWT (server-side only).
 * Returns the public IPFS gateway URL.
 * Throws AvatarValidationError('upload_failed', ...) on any error.
 */
export async function uploadAvatarToServer(dataUrl: string, address: string): Promise<string> {
  // Convert data URL → Blob
  let blob: Blob
  try {
    const fetchRes = await fetch(dataUrl)
    blob = await fetchRes.blob()
  } catch {
    throw new AvatarValidationError('upload_failed', 'Could not prepare image for upload.')
  }

  const form = new FormData()
  form.append('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
  form.append('address', address.toLowerCase())

  let response: Response
  try {
    response = await fetch('/api/avatar/upload', {
      method: 'POST',
      body: form,
    })
  } catch {
    throw new AvatarValidationError('upload_failed', 'Network error — could not reach the upload service.')
  }

  // Parse response body regardless of status
  let body: { url?: string; error?: string }
  try {
    body = await response.json() as { url?: string; error?: string }
  } catch {
    throw new AvatarValidationError('upload_failed', `Upload failed (${response.status}).`)
  }

  if (!response.ok) {
    throw new AvatarValidationError(
      'upload_failed',
      body.error ?? `Upload failed (${response.status}).`,
    )
  }

  if (!body.url) {
    throw new AvatarValidationError('upload_failed', 'Upload succeeded but no URL was returned.')
  }

  return body.url
}

// ─── Server-side discovery (via /api/avatar/lookup) ───────────────────────────

/**
 * Ask /api/avatar/lookup for another user's avatar URL.
 * Returns the gateway URL string or null (no avatar / service not configured).
 * Never throws — callers should fall back gracefully.
 */
export async function fetchRemoteAvatar(address: string): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/avatar/lookup?address=${encodeURIComponent(address.toLowerCase())}`,
    )
    if (!res.ok) return null
    const data = await res.json() as { url?: string | null }
    return data.url ?? null
  } catch {
    return null
  }
}
