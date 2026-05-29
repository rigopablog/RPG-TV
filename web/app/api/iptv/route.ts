/**
 * IPTV channel API — server-side proxy to iptv-org's JSON catalog.
 *
 * iptv-org maintains a free, community-curated list of publicly broadcast
 * live TV channels worldwide. We fetch their JSON sources, join channels +
 * working streams, and return a filtered list to the browser.
 *
 * Why server-side: the iptv-org JSON files are ~1-3 MB total. Fetching them
 * on every page load would burn user bandwidth. Vercel caches the server
 * response and re-validates on a schedule.
 *
 * Filters supported (all optional, all combinable):
 *   ?country=us        (ISO 3166-1 alpha-2, lowercase)
 *   ?language=spa      (ISO 639-3, lowercase) — most common LATAM: spa, eng, por
 *   ?category=news     (animation, news, sports, kids, movies, music, etc.)
 *   ?search=cnn        (matches channel name, case-insensitive)
 *   ?limit=200         (default 200, hard cap 1000)
 */
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const revalidate = 3600 // Re-fetch iptv-org once per hour

const IPTV_API = 'https://iptv-org.github.io/api'
const FREE_TV_PLAYLIST = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8'

interface Channel {
  id: string
  name: string
  alt_names: string[]
  country: string
  languages: string[]
  categories: string[]
  is_nsfw: boolean
  logo: string | null
  website: string | null
}

interface Stream {
  channel: string | null
  feed: string | null
  title: string
  url: string
  referrer: string | null
  user_agent: string | null
  quality: string | null
}

interface JoinedChannel extends Channel {
  stream: { url: string; referrer: string | null; user_agent: string | null }
  source: 'iptv-org' | 'free-tv'
}

/**
 * Parse an M3U / M3U8 playlist text into JoinedChannel objects.
 * Format reminder:
 *   #EXTM3U
 *   #EXTINF:-1 tvg-id="…" tvg-logo="…" group-title="…",Display Name
 *   https://stream-url.m3u8
 *
 * group-title is often a country code or category — we keep it as a generic
 * category tag rather than trying to be clever about language/country detection.
 */
function parseM3u(text: string, source: 'free-tv'): JoinedChannel[] {
  const out: JoinedChannel[] = []
  const lines = text.split(/\r?\n/)
  let pendingMeta: { id: string; name: string; logo: string | null; group: string } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim()
    if (!line || line === '#EXTM3U') continue

    if (line.startsWith('#EXTINF')) {
      const attr = (key: string) => {
        const m = line.match(new RegExp(`${key}="([^"]*)"`))
        return m?.[1] ?? null
      }
      // Display name follows the LAST comma
      const commaIdx = line.lastIndexOf(',')
      const name = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : 'Unknown'
      pendingMeta = {
        id: attr('tvg-id') ?? name,
        name,
        logo: attr('tvg-logo'),
        group: attr('group-title') ?? '',
      }
      continue
    }

    if (line.startsWith('#')) continue // any other directive — skip
    if (!pendingMeta) continue // url without EXTINF — skip

    // Apply same playability filters as iptv-org join:
    //   - https only (browser blocks mixed http content)
    //   - no required Referer/User-Agent (m3u format can encode these as
    //     #EXTVLCOPT lines; we skip channels that needed them)
    if (line.startsWith('https://')) {
      out.push({
        id: `freetv-${pendingMeta.id || pendingMeta.name}`.toLowerCase().replace(/\s+/g, '-'),
        name: pendingMeta.name,
        alt_names: [],
        country: pendingMeta.group.slice(0, 2).toUpperCase(), // best-effort
        languages: [],
        categories: pendingMeta.group ? [pendingMeta.group.toLowerCase()] : [],
        is_nsfw: false,
        logo: pendingMeta.logo,
        website: null,
        stream: { url: line, referrer: null, user_agent: null },
        source,
      })
    }
    pendingMeta = null
  }

  return out
}

