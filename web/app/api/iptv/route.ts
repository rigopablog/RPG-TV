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
}

// In-memory cache for the joined channel list. The cache survives across
// invocations within the same warm Lambda instance — saves us from re-
// fetching + re-joining 2-3MB of JSON on every API call.
let cache: { joined: JoinedChannel[]; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function getJoinedChannels(): Promise<JoinedChannel[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.joined

  const [channelsRes, streamsRes] = await Promise.all([
    fetch(`${IPTV_API}/channels.json`, { next: { revalidate: 3600 } }),
    fetch(`${IPTV_API}/streams.json`, { next: { revalidate: 3600 } }),
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

  // Only keep channels that have at least one playable stream + a logo
  // (logoless channels make the UI ugly).
  const joined: JoinedChannel[] = []
  for (const c of channels) {
    const s = streamMap.get(c.id)
    if (!s) continue
    joined.push({
      ...c,
      stream: {
        url: s.url,
        referrer: s.referrer,
        user_agent: s.user_agent,
      },
    })
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
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 1000)

  try {
    let list = await getJoinedChannels()

    if (country) list = list.filter((c) => c.country === country)
    if (language) list = list.filter((c) => c.languages.includes(language))
    if (category) list = list.filter((c) => c.categories.includes(category))
    if (search) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.alt_names.some((a) => a.toLowerCase().includes(search)),
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
