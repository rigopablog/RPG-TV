/**
 * Ad-free stream resolver.
 *
 * Flow (when user has a Real-Debrid token):
 *   TMDB id → IMDB id → Torrentio magnets → RD cache check → resolve → direct HLS/MP4
 *
 * Returns the *direct* URL Video.js can play with zero ads, zero popups.
 *
 * Without an RD token we return `{ found: false }` so the client falls back
 * to the embed iframe player (with ads).
 */

import { NextRequest, NextResponse } from 'next/server'
import * as Torrentio from '@/lib/torrentio'
import * as RD from '@/lib/realdebrid'

export const runtime = 'nodejs'
export const maxDuration = 30

interface StreamSource {
  url: string
  quality: string
  type: 'hls' | 'mp4' | 'mkv'
  size?: number
  title?: string
}

interface SubTrack {
  url: string
  lang: string
  label: string
}

// ── TMDB helpers ──────────────────────────────────────────────────────────────
async function tmdbFetch(path: string): Promise<unknown | null> {
  const token = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  const url = new URL(`https://api.themoviedb.org/3${path}`)
  if (apiKey && !token) url.searchParams.set('api_key', apiKey)
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  return res.json()
}

async function tmdbToImdb(type: 'movie' | 'tv', tmdbId: number): Promise<string | null> {
  const data = (await tmdbFetch(`/${type}/${tmdbId}/external_ids`)) as { imdb_id?: string } | null
  return data?.imdb_id ?? null
}

async function tmdbGetTitle(type: 'movie' | 'tv', tmdbId: number): Promise<string | null> {
  const data = (await tmdbFetch(`/${type}/${tmdbId}`)) as { title?: string; name?: string } | null
  return data?.title ?? data?.name ?? null
}

