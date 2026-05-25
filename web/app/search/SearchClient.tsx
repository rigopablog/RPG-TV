'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, X, Film, Tv } from 'lucide-react'
import MediaCard from '@/components/MediaCard'
import { searchMulti } from '@/lib/tmdb'
import type { TMDBMediaItem } from '@/types/tmdb'

type FilterType = 'all' | 'movie' | 'tv'

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)
  const [results, setResults] = useState<TMDBMediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(t)
  }, [query])

  // Update URL
  useEffect(() => {
    if (debouncedQuery) {
      router.replace(`/search?q=${encodeURIComponent(debouncedQuery)}`, { scroll: false })
    }
  }, [debouncedQuery, router])

  // Fetch results
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    searchMulti(debouncedQuery, page)
      .then((data) => {
        const filtered = data.results.filter((r) => r.media_type !== 'person')
        if (page === 1) {
          setResults(filtered)
        } else {
          setResults((prev) => [...prev, ...filtered])
        }
        setTotalPages(data.total_pages)
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [debouncedQuery, page])

  // Reset page when query changes
  useEffect(() => {
    setPage(1)
  }, [debouncedQuery])

  const filtered = filter === 'all' ? results : results.filter((r) => r.media_type === filter)

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 max-w-[1400px] mx-auto">
      {/* Search input */}
      <div className="max-w-2xl mx-auto mb-10">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, TV shows..."
            className="w-full bg-cs-surface border border-cs-border rounded-2xl pl-12 pr-12 py-4 text-white text-base placeholder-gray-500 focus:outline-none focus:border-cs-red transition-colors"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        {results.length > 0 && (
          <div className="flex gap-2 mt-4">
            {([
              { key: 'all', label: 'All', count: results.length },
              { key: 'movie', label: 'Movies', icon: Film, count: results.filter((r) => r.media_type === 'movie').length },
              { key: 'tv', label: 'TV Shows', icon: Tv, count: results.filter((r) => r.media_type === 'tv').length },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  filter === tab.key
                    ? 'bg-cs-red text-white'
                    : 'bg-cs-surface text-gray-400 hover:text-white border border-cs-border'
                }`}
              >
                {'icon' in tab && tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                {tab.label}
                <span className="opacity-70">({tab.count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!debouncedQuery && (
        <div className="text-center py-20">
          <Search className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-500">Search for anything</p>
          <p className="text-gray-600 mt-2">Find movies, TV shows, anime, and more</p>
        </div>
      )}

      {/* Loading */}
      {loading && page === 1 && (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-cs-red border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* No results */}
      {!loading && debouncedQuery && results.length === 0 && (
        <div className="text-center py-20">
          <p className="text-xl font-semibold text-gray-500">No results for "{debouncedQuery}"</p>
          <p className="text-gray-600 mt-2">Try a different search term</p>
        </div>
      )}

      {/* Results grid */}
      {filtered.length > 0 && (
        <>
          <div className="mb-4 text-sm text-gray-500">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for <span className="text-white font-semibold">"{debouncedQuery}"</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map((item) => (
              <div key={`${item.id}-${item.media_type}`} className="flex justify-center">
                <MediaCard item={item} size="md" />
              </div>
            ))}
          </div>

          {/* Load more */}
          {page < totalPages && (
            <div className="text-center mt-10">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="px-8 py-3 bg-cs-surface border border-cs-border rounded-full text-sm font-semibold text-white hover:border-cs-red/50 transition-all disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
