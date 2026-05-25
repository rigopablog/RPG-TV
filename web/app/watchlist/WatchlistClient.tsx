'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Bookmark, Heart, Play, Star, Trash2, Clock } from 'lucide-react'
import {
  getWatchlist,
  getFavorites,
  getContinueWatching,
  removeFromWatchlist,
  toggleFavorite,
  removeContinueWatching,
} from '@/lib/storage'
import { imgUrl, getYear } from '@/lib/tmdb'
import type { WatchlistItem, ContinueWatchingItem } from '@/types/tmdb'

type Tab = 'watchlist' | 'favorites' | 'continue'

function MediaItemCard({
  item,
  onRemove,
  type,
}: {
  item: WatchlistItem
  onRemove: () => void
  type: 'watchlist' | 'favorites'
}) {
  const posterUrl = imgUrl(item.poster_path, 'w342')
  return (
    <div className="group relative bg-cs-surface rounded-xl overflow-hidden border border-cs-border hover:border-cs-red/30 transition-all card-glow">
      <Link href={`/${item.media_type}/${item.id}`}>
        <div className="aspect-[2/3] relative bg-cs-dark">
          {posterUrl ? (
            <Image src={posterUrl} alt={item.title} fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl">🎬</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <Link
              href={`/watch/${item.media_type}/${item.id}`}
              className="flex items-center gap-1.5 px-4 py-2 bg-cs-red rounded-full text-xs font-bold text-white w-full justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Watch
            </Link>
          </div>
        </div>
      </Link>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link href={`/${item.media_type}/${item.id}`}>
              <p className="text-sm font-semibold text-white truncate hover:text-cs-red transition-colors">
                {item.title}
              </p>
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">{getYear(item.release_date || '') || '—'}</span>
              <div className="flex items-center gap-0.5">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-xs text-gray-400">{item.vote_average.toFixed(1)}</span>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                item.media_type === 'movie' ? 'bg-cs-red/20 text-cs-red' : 'bg-blue-600/20 text-blue-400'
              }`}>
                {item.media_type === 'movie' ? 'M' : 'TV'}
              </span>
            </div>
          </div>
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-600 hover:text-cs-red transition-colors flex-shrink-0"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ContinueCard({
  item,
  onRemove,
}: {
  item: ContinueWatchingItem
  onRemove: () => void
}) {
  const posterUrl = imgUrl(item.poster_path, 'w342')
  const href = item.media_type === 'movie'
    ? `/watch/movie/${item.id}`
    : `/watch/tv/${item.id}?season=${item.season ?? 1}&episode=${item.episode ?? 1}`

  return (
    <div className="group relative bg-cs-surface rounded-xl overflow-hidden border border-cs-border hover:border-cs-red/30 transition-all card-glow">
      <Link href={href}>
        <div className="aspect-video relative bg-cs-dark">
          {posterUrl ? (
            <Image src={posterUrl} alt={item.title} fill className="object-cover object-top" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl">🎬</div>
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
              <Play className="w-6 h-6 text-black fill-black" />
            </div>
          </div>
          {/* Progress bar placeholder */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-cs-red" style={{ width: '30%' }} />
          </div>
        </div>
      </Link>
      <div className="p-3 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{item.title}</p>
          {item.media_type === 'tv' && (
            <p className="text-xs text-gray-500 mt-0.5">S{item.season} E{item.episode}</p>
          )}
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-gray-600 hover:text-cs-red transition-colors flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function WatchlistPage() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null

  const [activeTab, setActiveTab] = useState<Tab>(tabParam ?? 'watchlist')
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [favorites, setFavorites] = useState<WatchlistItem[]>([])
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([])

  useEffect(() => {
    setWatchlist(getWatchlist())
    setFavorites(getFavorites())
    setContinueWatching(getContinueWatching())
  }, [])

  function removeFromWL(id: number, mt: 'movie' | 'tv') {
    removeFromWatchlist(id, mt)
    setWatchlist(getWatchlist())
  }

  function removeFav(id: number, mt: 'movie' | 'tv', title: string, posterPath: string | null, voteAverage: number) {
    toggleFavorite({ id, media_type: mt, title, poster_path: posterPath, vote_average: voteAverage })
    setFavorites(getFavorites())
  }

  function removeContinue(id: number, mt: 'movie' | 'tv') {
    removeContinueWatching(id, mt)
    setContinueWatching(getContinueWatching())
  }

  const tabs: { key: Tab; label: string; icon: typeof Bookmark; count: number }[] = [
    { key: 'watchlist', label: 'Watchlist', icon: Bookmark, count: watchlist.length },
    { key: 'favorites', label: 'Favorites', icon: Heart, count: favorites.length },
    { key: 'continue', label: 'Continue Watching', icon: Clock, count: continueWatching.length },
  ]

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6 max-w-[1400px] mx-auto">
      <h1 className="text-3xl font-black mb-2">My Library</h1>
      <p className="text-gray-400 mb-8">Your saved movies and shows</p>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap mb-8 border-b border-cs-border pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-cs-red text-white shadow-lg shadow-red-900/30'
                : 'bg-cs-surface text-gray-400 hover:text-white border border-cs-border'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-white/20' : 'bg-white/10'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Watchlist */}
      {activeTab === 'watchlist' && (
        watchlist.length === 0 ? (
          <EmptyState icon={Bookmark} title="Your watchlist is empty" desc="Add movies and shows to watch later" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {watchlist.map((item) => (
              <MediaItemCard
                key={`${item.id}-${item.media_type}`}
                item={item}
                type="watchlist"
                onRemove={() => removeFromWL(item.id, item.media_type)}
              />
            ))}
          </div>
        )
      )}

      {/* Favorites */}
      {activeTab === 'favorites' && (
        favorites.length === 0 ? (
          <EmptyState icon={Heart} title="No favorites yet" desc="Heart movies and shows you love" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {favorites.map((item) => (
              <MediaItemCard
                key={`${item.id}-${item.media_type}`}
                item={item}
                type="favorites"
                onRemove={() => removeFav(item.id, item.media_type, item.title, item.poster_path, item.vote_average)}
              />
            ))}
          </div>
        )
      )}

      {/* Continue Watching */}
      {activeTab === 'continue' && (
        continueWatching.length === 0 ? (
          <EmptyState icon={Clock} title="Nothing to continue" desc="Start watching movies or shows to resume here" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {continueWatching.map((item) => (
              <ContinueCard
                key={`${item.id}-${item.media_type}`}
                item={item}
                onRemove={() => removeContinue(item.id, item.media_type)}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Bookmark
  title: string
  desc: string
}) {
  return (
    <div className="text-center py-24">
      <Icon className="w-16 h-16 text-gray-700 mx-auto mb-4" />
      <p className="text-xl font-semibold text-gray-500">{title}</p>
      <p className="text-gray-600 mt-2">{desc}</p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-cs-red rounded-full text-sm font-bold text-white hover:bg-red-700 transition-colors"
      >
        Browse Content
      </Link>
    </div>
  )
}
