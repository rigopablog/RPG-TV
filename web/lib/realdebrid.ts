/**
 * Real-Debrid REST API v1 client.
 *
 * Auth: get a private API token from https://real-debrid.com/apitoken
 * Plan: $3/month or 16€ for 180 days. Required for instant ad-free playback
 * of torrent-sourced content.
 *
 * Typical flow:
 *   1. instantAvailability(hash[]) → which torrents are cached
 *   2. addMagnet(magnet)           → returns torrent id
 *   3. selectFiles(id, fileIds[])  → tell RD which video file to extract
 *   4. getInfo(id)                 → wait until status === 'downloaded', then grab `links[]`
 *   5. unrestrictLink(link)        → returns a direct HLS/MP4 URL playable in any browser
 */

const RD_BASE = 'https://api.real-debrid.com/rest/1.0'

interface RDFile { id: number; path: string; bytes: number; selected: number }
export interface RDTorrentInfo {
  id: string
  filename: string
  hash: string
  bytes: number
  status: string           // 'downloaded' | 'downloading' | 'queued' | 'magnet_error' | ...
  progress: number
  files: RDFile[]
  links: string[]          // hoster links (need unrestrict)
}
export interface RDUnrestricted {
  id: string
  filename: string
  mimeType: string
  filesize: number
  link: string
  host: string
  streamable: number
  download: string         // ← the direct CDN URL you want
}

async function rd<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${RD_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  })
  // Read body once — RD sometimes returns 200 with empty body, or non-JSON.
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(`RD ${res.status} ${path}: ${text.slice(0, 200)}`)
  if (!text.trim()) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    // Some endpoints (selectFiles, delete) return empty 204 or plaintext
    return undefined as T
  }
}

/** Check which hashes are cached. Returns an object keyed by lowercase hash. */
export async function instantAvailability(
  token: string,
  hashes: string[],
): Promise<Record<string, unknown>> {
  if (!hashes.length) return {}
  // RD accepts /a/b/c/d in path
  const path = '/torrents/instantAvailability/' + hashes.map((h) => h.toLowerCase()).join('/')
  return rd<Record<string, unknown>>(path, token)
}

export async function addMagnet(token: string, magnet: string): Promise<{ id: string; uri: string }> {
  const body = new URLSearchParams({ magnet }).toString()
  return rd<{ id: string; uri: string }>('/torrents/addMagnet', token, { method: 'POST', body })
}

export async function selectFiles(token: string, id: string, fileIds: 'all' | string): Promise<void> {
  const body = new URLSearchParams({ files: fileIds }).toString()
  return rd<void>(`/torrents/selectFiles/${id}`, token, { method: 'POST', body })
}

export async function getInfo(token: string, id: string): Promise<RDTorrentInfo> {
  return rd<RDTorrentInfo>(`/torrents/info/${id}`, token)
}

export async function unrestrictLink(token: string, link: string): Promise<RDUnrestricted> {
  const body = new URLSearchParams({ link }).toString()
  return rd<RDUnrestricted>('/unrestrict/link', token, { method: 'POST', body })
}

export async function deleteTorrent(token: string, id: string): Promise<void> {
  return rd<void>(`/torrents/delete/${id}`, token, { method: 'DELETE' })
}

/**
 * High-level helper: take a magnet, return a directly streamable URL.
 * If cached on RD it resolves in 1–3 seconds. Otherwise it'll queue and
 * we return null so the caller can fall back.
 */
export async function magnetToStream(
  token: string,
  magnet: string,
  opts: { preferExt?: string[]; fileIdx?: number; titleHint?: string } = {},
): Promise<RDUnrestricted | null> {
  // Browser-playable formats first: MP4/M4V (Video.js + HLS.js handle these),
  // then MKV as last resort (won't play in most browsers, but the user might
  // have a player extension).
  const preferExt = opts.preferExt ?? ['mp4', 'm4v', 'webm', 'mkv']

  // 1. Add the magnet
  const added = await addMagnet(token, magnet)

  // 2. Wait for RD to enumerate files (cached torrents do this near-instantly)
  let info: RDTorrentInfo | null = null
  for (let i = 0; i < 10; i++) {
    info = await getInfo(token, added.id)
    if (info.files?.length) break
    await new Promise((r) => setTimeout(r, 500))
  }
  if (!info?.files?.length) return null

  // 3. Pick which file to extract.
  // Priority:
  //   a) `fileIdx` from Torrentio (knows exactly which file matches the title)
  //   b) Match the filename against `titleHint` (e.g. "Inception")
  //   c) Fall back to largest playable file
  let video: RDFile | undefined

  // RD's file index is 1-based; Torrentio's fileIdx is 0-based.
  if (typeof opts.fileIdx === 'number') {
    video = info.files.find((f) => f.id === opts.fileIdx! + 1)
  }

  if (!video && opts.titleHint) {
    const hint = opts.titleHint.toLowerCase()
    const playable = info.files.filter((f) =>
      preferExt.some((e) => f.path.toLowerCase().endsWith('.' + e)),
    )
    // Pick the file whose name shares the most tokens with the title hint
    const tokens = hint.split(/\W+/).filter((t) => t.length >= 3)
    let bestScore = 0
    for (const f of playable) {
      const name = f.path.toLowerCase()
      const score = tokens.filter((t) => name.includes(t)).length
      if (score > bestScore) {
        bestScore = score
        video = f
      }
    }
  }

  if (!video) {
    // Last resort: largest playable file
    const candidates = info.files
      .map((f) => {
        const lower = f.path.toLowerCase()
        const extIdx = preferExt.findIndex((e) => lower.endsWith('.' + e))
        return extIdx >= 0 ? { f, extIdx } : null
      })
      .filter((x): x is { f: RDFile; extIdx: number } => x !== null)
      .sort((a, b) => {
        if (a.extIdx !== b.extIdx) return a.extIdx - b.extIdx
        return b.f.bytes - a.f.bytes
      })
    video = candidates[0]?.f
  }

  if (!video) return null

  // 4. Tell RD to extract just that file
  await selectFiles(token, added.id, String(video.id))

  // 5. Poll until downloaded (instant for cached torrents)
  for (let i = 0; i < 20; i++) {
    info = await getInfo(token, added.id)
    if (info.status === 'downloaded' && info.links?.length) break
    if (info.status === 'magnet_error' || info.status === 'error') return null
    await new Promise((r) => setTimeout(r, 750))
  }
  if (!info?.links?.length) return null

  // 6. Unrestrict to get the direct CDN URL
  return unrestrictLink(token, info.links[0])
}
