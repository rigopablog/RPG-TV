'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, RefreshCw, ChevronLeft, ChevronRight,
  Info, Loader2, Wifi, WifiOff, MonitorPlay, LayoutList,
} from 'lucide-react'
import { getMovieDetails, getShowDetails, getSeasonDetails } from '@/lib/tmdb'
import { updateContinueWatching, getRDToken, getLang } from '@/lib/storage'
import { embedLang } from '@/lib/i18n'
import type { TMDBShow, Episode } from '@/types/tmdb'
import VideoPlayer, { type VSource, type VSubtitle } from '@/components/VideoPlayer'

// ── Embed URL builders ──────────────────────────────────────────────────────
// `proxy-*` keys route through our /api/embed-proxy which strips the wrapping
// ad scripts and sandboxes the inner iframe. Empirically this kills popups on
// TV embeds; for movies the ads often fire from inside the inner iframe, so
// proxy doesn't help — use Real-Debrid for those.
function embedUrl(type: string, id: number, s: number, e: number, server: string) {
  // Preferred audio/subtitle language from the user's Settings — passed as ds_lang
  // (vidsrc family) or lang (embed.su / 2embed). Providers fall back to default if
  // they don't support the param.
  const lang = embedLang(getLang())
  const qs = new URLSearchParams({ type, tmdb: String(id), season: String(s), episode: String(e), lang })
  switch (server) {
    case 'proxy-vidsrc':
      qs.set('source', 'vidsrc-me')
      return `/api/embed-proxy?${qs}`
    case 'proxy-embed-su':
      qs.set('source', 'embed-su')
      return `/api/embed-proxy?${qs}`
    case 'vidsrc-xyz':
      return type === 'movie'
        ? `https://vidsrc.xyz/embed/movie?tmdb=${id}&ds_lang=${lang}`
        : `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}&ds_lang=${lang}`
    case 'embed-su':
      return type === 'movie'
        ? `https://embed.su/embed/movie/${id}?lang=${lang}`
        : `https://embed.su/embed/tv/${id}/${s}/${e}?lang=${lang}`
    case '2embed':
      return type === 'movie'
        ? `https://www.2embed.cc/embed/${id}?lang=${lang}`
        : `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}&lang=${lang}`
    default: // vidsrc-to (raw, full ads)
      return type === 'movie'
        ? `https://vidsrc.to/embed/movie/${id}?ds_lang=${lang}`
        : `https://vidsrc.to/embed/tv/${id}/${s}/${e}?ds_lang=${lang}`
  }
}

// Different fallback chain per content type:
//   - TV: proxy first (works, kills popups) → raw embeds as backup
//   - Movies: proxy still helps lightly-protected ones; raw embeds after
const TV_SERVERS = [
  { key: 'proxy-vidsrc',    label: 'Server 1 (ad-free)' },
  { key: 'proxy-embed-su',  label: 'Server 2 (ad-free)' },
  { key: 'vidsrc-to',       label: 'Server 3' },
  { key: 'vidsrc-xyz',      label: 'Server 4' },
]
const MOVIE_SERVERS = [
  { key: 'proxy-vidsrc',    label: 'Server 1 (ad-free)' },
  { key: 'proxy-embed-su',  label: 'Server 2 (ad-free)' },
  { key: 'vidsrc-to',       label: 'Server 3' },
  { key: '2embed',          label: 'Server 4' },
]
function getFallbackServers(type: string) {
  return type === 'tv' ? TV_SERVERS : MOVIE_SERVERS
}
// Backwards-compat: some code still references FALLBACK_SERVERS for the iframe error handler.
const FALLBACK_SERVERS = MOVIE_SERVERS

type Mode = 'videojs' | 'iframe'
type Status = 'loading' | 'ready' | 'error'

