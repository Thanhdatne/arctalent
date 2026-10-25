/**
 * GET /api/avatar/lookup?address=0x...
 *
 * Vercel serverless function — queries Pinata's pinList API server-side
 * (auth required) and returns the public IPFS gateway URL for a wallet's
 * most-recent avatar pin.
 *
 * PINATA_JWT is read exclusively from process.env. It is never returned
 * in the response body, never logged, and never accessible from the browser.
 *
 * Query params:
 *   address — Ethereum wallet address (0x...)
 *
 * Response 200: { url: string | null }
 *   url is null when no avatar has been uploaded for this address.
 *
 * Response 4xx/5xx: { error: string }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

const PINATA_PINLIST  = 'https://api.pinata.cloud/data/pinList'
const PINATA_GATEWAY  = 'https://gateway.pinata.cloud/ipfs'
const ADDRESS_RE      = /^0x[0-9a-fA-F]{40}$/

function err(res: VercelResponse, status: number, message: string): void {
  res.status(status).json({ error: message })
}

interface PinItem {
  ipfs_pin_hash: string
  date_pinned:   string
}
interface PinListResponse {
  count: number
  rows:  PinItem[]
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return err(res, 405, 'Method not allowed.')
  }

  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    // Storage not configured — return null gracefully (not an error for the caller)
    res.setHeader('Cache-Control', 'no-store')
    return void res.status(200).json({ url: null })
  }

  const raw = Array.isArray(req.query.address)
    ? req.query.address[0]
    : (req.query.address ?? '')
  const address = raw.trim().toLowerCase()

  if (!ADDRESS_RE.test(address)) {
    return err(res, 400, 'Invalid wallet address.')
  }

  // Build Pinata pinList query — filtered by wallet address metadata
  const qs = [
    `status=pinned`,
    `metadata[keyvalues][arctalent_address][value]=${encodeURIComponent(address)}`,
    `metadata[keyvalues][arctalent_address][op]=eq`,
    `metadata[keyvalues][arctalent_type][value]=avatar`,
    `metadata[keyvalues][arctalent_type][op]=eq`,
    `pageLimit=5`,
  ].join('&')

  let pinataRes: Response
  try {
    pinataRes = await fetch(`${PINATA_PINLIST}?${qs}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
  } catch {
    // Network error reaching Pinata — return null so avatar falls back gracefully
    res.setHeader('Cache-Control', 'no-store')
    return void res.status(200).json({ url: null })
  }

  if (!pinataRes.ok) {
    // Auth error or Pinata outage — do not leak Pinata's response
    res.setHeader('Cache-Control', 'no-store')
    return void res.status(200).json({ url: null })
  }

  let data: PinListResponse
  try {
    data = await pinataRes.json() as PinListResponse
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    return void res.status(200).json({ url: null })
  }

  if (!data.rows?.length) {
    // Cache "no avatar" briefly so clients don't hammer the endpoint
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
    return void res.status(200).json({ url: null })
  }

  // Return the most recently pinned avatar
  const sorted = [...data.rows].sort(
    (a, b) => new Date(b.date_pinned).getTime() - new Date(a.date_pinned).getTime(),
  )
  const url = `${PINATA_GATEWAY}/${sorted[0].ipfs_pin_hash}`

  // Cache hit for 5 min; avatars rarely change
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  res.status(200).json({ url })
}