function magnetFromHash(infoHash: string, name: string): string {
  const trackers = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://9.rarbg.com:2810/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://tracker.torrent.eu.org:451/announce',
  ]
  const tr = trackers.map((t) => `&tr=${encodeURIComponent(t)}`).join('')
  return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}${tr}`
}

function detectType(filename: string): StreamSource['type'] {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.m3u8') || lower.includes('.m3u8?')) return 'hls'
  if (lower.endsWith('.mkv')) return 'mkv'
  return 'mp4'
}

/**
 * Confirm a resolved filename actually corresponds to the requested title.
 * Rejects pack torrents where RD returned an unrelated movie.
 * Heuristic: at least half the meaningful tokens (≥3 chars) from the title
 * must appear in the filename.
 */
function filenameMatchesTitle(filename: string, title: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  const tokens = norm(title).split(/\s+/).filter((t) => t.length >= 3)
  if (!tokens.length) return true
  const name = norm(filename)
  const hits = tokens.filter((t) => name.includes(t)).length
  return hits / tokens.length >= 0.5
}

// ── Main route ────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = (searchParams.get('type') ?? 'movie') as 'movie' | 'tv'
  const id = Number(searchParams.get('id'))
  const season = Number(searchParams.get('season') ?? 1)
  const episode = Number(searchParams.get('episode') ?? 1)
  // RD token is sent by client (in header to keep it out of URL logs)
  const rdToken = req.headers.get('x-rd-token') || searchParams.get('rd') || ''

  if (!id || isNaN(id)) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  // No RD token = no ad-free stream. Tell client to use iframe fallback.
  if (!rdToken) {
    return NextResponse.json({
      found: false,
      reason: 'no-rd-token',
      message: 'Add a Real-Debrid token in Settings for ad-free playback.',
      sources: [],
      subtitles: [],
    })
  }

  let step = 'init'
  const debug = searchParams.get('debug') === '1'
  try {
    // 1. Get IMDB ID + title (we need title to disambiguate files in pack torrents)
    step = 'tmdb-to-imdb'
    const imdbId = await tmdbToImdb(type, id)
    const tmdbTitle = await tmdbGetTitle(type, id)
    if (!imdbId) {
      return NextResponse.json({
        found: false,
        reason: 'no-imdb',
        message: 'TMDB title has no IMDB mapping.',
        sources: [],
        subtitles: [],
      })
    }

    // 2. Scrape Torrentio for magnets
    step = 'torrentio'
    const streams = type === 'movie'
      ? await Torrentio.searchMovie(imdbId)
      : await Torrentio.searchEpisode(imdbId, season, episode)

    if (!streams.length) {
      return NextResponse.json({
        found: false,
        reason: 'no-torrents',
        message: 'No torrents found for this title.',
        sources: [],
        subtitles: [],
      })
    }

    // 3. Check which are cached on RD (instantAvailability — fast)
    step = 'rd-cache-check'
    const top = streams.slice(0, 30)
    const hashes = top.map((s) => s.infoHash)
    const cache = await RD.instantAvailability(rdToken, hashes).catch(() => ({} as Record<string, unknown>))

    // 4. Filter to cached torrents only (instant playback)
    const cached = top.filter((s) => {
      const entry = (cache as Record<string, unknown>)[s.infoHash.toLowerCase()]
      return !!entry && Object.keys(entry as object).length > 0
    })

    // 5. Try cached torrents, prioritizing ones that resolve to browser-playable MP4.
    // Strategy: try up to 5 candidates; accept the first MP4. If only MKV is available,
    // accept the best MKV (user may have a browser extension that handles it).
    const candidates = cached.length > 0 ? cached.slice(0, 5) : top.slice(0, 3)

    let resolved: RD.RDUnrestricted | null = null
    let used: typeof candidates[number] | null = null
    let mkvFallback: { resolved: RD.RDUnrestricted; used: typeof candidates[number] } | null = null
    let lastErr = ''

    for (const c of candidates) {
      step = `rd-resolve(${c.infoHash.slice(0, 8)})`
      const magnet = magnetFromHash(c.infoHash, c.title.split('\n')[0])
      try {
        const r = await RD.magnetToStream(rdToken, magnet, {
          fileIdx: c.fileIdx,
          titleHint: tmdbTitle ?? undefined,
        })
        if (!r) continue
        // Verify the resolved file actually matches the requested title.
        // Pack torrents can contain unrelated movies; reject those.
        if (tmdbTitle && !filenameMatchesTitle(r.filename, tmdbTitle)) {
          console.warn(`[stream-sources] resolved ${r.filename} ≠ requested ${tmdbTitle}, skipping`)
          continue
        }
        const ext = r.filename.toLowerCase().split('.').pop() ?? ''
        if (['mp4', 'm4v', 'webm', 'm3u8'].includes(ext)) {
          resolved = r
          used = c
          break
        }
        if (!mkvFallback && ext === 'mkv') {
          mkvFallback = { resolved: r, used: c }
        }
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e)
        console.warn(`[stream-sources] resolve failed ${c.infoHash}:`, lastErr)
      }
    }

    // No browser-playable file found — fall back to MKV if we have one
    if (!resolved && mkvFallback) {
      resolved = mkvFallback.resolved
      used = mkvFallback.used
    }

    if (!resolved || !used) {
      return NextResponse.json({
        found: false,
        reason: 'rd-resolve-failed',
        message: `Real-Debrid could not resolve any of ${candidates.length} torrents. ${lastErr}`,
        sources: [],
        subtitles: [],
      })
    }

    // 6. Return direct stream
    const source: StreamSource = {
      url: resolved.download,
      quality: used.quality,
      type: detectType(resolved.filename),
      size: resolved.filesize,
      title: resolved.filename,
    }

    return NextResponse.json({
      found: true,
      provider: 'real-debrid',
      sources: [source],
      subtitles: [] as SubTrack[],
      ...(debug ? { _debug: { imdbId, tmdb: id, candidateTitle: used.title, infoHash: used.infoHash } } : {}),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[stream-sources] FAILED at ${step}:`, msg)
    return NextResponse.json({
      found: false,
      reason: 'error',
      step,
      message: `${step}: ${msg}`,
      sources: [],
      subtitles: [],
    })
  }
}
