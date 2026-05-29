'use client'

/**
 * sticktv-style hero with side info panel.
 *
 * Layout (TV / desktop ≥1024px):
 *   ┌────────────────────────────────────────────────────────┐
 *   │ logo                            [backdrop image]       │
 *   │                                                        │
 *   │   ┌─────────────────┐                                  │
 *   │   │ TYPE            │                                  │
 *   │   │ TITLE           │                                  │
 *   │   │ chip chip chip  │                                  │
 *   │   │ description…    │                                  │
 *   │   │ ⏱ 2h 8m  📅 2024 │                                  │
 *   │   │ [Watch] [+List] │                                  │
 *   │   └─────────────────┘                                  │
 *   └────────────────────────────────────────────────────────┘
 *
 * On phone (<640px) the info panel becomes a full-width bottom card.
 *
 * Auto-rotates through `items` every 8s. Pauses when D-pad / keyboard
 * focus enters the section (handled at hero ref level via focusin/out).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Play, Info, Star, Plus, Check, Clock, Calendar, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { imgUrl, getMediaTitle, getMediaDate, getYear } from '@/lib/tmdb'
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '@/lib/storage'
import { useT } from '@/lib/i18n'
import type { TMDBMediaItem, TMDBMovie, TMDBShow } from '@/types/tmdb'

interface Props {
  items: TMDBMediaItem[]
}

export default function DashboardHero({ items }: Props) {
  const { t } = useT()
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [inList, setInList] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  const featured = items.slice(0, 8)
  const item = featured[idx]

  const next = useCallback(
    () => setIdx((i) => (i + 1) % featured.length),
    [featured.length],
  )
  const prev = useCallback(
    () => setIdx((i) => (i - 1 + featured.length) % featured.length),
    [featured.length],
  )

  // Auto-rotate every 8s unless paused
  useEffect(() => {
    if (paused || featured.length < 2) return
    const t = setInterval(next, 8000)
    return () => clearInterval(t)
  }, [next, paused, featured.length])

  // Pause when D-pad / keyboard focus enters — gives TV users time to read
  useEffect(() => {
    const node = sectionRef.current
    if (!node) return
    const onFocusIn = () => setPaused(true)
    const onFocusOut = (e: FocusEvent) => {
      if (!node.contains(e.relatedTarget as Node | null)) setPaused(false)
    }
    node.addEventListener('focusin', onFocusIn)
    node.addEventListener('focusout', onFocusOut)
    return () => {
      node.removeEventListener('focusin', onFocusIn)
      node.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  // Watchlist state — re-check each time the focused item changes
  useEffect(() => {
    if (!item) return
    const mt = (item.media_type ?? 'movie') as 'movie' | 'tv'
    setInList(isInWatchlist(item.id, mt))
  }, [item])

  if (!item) return null

  const mediaType = (item.media_type ?? 'movie') as 'movie' | 'tv'
  const title = getMediaTitle(item)
  const year = getYear(getMediaDate(item))
  const description = item.overview ?? ''
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null
  const runtime = (item as TMDBMovie).runtime
  const backdrop = imgUrl(item.backdrop_path, 'original') ?? '/placeholder-backdrop.jpg'

  function toggleList() {
    const mt = mediaType
    if (inList) {
      removeFromWatchlist(item.id, mt)
      setInList(false)
    } else {
      addToWatchlist({
        id: item.id,
        media_type: mt,
        title,
        poster_path: item.poster_path,
        vote_average: item.vote_average ?? 0,
      })
      setInList(true)
    }
  }

  return (
    <section
      ref={sectionRef}
      className="relative w-full h-[70vh] min-h-[500px] lg:h-[80vh] overflow-hidden bg-black"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 z-0">
        <Image
          key={item.id}
          src={backdrop}
          alt={title}
          fill
          priority
          sizes="100vw"
          className="object-cover transition-opacity duration-700"
        />
        {/* Gradient overlays — bottom (to nav), left (info panel readability) */}
        <div className="absolute inset-0 bg-gradient-to-t from-cs-dark via-cs-dark/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-cs-dark/95 via-cs-dark/40 to-transparent lg:via-cs-dark/20" />
      </div>

      {/* Info panel — sticktv-style. Left-aligned on lg+, bottom-stacked on mobile. */}
      <div className="
        relative z-10 h-full
        flex flex-col justify-end
        px-4 sm:px-8 lg:px-16
        pb-8 lg:pb-20
      ">
        <div className="
          max-w-md lg:max-w-lg
          bg-black/40 backdrop-blur-md
          border border-white/10
          rounded-2xl p-5 lg:p-6
          space-y-3
        ">
          {/* Type badge */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-cs-red text-white text-xs font-bold rounded uppercase tracking-wider">
              {mediaType === 'movie' ? t('nav.movies') : t('nav.tvShows')}
            </span>
            {rating && (
              <span className="flex items-center gap-1 text-yellow-400 text-sm font-bold">
                <Star className="w-3.5 h-3.5 fill-current" />
                {rating}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight text-white">
            {title}
          </h1>

          {/* Genre chips — placeholder until we fetch genres */}
          {/* TODO: wire to TMDB genre_ids → genre names */}

          {/* Description */}
          {description && (
            <p className="text-sm lg:text-base text-gray-300 line-clamp-3 leading-relaxed">
              {description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-xs lg:text-sm text-gray-400">
            {year && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {year}
              </span>
            )}
            {runtime && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {runtime}m
              </span>
            )}
            {(item as TMDBShow).number_of_seasons && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {(item as TMDBShow).number_of_seasons} {t('player.season').toLowerCase()}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={`/watch/${mediaType}/${item.id}`}
              className="
                flex items-center gap-2 px-5 py-2.5
                bg-white text-black font-bold text-sm rounded-full
                hover:bg-gray-200
                focus:outline-none focus:ring-2 focus:ring-cs-red focus:scale-105
                transition-all
              "
            >
              <Play className="w-4 h-4 fill-current" />
              {t('hero.watchNow')}
            </Link>
            <Link
              href={`/${mediaType}/${item.id}`}
              className="
                flex items-center gap-2 px-5 py-2.5
                bg-white/15 backdrop-blur-md text-white font-bold text-sm rounded-full
                hover:bg-white/25
                focus:outline-none focus:ring-2 focus:ring-cs-red focus:scale-105
                transition-all
              "
            >
              <Info className="w-4 h-4" />
              {t('hero.moreInfo')}
            </Link>
            <button
              onClick={toggleList}
              aria-label={inList ? t('card.removeWatchlist') : t('card.addWatchlist')}
              className="
                flex items-center justify-center w-10 h-10
                bg-white/15 backdrop-blur-md text-white rounded-full
                hover:bg-white/25
                focus:outline-none focus:ring-2 focus:ring-cs-red focus:scale-110
                transition-all
              "
            >
              {inList ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Carousel controls — top-right */}
      {featured.length > 1 && (
        <div className="absolute top-4 right-4 lg:top-8 lg:right-8 z-10 flex gap-2">
          <button
            onClick={prev}
            aria-label="Previous"
            className="
              w-9 h-9 lg:w-10 lg:h-10
              flex items-center justify-center
              bg-black/40 backdrop-blur-md border border-white/10
              text-white rounded-full
              hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-cs-red
              transition-all
            "
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            aria-label="Next"
            className="
              w-9 h-9 lg:w-10 lg:h-10
              flex items-center justify-center
              bg-black/40 backdrop-blur-md border border-white/10
              text-white rounded-full
              hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-cs-red
              transition-all
            "
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Dot indicators */}
      {featured.length > 1 && (
        <div className="absolute bottom-2 lg:bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {featured.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? 'w-8 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
