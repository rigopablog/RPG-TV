import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge' // Faster cold starts on Vercel free tier

interface Server {
  key: string
  label: string
  movieUrl: (id: number) => string
  tvUrl: (id: number, s: number, e: number) => string
}

const SERVERS: Server[] = [
  {
    key: 'embed-su',
    label: 'Server 1',
    movieUrl: (id) => `https://embed.su/embed/movie/${id}`,
    tvUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
  },
  {
    key: 'autoembed',
    label: 'Server 2',
    movieUrl: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    tvUrl: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
  },
  {
    key: 'vidsrc-me',
    label: 'Server 3',
    movieUrl: (id) => `https://vidsrc.me/embed/movie?tmdb=${id}`,
    tvUrl: (id, s, e) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    key: 'vidsrc-to',
    label: 'Server 4',
    movieUrl: (id) => `https://vidsrc.to/embed/movie/${id}`,
    tvUrl: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
]

async function probe(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    return res.ok || res.status === 405 // 405 = HEAD not allowed but server is alive
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'movie'
  const id = Number(searchParams.get('id'))
  const season = Number(searchParams.get('season') ?? 1)
  const episode = Number(searchParams.get('episode') ?? 1)

  if (!id || isNaN(id)) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  // Probe all servers in parallel — pick fastest responding
  const results = await Promise.all(
    SERVERS.map(async (server) => {
      const url =
        type === 'movie'
          ? server.movieUrl(id)
          : server.tvUrl(id, season, episode)
      const alive = await probe(url)
      return { ...server, alive, url }
    })
  )

  const ranked = results.filter((r) => r.alive)
  const fallback = results // if all probes fail, return all anyway

  const ordered = ranked.length ? ranked : fallback

  return NextResponse.json({
    servers: ordered.map((s) => ({
      key: s.key,
      label: s.label,
      url: s.url,
      alive: s.alive,
    })),
    best: ordered[0].key,
  })
}
