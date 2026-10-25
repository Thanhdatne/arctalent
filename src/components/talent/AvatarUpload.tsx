/**
 * Avatar upload control.
 *
 * Flow:
 *   Pick file → validate + crop (client-side canvas) → preview →
 *   "Save" → POST /api/avatar/upload (server validates + pins to IPFS) →
 *   cache returned IPFS URL + dataUrl in localStorage → onChange()
 *
 * Fallback on upload error:
 *   Shows the error message and a "Save locally instead" button that
 *   stores the dataUrl in localStorage (device-only). The user is told
 *   clearly which storage is in effect.
 *
 * The Pinata JWT never appears in browser code; it lives exclusively in
 * process.env.PINATA_JWT on the server.
 */
import { useRef, useState } from 'react'
import { Camera, Trash2, Loader2, HardDrive, Globe, UploadCloud } from 'lucide-react'
import {
  processAvatarFile,
  saveAvatar,
  saveAvatarUrl,
  removeAvatar,
  removeAvatarUrl,
  loadBestAvatarUrl,
  uploadAvatarToServer,
  AvatarValidationError,
} from '@/hooks/useAvatar'
import { Avatar } from './Avatar'

interface AvatarUploadProps {
  address: string
  name: string
  /** Called after a successful save or removal so parents can re-render. */
  onChange?: () => void
}

type Status = 'idle' | 'processing' | 'ready' | 'uploading' | 'saved' | 'saved-local' | 'error'

export function AvatarUpload({ address, name, onChange }: AvatarUploadProps) {
  const inputRef   = useRef<HTMLInputElement>(null)
  const [preview,  setPreview]  = useState<string | null>(null)
  const [status,   setStatus]   = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const hasStored  = !!loadBestAvatarUrl(address)
  const hasPreview = !!preview

  // ─── File pick → crop → preview ─────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setStatus('processing')
    setErrorMsg('')
    setPreview(null)

    try {
      const dataUrl = await processAvatarFile(file)
      setPreview(dataUrl)
      setStatus('ready')
    } catch (err) {
      setErrorMsg(err instanceof AvatarValidationError ? err.message : 'Could not process the image.')
      setStatus('error')
    }
  }

  // ─── Save: POST to /api/avatar/upload ───────────────────────────────────────
  async function handleSave() {
    if (!preview) return
    setStatus('uploading')
    try {
      const gatewayUrl = await uploadAvatarToServer(preview, address)
      saveAvatarUrl(address, gatewayUrl)  // cache for instant cross-device reads
      saveAvatar(address, preview)         // local dataUrl as fallback
      setStatus('saved')
      setPreview(null)
      onChange?.()
    } catch (err) {
      const msg = err instanceof AvatarValidationError ? err.message : 'Upload failed.'
      setErrorMsg(msg)
      setStatus('error')
    }
  }

  /** Fallback: save locally after an upload failure. */
  function handleSaveLocal() {
    if (!preview) return
    saveAvatar(address, preview)
    setStatus('saved-local')
    setPreview(null)
    setErrorMsg('')
    onChange?.()
  }

  function handleDiscard() {
    setPreview(null)
    setStatus('idle')
    setErrorMsg('')
  }

  function handleRemove() {
    removeAvatar(address)
    removeAvatarUrl(address)
    setPreview(null)
    setStatus('idle')
    onChange?.()
  }

  const isWorking = status === 'processing' || status === 'uploading'

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex items-center gap-4">
        {/* Avatar preview */}
        <div className="relative shrink-0">
          <Avatar
            address={address}
            name={name}
            size={72}
            previewUrl={preview}
            fetchRemote={false}
            className="shadow-sm"
          />
          {isWorking && (
            <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
              <Loader2 size={20} className="text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2">
          {/* Upload / replace button */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isWorking}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-strong)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-50"
          >
            <Camera size={13} />
            {hasStored || hasPreview ? 'Replace photo' : 'Upload photo'}
          </button>

          {/* Save / Discard (shown when preview is ready) */}
          {status === 'ready' && preview && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { void handleSave() }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors"
              >
                <UploadCloud size={13} />
                Save to IPFS
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                Discard
              </button>
            </div>
          )}

          {/* Uploading indicator */}
          {status === 'uploading' && (
            <p className="text-xs text-[var(--muted)] flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" />
              Uploading to IPFS…
            </p>
          )}

          {/* Remove (when a stored avatar exists, no pending preview) */}
          {(hasStored || status === 'saved' || status === 'saved-local') &&
            !hasPreview &&
            status !== 'ready' &&
            status !== 'uploading' && (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--danger)] hover:bg-[var(--danger)]/5 hover:border-[var(--danger)]/30 transition-colors"
            >
              <Trash2 size={12} />
              Remove photo
            </button>
          )}

          {/* Success: saved to IPFS */}
          {status === 'saved' && (
            <p className="text-xs text-[var(--success)] font-medium flex items-center gap-1">
              <Globe size={11} />
              Saved to IPFS — visible to everyone
            </p>
          )}

          {/* Success: saved locally (after fallback) */}
          {status === 'saved-local' && (
            <p className="text-xs text-[var(--muted)] font-medium">
              Saved on this device only.
            </p>
          )}
        </div>
      </div>

      {/* Upload error + fallback options */}
      {status === 'error' && errorMsg && (
        <div className="flex flex-col gap-2 w-full">
          <p className="text-xs text-[var(--danger)] bg-[var(--danger)]/8 px-3 py-2 rounded-lg border border-[var(--danger)]/20">
            {errorMsg}
          </p>
          {preview && (
            <button
              type="button"
              onClick={handleSaveLocal}
              className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--ink-2)] hover:bg-[var(--surface-strong)] transition-colors"
            >
              <HardDrive size={11} />
              Save locally instead
            </button>
          )}
          <button
            type="button"
            onClick={handleDiscard}
            className="self-start text-xs text-[var(--muted)] underline underline-offset-2"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Storage notice */}
      {status !== 'saved' && status !== 'error' && (
        <div className="inline-flex items-center gap-1.5 text-xs text-[var(--subtle)]">
          <Globe size={11} />
          <span>Photos are stored on IPFS and visible to everyone</span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { void handleFileChange(e) }}
        aria-label="Upload avatar image"
      />
    </div>
  )
}