// ── Component ─────────────────────────────────────────────────────────────────
export default function PlayerClient({ params }: { params: { type: string; id: string } }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { type, id } = params
  const mediaId = Number(id)

const [season,  setSeason]  = useState(Number(searchParams.get('season')  ?? 1))
  const [episode, setEpisode] = useState(Number(searchParams.get('episode') ?? 1))

  // Media metadata
  const [title,        setTitle]        = useState('')
  const [totalSeasons, setTotalSeasons] = useState(1)
  const [episodes,     setEpisodes]     = useState<Episode[]>([])
  const [showSidebar,  setShowSidebar]  = useState(false)

  // Player state
  const [mode,          setMode]          = useState<Mode>('videojs')
  const [status,        setStatus]        = useState<Status>('loading')
  const [vjsSources,    setVjsSources]    = useState<VSource[]>([])
  const [vjsSubs,       setVjsSubs]       = useState<VSubtitle[]>([])
  const [iframeSrc,     setIframeSrc]     = useState('')
  const [fallbackIdx,   setFallbackIdx]   = useState(0)
  const [statusMsg,     setStatusMsg]     = useState('Extracting stream…')

  const abortRef = useRef<AbortController | null>(null)

  // ── Fetch metadata ────────────────────────────────────────────────────────
  useEffect(() => {
    if (type === 'movie') {
      getMovieDetails(mediaId).then(m => {
        setTitle(m.title)
        updateContinueWatching({ id: mediaId, media_type: 'movie', title: m.title, poster_path: m.poster_path, progress: 0 })
      }).catch(() => {})
    } else {
      getShowDetails(mediaId).then(s => {
        setTitle(s.name)
        setTotalSeasons((s as TMDBShow).number_of_seasons ?? 1)
        updateContinueWatching({ id: mediaId, media_type: 'tv', title: s.name, poster_path: s.poster_path, season, episode, progress: 0 })
      }).catch(() => {})
    }
  }, [mediaId, type, season, episode])

  // ── Fetch episodes for sidebar ────────────────────────────────────────────
  useEffect(() => {
    if (type === 'tv') {
      getSeasonDetails(mediaId, season)
        .then(d => setEpisodes(d.episodes ?? []))
        .catch(() => setEpisodes([]))
    }
  }, [mediaId, type, season])

  // ── Main: smart per-content-type strategy ────────────────────────────────
  // TV shows  → proxy-sandbox iframe FIRST (kills popups, near-instant load).
  //              Real-Debrid only as a backup if user clicks "Try direct stream".
  // Movies    → Real-Debrid direct stream FIRST (truly ad-free), then proxy iframe,
  //              then raw iframes. Movies' ads survive sandboxing; RD bypasses them.
  const loadStream = useCallback(async (s: number, e: number) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const rdToken = getRDToken()

    // For TV: prefer the proxy iframe — it works and resolves instantly.
    if (type === 'tv') {
      fallbackToIframe(0, s, e)
      return
    }

    // For movies without RD token: use proxy iframe.
    if (!rdToken) {
      setStatusMsg('Add Real-Debrid in Settings for true ad-free movies')
      fallbackToIframe(0, s, e)
      return
    }

    // For movies WITH RD token: try the direct-stream pipeline.
    setStatus('loading')
    setMode('videojs')
    setVjsSources([])
    setStatusMsg('Resolving ad-free stream via Real-Debrid…')

    try {
      const qs = new URLSearchParams({ type, id, season: String(s), episode: String(e) })
      const res = await fetch(`/api/stream-sources?${qs}`, {
        signal: abortRef.current.signal,
        headers: { 'x-rd-token': rdToken },
      })
      const data: {
        found: boolean
        sources: VSource[]
        subtitles: VSubtitle[]
        provider?: string
        message?: string
      } = await res.json()

      if (data.found && data.sources.length > 0) {
        setVjsSources(data.sources)
        setVjsSubs(data.subtitles ?? [])
        setMode('videojs')
        setStatus('loading') // <video> will fire loadedmetadata → onReady
        setStatusMsg(`Direct stream — ${data.provider}`)
      } else {
        setStatusMsg(data.message ?? 'RD failed, using sandboxed embed')
        fallbackToIframe(0, s, e)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      fallbackToIframe(0, s, e)
    }
  }, [type, id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fallbackToIframe = useCallback((idx: number, s: number, e: number) => {
    const servers = getFallbackServers(type)
    if (idx >= servers.length) {
      setStatus('error')
      setStatusMsg('No working sources for this title.')
      return
    }
    const server = servers[idx]
    setMode('iframe')
    setFallbackIdx(idx)
    setIframeSrc(embedUrl(type, mediaId, s, e, server.key))
    setStatus('loading')
    setStatusMsg(`Using ${server.label}`)
  }, [type, mediaId])

  // Listen for the proxy's "fallback" postMessage and advance to the next server.
  // The proxy emits this when it can't resolve a working upstream — much faster
  // than client-side HEAD pre-flighting (which doubles latency).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data === 'rpgtv:proxy-failed' || e.data?.type === 'rpgtv:proxy-failed') {
        const next = fallbackIdx + 1
        const servers = getFallbackServers(type)
        if (next < servers.length) {
          fallbackToIframe(next, season, episode)
        } else {
          setStatus('error')
          setStatusMsg('No working sources for this title.')
        }
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [fallbackIdx, type, season, episode, fallbackToIframe])

  // Kick off on mount + episode change
  useEffect(() => {
    loadStream(season, episode)
    return () => abortRef.current?.abort()
  }, [season, episode, loadStream])

  // ── Navigation ────────────────────────────────────────────────────────────
  const prevEp = () => {
    if (episode > 1) setEpisode(e => e - 1)
    else if (season > 1) { setSeason(s => s - 1); setEpisode(1) }
  }
  const nextEp = () => {
    const max = episodes.length || 99
    if (episode < max) setEpisode(e => e + 1)
    else if (season < totalSeasons) { setSeason(s => s + 1); setEpisode(1) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-black min-h-screen flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-cs-dark/90 backdrop-blur-md border-b border-white/5 flex-shrink-0">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="flex-1 text-center px-4 overflow-hidden">
          <h1 className="text-sm font-bold text-white truncate">
            {title || '…'}{type === 'tv' ? ` — S${season}:E${episode}` : ''}
          </h1>
          {/* Mode + status pill */}
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            {status === 'loading' && <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />}
            {status === 'ready'   && <Wifi    className="w-3 h-3 text-green-400" />}
            {status === 'error'   && <WifiOff className="w-3 h-3 text-red-400"   />}
            <span className="text-xs text-gray-500 truncate">
              {mode === 'videojs' && status !== 'error'
                ? '🎬 Direct stream — no ads'
                : mode === 'iframe'
                ? `📺 ${getFallbackServers(type)[fallbackIdx]?.label ?? 'Embed'}`
                : statusMsg}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => loadStream(season, episode)} title="Retry" className="p-2 text-gray-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          {type === 'tv' && (
            <button onClick={() => setShowSidebar(v => !v)} title="Episodes" className="p-2 text-gray-400 hover:text-white transition-colors">
              <LayoutList className="w-4 h-4" />
            </button>
          )}
          <Link href={`/${type}/${mediaId}`} title="Info" className="p-2 text-gray-400 hover:text-white transition-colors">
            <Info className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Player area ── */}
        <div className="flex-1 flex flex-col">
          <div className="relative w-full bg-black" style={{ paddingTop: '56.25%' }}>

            {/* Loading overlay */}
            {status === 'loading' && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black gap-3">
                <div className="w-14 h-14 border-4 border-cs-red border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">{statusMsg}</p>
              </div>
            )}

            {/* Error overlay */}
            {status === 'error' && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black gap-4">
                <WifiOff className="w-12 h-12 text-cs-red" />
                <p className="text-white font-semibold">Stream unavailable</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  <button
                    onClick={() => loadStream(season, episode)}
                    className="flex items-center gap-2 px-5 py-2 bg-cs-red rounded-full text-sm font-bold text-white hover:bg-red-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Retry
                  </button>
                  {getFallbackServers(type).map((sv, i) => (
                    <button
                      key={sv.key}
                      onClick={() => fallbackToIframe(i, season, episode)}
                      className="px-4 py-2 bg-white/10 rounded-full text-sm text-gray-300 hover:bg-white/20 transition-colors"
                    >
                      {sv.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Video.js player ── */}
            {mode === 'videojs' && vjsSources.length > 0 && (
              <div className="absolute inset-0 z-20">
                <VideoPlayer
                  sources={vjsSources}
                  subtitles={vjsSubs}
                  onReady={() => setStatus('ready')}
                  onError={() => {
                    // Video.js failed → try embed fallback
                    fallbackToIframe(0, season, episode)
                  }}
                />
              </div>
            )}

            {/* ── Iframe fallback ── */}
            {mode === 'iframe' && iframeSrc && (
              <iframe
                key={iframeSrc}
                src={iframeSrc}
                data-rpgtv-player="true"
                className="player-iframe z-20"
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                referrerPolicy="origin"
                onLoad={() => setStatus('ready')}
                onError={() => {
                  // Auto-switch to next server
                  const servers = getFallbackServers(type)
                  const next = fallbackIdx + 1
                  if (next < servers.length) {
                    fallbackToIframe(next, season, episode)
                  } else {
                    setStatus('error')
                  }
                }}
              />
            )}
          </div>

          {/* ── Controls ── */}
          <div className="bg-cs-dark border-t border-white/5 px-4 py-3 space-y-3">

            {/* Mode indicator + fallback buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                mode === 'videojs' ? 'bg-green-900/40 text-green-400 border border-green-500/30' : 'bg-cs-surface text-gray-400 border border-white/10'
              }`}>
                <MonitorPlay className="w-3.5 h-3.5" />
                {mode === 'videojs' ? 'Direct Stream (no ads)' : 'Embed mode'}
              </div>

              {mode === 'iframe' && getFallbackServers(type).map((sv, i) => (
                <button
                  key={sv.key}
                  onClick={() => fallbackToIframe(i, season, episode)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    i === fallbackIdx
                      ? 'bg-cs-red text-white'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {sv.label}
                </button>
              ))}

              {mode === 'iframe' && (
                <button
                  onClick={() => loadStream(season, episode)}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-green-900/40 text-green-400 border border-green-500/30 hover:bg-green-900/60 transition-all"
                >
                  Try direct stream
                </button>
              )}
            </div>

            {/* TV episode nav */}
            {type === 'tv' && (
              <div className="flex items-center justify-between">
                <button
                  onClick={prevEp}
                  disabled={episode === 1 && season === 1}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white/10 rounded-full text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="text-sm text-gray-400">S{season} E{episode}</span>
                <button
                  onClick={nextEp}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white/10 rounded-full text-sm font-semibold text-white hover:bg-white/20 transition-all"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── TV sidebar ── */}
        {type === 'tv' && showSidebar && (
          <div className="w-72 bg-cs-dark border-l border-white/5 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h3 className="font-bold text-sm">Season {season} Episodes</h3>
            </div>
            <div className="flex-1 overflow-y-auto hide-scrollbar">
              {episodes.map(ep => (
                <button
                  key={ep.id}
                  onClick={() => setEpisode(ep.episode_number)}
                  className={`w-full text-left p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${
                    ep.episode_number === episode ? 'bg-cs-red/10 border-l-2 border-l-cs-red' : ''
                  }`}
                >
                  <p className="text-xs text-cs-red font-bold mb-0.5">Episode {ep.episode_number}</p>
                  <p className="text-sm font-semibold text-white truncate">{ep.name}</p>
                  {ep.runtime && <p className="text-xs text-gray-500 mt-0.5">{ep.runtime}m</p>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
