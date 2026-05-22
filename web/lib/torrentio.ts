/**
 * Torrentio scraper API client.
 * Torrentio is a public Stremio addon that scrapes torrents from public trackers
 * and returns magnet links with quality / size / seeders metadata.
 *
 * Docs: https://torrentio.strem.fun/
 * IDs: it uses IMDB IDs (tt-prefixed), not TMDB.
 */

const TORRENTIO_BASE = 'https://torrentio.strem.fun'

// Provider list — keep enabled trackers minimal for faster responses.
// You can extend this; full list at the Torrentio config page.
const PROVIDERS = 'yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex'
const QUALITY_FILTER = 'sort=qualitysize|qualityfilter=480p,scr,cam'

export interface TorrentioStream {
  name: string          // e.g. "Torrentio\n4k HDR"
  title: string         // human-readable title with size/seeds
  infoHash: string      // 40-char hex hash
  fileIdx?: number      // index of the video file within the torrent (for multi-file torrents)
  size?: number         // bytes
  seeders?: number
  quality: '4k' | '1080p' | '720p' | '480p' | 'other'
  source: string        // tracker name
}

/**
 * Get a config segment that customizes Torrentio results.
 * Including realdebrid={key} unlocks the "cached on RD" filter and
 * gets you streams already known to play instantly.
 */
function buildConfig(opts: { rdKey?: string } = {}): string {
  const parts = [
    PROVIDERS ? `providers=${PROVIDERS}` : '',
    QUALITY_FILTER,
  ]
  if (opts.rdKey) parts.push(`realdebrid=${opts.rdKey}`)
  return parts.filter(Boolean).join('|')
}

function detectQuality(title: string): TorrentioStream['quality'] {
  const t = title.toLowerCase()
  if (t.includes('2160p') || t.includes('4k') || t.includes('uhd')) return '4k'
  if (t.includes('1080p')) return '1080p'
  if (t.includes('720p')) return '720p'
  if (t.includes('480p')) return '480p'
  return 'other'
}

function parseTitle(t: string) {
  // Torrentio packs metadata into the title. Best-effort extraction.
  const sizeMatch = t.match(/💾\s*([\d.]+)\s*(GB|MB)/i)
  const seedMatch = t.match(/👤\s*(\d+)/)
  const sourceMatch = t.match(/⚙️\s*(\S+)/)
  return {
    size: sizeMatch ? Number(sizeMatch[1]) * (sizeMatch[2].toUpperCase() === 'GB' ? 1024 ** 3 : 1024 ** 2) : undefined,
    seeders: seedMatch ? Number(seedMatch[1]) : undefined,
    source: sourceMatch?.[1] ?? '',
  }
}

interface RawStream {
  name: string
  title: string
  infoHash?: string
  fileIdx?: number
  url?: string
}

async function fetchStreams(path: string, opts: { rdKey?: string } = {}): Promise<TorrentioStream[]> {
  const config = buildConfig(opts)
  const url = `${TORRENTIO_BASE}/${config}/stream/${path}.json`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`Torrentio ${res.status}`)
  const data = (await res.json()) as { streams?: RawStream[] }
  if (!data.streams) return []
  return data.streams
    .map((s) => {
      const meta = parseTitle(s.title)
      const quality = detectQuality(s.title)
      return {
        name: s.name,
        title: s.title,
        infoHash: s.infoHash ?? '',
        fileIdx: s.fileIdx,
        quality,
        ...meta,
      } as TorrentioStream
    })
    .filter((s) => !!s.infoHash)
    .sort((a, b) => {
      // Prefer 1080p first — usually H.264 MP4, plays in browser.
      // 4K is often HEVC/MKV which browsers can't decode.
      // Demote known browser-incompatible markers (REMUX, x265, HEVC) within same quality.
      const order = { '1080p': 0, '720p': 1, '4k': 2, '480p': 3, other: 4 }
      const q = order[a.quality] - order[b.quality]
      if (q !== 0) return q
      const aBad = /\b(remux|x265|hevc|h\.265|h265)\b/i.test(a.title) ? 1 : 0
      const bBad = /\b(remux|x265|hevc|h\.265|h265)\b/i.test(b.title) ? 1 : 0
      if (aBad !== bBad) return aBad - bBad
      return (b.seeders ?? 0) - (a.seeders ?? 0)
    })
}

export async function searchMovie(imdbId: string, opts: { rdKey?: string } = {}) {
  return fetchStreams(`movie/${imdbId}`, opts)
}

export async function searchEpisode(
  imdbId: string,
  season: number,
  episode: number,
  opts: { rdKey?: string } = {},
) {
  return fetchStreams(`series/${imdbId}:${season}:${episode}`, opts)
}
