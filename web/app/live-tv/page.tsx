'use client'

/**
 * Live TV page — backed by iptv-org via /api/iptv.
 *
 * Layout: filter bar (language + category + search) → channel grid → inline
 * player overlay when a channel is selected. Click outside to close.
 *
 * iptv-org's channel catalog is HUGE (~10,000+ entries). We do filtering
 * server-side via query params and limit to 200 per request to keep the
 * DOM manageable.
 */

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Search, X, Loader2, Tv2 } from 'lucide-react'
import LiveTVPlayer from '@/components/LiveTVPlayer'
import { useT } from '@/lib/i18n'

interface Channel {
  id: string
  name: string
  country: string
  languages: string[]
  categories: string[]
  logo: string | null
  stream: { url: string; referrer: string | null; user_agent: string | null }
}

// Curated common filters at the top — the full iptv-org list has 100+
// languages and 240+ countries which is overwhelming. These cover the
// vast majority of LATAM + US viewers.
const LANGUAGES = [
  { code: '',    label: 'All' },
  { code: 'spa', label: 'Español' },
  { code: 'eng', label: 'English' },
  { code: 'por', label: 'Português' },
  { code: 'fra', label: 'Français' },
  { code: 'ita', label: 'Italiano' },
  { code: 'deu', label: 'Deutsch' },
]

const CATEGORIES = [
  { code: '',              label: 'All' },
  { code: 'news',          label: 'News' },
  { code: 'sports',        label: 'Sports' },
  { code: 'entertainment', label: 'Entertainment' },
  { code: 'movies',        label: 'Movies' },
  { code: 'series',        label: 'Series' },
  { code: 'kids',          label: 'Kids' },
  { code: 'music',         label: 'Music' },
  { code: 'documentary',   label: 'Documentary' },
  { code: 'religious',     label: 'Religious' },
  { code: 'culture',       label: 'Culture' },
]

export default function LiveTVPage() {
  const { t } = useT()
  const [channels, setChannels] = useState<Channel[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [language, setLanguage] = useState('spa')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')

  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [playerError, setPlayerError] = useState(false)

  // Debounced fetch when filters change
  useEffect(() => {
    setLoading(true)
    setError(null)
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams()
        if (language) qs.set('language', language)
        if (category) qs.set('category', category)
        if (search.trim()) qs.set('search', search.trim())
        qs.set('limit', '200')

        const res = await fetch(`/api/iptv?${qs}`, { signal: ctrl.signal })
        if (!res.ok) throw new Error(`API returned ${res.status}`)
        const data: { total: number; channels: Channel[] } = await res.json()
        setChannels(data.channels)
        setTotal(data.total)
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Failed to load channels')
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [language, category, search])

  function openChannel(ch: Channel) {
    setPlayerError(false)
    setActiveChannel(ch)
  }

  function closePlayer() {
    setActiveChannel(null)
    setPlayerError(false)
  }

  return (
    <div className="min-h-screen bg-cs-dark text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-cs-dark/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Tv2 className="w-6 h-6 text-cs-red" />
          <h1 className="text-xl sm:text-2xl font-black flex-1">
            {t('nav.liveTv')}
          </h1>
          {!loading && (
            <span className="text-xs text-gray-500">
              {total.toLocaleString()} channels
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="max-w-[1400px] mx-auto px-4 pb-4 space-y-3">
          {/* Language chips */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLanguage(l.code)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
                  language === l.code
                    ? 'bg-cs-red text-white border-cs-red'
                    : 'bg-cs-surface text-gray-400 border-white/10 hover:text-white hover:border-white/30'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setCategory(c.code)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                  category === c.code
                    ? 'bg-white/15 text-white border-white/30'
                    : 'bg-transparent text-gray-500 border-white/10 hover:text-white hover:border-white/20'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channels..."
              className="w-full bg-cs-surface border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm focus:border-cs-red focus:outline-none"
            />
          </div>
        </div>
      </header>

      {/* Channel grid */}
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {error && (
          <div className="text-center py-12 text-red-400">
            {error}
          </div>
        )}

        {loading && !channels.length && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-cs-red animate-spin" />
          </div>
        )}

        {!loading && !error && channels.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            No channels match your filters. Try a different language or category.
          </div>
        )}

        {channels.length > 0 && (
          <div
            data-tv-row
            className="grid gap-3 sm:gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            }}
          >
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => openChannel(ch)}
                className="
                  group flex flex-col items-center gap-2 p-3 rounded-2xl
                  bg-cs-surface/60 border border-white/5
                  hover:border-cs-red/50 hover:bg-cs-surface
                  focus:outline-none focus:border-cs-red focus:scale-105 focus:z-10
                  transition-all duration-200
                "
              >
                <div className="w-full aspect-square flex items-center justify-center bg-black/40 rounded-xl overflow-hidden">
                  {ch.logo ? (
                    <Image
                      src={ch.logo}
                      alt={ch.name}
                      width={120}
                      height={120}
                      className="object-contain w-full h-full p-2 group-hover:scale-110 transition-transform"
                      unoptimized
                    />
                  ) : (
                    <Tv2 className="w-10 h-10 text-gray-600" />
                  )}
                </div>
                <span className="text-xs font-bold text-gray-300 group-hover:text-white text-center line-clamp-2 leading-tight">
                  {ch.name}
                </span>
                <span className="text-[10px] text-gray-500 uppercase">
                  {ch.country}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Player overlay */}
      {activeChannel && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closePlayer}
        >
          <div
            className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closePlayer}
              className="absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center bg-black/60 backdrop-blur-md text-white rounded-full hover:bg-black/80 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Channel header */}
            <div className="absolute top-0 left-0 right-16 z-10 p-3 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent">
              {activeChannel.logo && (
                <Image
                  src={activeChannel.logo}
                  alt={activeChannel.name}
                  width={32}
                  height={32}
                  className="rounded object-contain bg-white/10 p-1"
                  unoptimized
                />
              )}
              <div>
                <p className="text-sm font-bold">{activeChannel.name}</p>
                <p className="text-xs text-gray-400 uppercase">
                  {activeChannel.country} · {activeChannel.languages.join(', ')}
                </p>
              </div>
            </div>

            {/* Player */}
            {!playerError ? (
              <LiveTVPlayer
                src={activeChannel.stream.url}
                poster={activeChannel.logo ?? undefined}
                onError={() => setPlayerError(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                <Tv2 className="w-12 h-12" />
                <p className="font-bold">This stream is offline or geo-blocked.</p>
                <p className="text-xs text-gray-500">
                  iptv-org streams come from public broadcasters — uptime varies.
                </p>
                <button
                  onClick={() => setPlayerError(false)}
                  className="mt-2 px-4 py-2 bg-cs-red rounded-full text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
