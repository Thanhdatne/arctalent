/**
 * POST /api/avatar/upload
 *
 * Vercel serverless function — receives a multipart form from the browser,
 * validates the image server-side, and pins it to IPFS via Pinata.
 *
 * PINATA_JWT is read exclusively from process.env (server-side).
 * It is never exposed to the browser, never appears in API responses,
 * and is not accessible via import.meta.env.
 *
 * Request (multipart/form-data):
 *   file    — image/jpeg | image/png | image/webp, max 2 MB
 *   address — Ethereum wallet address (0x...)
 *
 * Response 200: { url: string }           — Pinata gateway URL
 * Response 4xx: { error: string }         — validation / auth error (no secrets)
 * Response 500: { error: string }         — upstream / server error (no secrets)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_BYTES       = 2 * 1024 * 1024          // 2 MB
const ALLOWED_MIME    = new Set(['image/jpeg', 'image/png', 'image/webp'])
// Magic-byte signatures for allowed image types
const MAGIC: Array<{ mime: string; bytes: number[]; offset: number }> = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF],           offset: 0 },
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47],     offset: 0 },
  { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50],     offset: 8 }, // "WEBP" at byte 8
]
const PINATA_UPLOAD   = 'https://api.pinata.cloud/pinning/pinFileToIPFS'
const PINATA_GATEWAY  = 'https://gateway.pinata.cloud/ipfs'
// Simple address regex — not full EIP-55 checksum validation, sufficient for metadata key
const ADDRESS_RE      = /^0x[0-9a-fA-F]{40}$/

// ─── Helpers ──────────────────────────────────────────────────────────────────

function err(res: VercelResponse, status: number, message: string): void {
  res.status(status).json({ error: message })
}

/** Detect image type from magic bytes; returns MIME string or null. */
function detectImageMime(buf: Buffer): string | null {
  for (const sig of MAGIC) {
    const slice = buf.slice(sig.offset, sig.offset + sig.bytes.length)
    if (sig.bytes.every((b, i) => slice[i] === b)) return sig.mime
  }
  return null
}

/** Collect the raw body from an IncomingMessage into a Buffer. */
async function rawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ─── Multipart parser (no external deps) ─────────────────────────────────────

interface MultipartField { name: string; filename?: string; contentType?: string; data: Buffer }

