'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Play, Star, Plus, Check } from 'lucide-react'
import { useState, useCallback } from 'react'
import { imgUrl, getYear } from '@/lib/tmdb'
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '@/lib/storage'
import type { TMDBMovie, TMDBShow, TMDBMediaItem } from '@/types/tmdb'

type MediaItem = TMDBMovie | TMDBShow | TMDBMediaItem

interface Props {
  item: MediaItem
  mediaType?: 'movie' | 'tv'
  size?: 'sm' | 'md' | 'lg'
}

function getTitle(item: MediaItem) {
  return (item as TMDBMovie).title ?? (item as TMDBShow).name ?? 'Unknown'
}

function getDate(item: MediaItem) {
  return (item as TMDBMovie).release_date ?? (item as TMDBShow).first_air_date ?? ''
}

function resolveType(item: MediaItem, mediaType?: 'movie' | 'tv'): 'movie' | 'tv' {
  if (mediaType) return mediaType
  const mt = (item as TMDBMediaItem).media_type
  if (mt === 'movie' || mt === 'tv') return mt
  return (item as TMDBMovie).title ? 'movie' : 'tv'
}

export default function MediaCard({ item, mediaType, size = 'md' }: Props) {
  const type = resolveType(item, mediaType)
  const title = getTitle(item)
  const date = getDate(item)
  const [inList, setInList] = useState(() => isInWatchlist(item.id, type))
  const [hovered, setHovered] = useState(false)

  const toggleWatchlist = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (inList) {
        removeFromWatchlist(item.id, type)
        setInList(false)
      } else {
        addToWatchlist({
          id: item.id,
          media_type: type,
          title,
          poster_path: item.poster_path,
          vote_average: item.vote_average,
          release_date: date,
        })
        setInList(true)
      }
    },
    [inList, item.id, type, title, item.poster_path, item.vote_average, date]
  )

  const sizeClasses = {
    sm: 'w-32 sm:w-36',
    md: 'w-36 sm:w-44',
    lg: 'w-44 sm:w-52',
  }

  const posterUrl = imgUrl(item.poster_path, 'w342')

  return (
    <Link
      href={`/${type}/${item.id}`}
      className="media-card group block flex-shrink-0"
      aria-label={`${title} (${type === 'movie' ? 'movie' : 'TV show'})`}
    >
      <div
        className={`media-card-inner ${sizeClasses[size]} relative rounded-xl overflow-hidden card-glow transition-all duration-300 group-hover:scale-105 group-focus-within:scale-105 group-hover:z-10 group-focus-within:z-10`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Poster */}
        <div className="aspect-[2/3] relative bg-cs-surface">
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={title}
              fill
              sizes="(max-width: 768px) 144px, 176px"
              className="object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cs-surface to-cs-dark">
              <span className="text-3xl">🎬</span>
            </div>
          )}

          {/* Overlay on hover or D-pad focus */}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 group-focus-within:opacity-100 ${
              hovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-cs-red transition-colors shadow-lg">
                <Play className="w-5 h-5 text-black fill-black" />
              </button>
              <button
                onClick={toggleWatchlist}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  inList
                    ? 'bg-cs-red text-white'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                }`}
              >
                {inList ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {inList ? 'Saved' : 'Watchlist'}
              </button>
            </div>
          </div>

          {/* Rating badge */}
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-bold text-white">
              {item.vote_average.toFixed(1)}
            </span>
          </div>

          {/* Type badge */}
          <div className="absolute top-2 right-2">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
              type === 'movie' ? 'bg-cs-red text-white' : 'bg-blue-600 text-white'
            }`}>
              {type === 'movie' ? 'M' : 'TV'}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-2.5 bg-cs-surface">
          <p className="text-sm font-semibold text-white truncate leading-tight">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{getYear(date) || '—'}</p>
        </div>
      </div>
    </Link>
  )
}