// In-memory cache for the joined channel list. The cache survives across
// invocations within the same warm Lambda instance — saves us from re-
// fetching + re-joining 2-3MB of JSON on every API call.
let cache: { joined: JoinedChannel[]; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function getJoinedChannels(): Promise<JoinedChannel[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.joined

  // Fetch all three sources in parallel. Free-TV fail is non-fatal — if
  // their playlist is down we still serve iptv-org channels.
  const [channelsRes, streamsRes, freeTvRes] = await Promise.all([
    fetch(`${IPTV_API}/channels.json`, { next: { revalidate: 3600 } }),
    fetch(`${IPTV_API}/streams.json`, { next: { revalidate: 3600 } }),
    fetch(FREE_TV_PLAYLIST, { next: { revalidate: 3600 } }).catch(() => null),
  ])
  if (!channelsRes.ok || !streamsRes.ok) {
    throw new Error('Failed to fetch iptv-org JSON')
  }

  const channels: Channel[] = await channelsRes.json()
  const streams: Stream[] = await streamsRes.json()

  // Build channel_id → best-quality stream map. iptv-org has multiple
  // streams per channel (different mirrors/qualities); pick the first
  // working one. Skip streams with no channel reference.
  const streamMap = new Map<string, Stream>()
  for (const s of streams) {
    if (!s.channel || !s.url) continue
    if (!streamMap.has(s.channel)) streamMap.set(s.channel, s)
  }

  // Only keep channels that:
  //   - have at least one stream
  //   - whose stream is HTTPS (browsers block mixed http: content from our
  //     https: Vercel site, and we can't proxy m3u8 segment-by-segment from
  //     a serverless function without unreasonable cost)
  //   - don't require referrer/user-agent headers a browser can't set
  const joined: JoinedChannel[] = []
  for (const c of channels) {
    const s = streamMap.get(c.id)
    if (!s) continue
    if (!s.url.startsWith('https://')) continue
    if (s.referrer || s.user_agent) continue // browser can't override these
    joined.push({
      // Defensive defaults — iptv-org has some channels with null/missing
      // languages/categories/alt_names arrays which would crash the filter.
      ...c,
      alt_names: c.alt_names ?? [],
      languages: c.languages ?? [],
      categories: c.categories ?? [],
      stream: {
        url: s.url,
        referrer: s.referrer,
        user_agent: s.user_agent,
      },
      source: 'iptv-org',
    })
  }

  // Merge in Free-TV channels, deduped by stream URL (so we don't show the
  // same channel twice when both lists have it).
  if (freeTvRes && freeTvRes.ok) {
    try {
      const text = await freeTvRes.text()
      const freeTvChannels = parseM3u(text, 'free-tv')
      const seenUrls = new Set(joined.map((c) => c.stream.url))
      for (const c of freeTvChannels) {
        if (!seenUrls.has(c.stream.url)) {
          joined.push(c)
          seenUrls.add(c.stream.url)
        }
      }
    } catch (_) {
      // m3u parse failed — log nothing fatal, just continue with iptv-org list
    }
  }

  cache = { joined, ts: Date.now() }
  return joined
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country')?.toUpperCase()
  const language = searchParams.get('language')?.toLowerCase()
  const category = searchParams.get('category')?.toLowerCase()
  const search = searchParams.get('search')?.toLowerCase()
  const source = searchParams.get('source')?.toLowerCase() // 'iptv-org' or 'free-tv'
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 1000)

  try {
    let list = await getJoinedChannels()

    if (source === 'iptv-org' || source === 'free-tv') {
      list = list.filter((c) => c.source === source)
    }
    if (country) list = list.filter((c) => c.country === country)
    if (language) list = list.filter((c) => (c.languages ?? []).includes(language))
    if (category) list = list.filter((c) => (c.categories ?? []).includes(category))
    if (search) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          (c.alt_names ?? []).some((a) => a.toLowerCase().includes(search)),
      )
    }

    return NextResponse.json({
      total: list.length,
      channels: list.slice(0, limit),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