function parseMultipart(body: Buffer, boundary: string): MultipartField[] {
  const sep   = Buffer.from('--' + boundary)
  const end   = Buffer.from('--' + boundary + '--')
  const fields: MultipartField[] = []
  let   pos   = 0

  while (pos < body.length) {
    // Find next boundary
    const bStart = body.indexOf(sep, pos)
    if (bStart === -1) break
    const lineEnd = body.indexOf('\r\n', bStart)
    if (lineEnd === -1) break
    pos = lineEnd + 2

    // Check for final boundary
    const marker = body.slice(bStart, lineEnd)
    if (marker.equals(end) || marker.toString().trim() === '--' + boundary + '--') break

    // Parse headers
    const headersEnd = body.indexOf('\r\n\r\n', pos)
    if (headersEnd === -1) break
    const headersRaw = body.slice(pos, headersEnd).toString()
    pos = headersEnd + 4

    // Find end of this part
    const nextBoundary = body.indexOf('\r\n' + sep.toString(), pos)
    const partEnd = nextBoundary === -1 ? body.length : nextBoundary
    const data = body.slice(pos, partEnd)
    pos = partEnd + 2

    // Extract headers
    let name = ''
    let filename: string | undefined
    let contentType: string | undefined
    for (const line of headersRaw.split('\r\n')) {
      const lower = line.toLowerCase()
      if (lower.startsWith('content-disposition:')) {
        const nm    = line.match(/\bname="([^"]+)"/i)
        const fn    = line.match(/\bfilename="([^"]+)"/i)
        if (nm) name = nm[1]
        if (fn) filename = fn[1]
      } else if (lower.startsWith('content-type:')) {
        contentType = line.split(':')[1]?.trim()
      }
    }
    if (name) fields.push({ name, filename, contentType, data })
  }
  return fields
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Only POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return err(res, 405, 'Method not allowed.')
  }

  // Require PINATA_JWT server-side
  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    return err(res, 503, 'Avatar storage is not configured on this server.')
  }

  // Content-Type must be multipart/form-data
  const ct = req.headers['content-type'] ?? ''
  const boundaryMatch = ct.match(/boundary=([^\s;]+)/i)
  if (!ct.includes('multipart/form-data') || !boundaryMatch) {
    return err(res, 400, 'Expected multipart/form-data.')
  }
  const boundary = boundaryMatch[1].replace(/^"(.*)"$/, '$1')

  // Read raw body (Vercel passes it unparsed when bodyParser is disabled)
  let body: Buffer
  try {
    body = await rawBody(req)
  } catch {
    return err(res, 400, 'Could not read request body.')
  }

  if (body.length > MAX_BYTES + 8192) {
    // +8192 headroom for multipart overhead
    return err(res, 413, 'Request too large. Maximum avatar size is 2 MB.')
  }

  // Parse multipart
  const fields = parseMultipart(body, boundary)
  const fileField    = fields.find((f) => f.name === 'file')
  const addressField = fields.find((f) => f.name === 'address')

  if (!fileField) return err(res, 400, 'Missing file field.')
  if (!addressField) return err(res, 400, 'Missing address field.')

  const address = addressField.data.toString().trim().toLowerCase()
  if (!ADDRESS_RE.test(address) && !ADDRESS_RE.test('0x' + address)) {
    return err(res, 400, 'Invalid wallet address.')
  }
  const normalizedAddress = address.startsWith('0x') ? address : '0x' + address

  // Validate file size
  if (fileField.data.length > MAX_BYTES) {
    return err(res, 413, 'Image must be under 2 MB.')
  }
  if (fileField.data.length === 0) {
    return err(res, 400, 'Empty file.')
  }

  // Validate MIME from Content-Type header
  const declaredMime = fileField.contentType?.split(';')[0]?.trim() ?? ''
  if (!ALLOWED_MIME.has(declaredMime)) {
    return err(res, 415, 'Only JPEG, PNG, and WebP images are accepted.')
  }

  // Validate magic bytes (content-based, not just header)
  const detectedMime = detectImageMime(fileField.data)
  if (!detectedMime) {
    return err(res, 415, 'File content does not match a supported image format.')
  }
  if (detectedMime !== declaredMime) {
    return err(res, 415, 'File content type does not match the declared content type.')
  }

  // Build FormData for Pinata
  const formData = new FormData()
  const blob = new Blob([fileField.data], { type: detectedMime })
  formData.append('file', blob, 'avatar.jpg')
  formData.append(
    'pinataMetadata',
    JSON.stringify({
      name: `arctalent-avatar-${normalizedAddress}`,
      keyvalues: {
        arctalent_address: normalizedAddress,
        arctalent_type: 'avatar',
      },
    }),
  )
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

  // Upload to Pinata (server-side, JWT never leaves the server)
  let pinataRes: Response
  try {
    pinataRes = await fetch(PINATA_UPLOAD, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: formData,
    })
  } catch {
    return err(res, 502, 'Could not reach IPFS storage. Please try again.')
  }

  if (!pinataRes.ok) {
    // Return a generic error — do NOT forward Pinata's response which may contain the JWT
    return err(res, 502, `IPFS storage returned an error (${pinataRes.status}). Please try again.`)
  }

  let data: { IpfsHash?: string }
  try {
    data = await pinataRes.json() as { IpfsHash?: string }
  } catch {
    return err(res, 502, 'Unexpected response from IPFS storage.')
  }

  if (!data.IpfsHash) {
    return err(res, 502, 'Upload succeeded but no CID was returned.')
  }

  const url = `${PINATA_GATEWAY}/${data.IpfsHash}`
  res.status(200).json({ url })
}

// Disable Vercel's built-in body parser so we can read raw multipart bytes
export const config = { api: { bodyParser: false } }
