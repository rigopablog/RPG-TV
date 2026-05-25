'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Play, Info, Star, Plus, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { imgUrl, getMediaTitle, getMediaDate, getYear } from '@/lib/tmdb'
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '@/lib/storage'
import type { TMDBMediaItem } from '@/types/tmdb'

interface Props {
  items: TMDBMediaItem[]
}

export default function Hero({ items }: Props) {
  const [idx, setIdx] = useState(0)
  const featured = items.slice(0, 8)
  const item = featured[idx]

  const next = useCallback(() => setIdx((i) => (i + 1) % featured.length), [featured.length])
  const prev = useCallback(() => setIdx((i) => (i - 1 + featured.length) % featured.length), [featured.length])

  const sectionRef = useRef<HTMLElement>(null)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const t = setInterval(next, 8000)
    return () => clearInterval(t)
  }, [next, paused])

  // Pause auto-rotate when keyboard / D-pad focus enters the hero — gives
  // TV users time to read the description before it advances.
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

  const [inList, setInList] = useState(false)
  useEffect(() => {
    if (item) {
      const type = item.media_type === 'tv' ? 'tv' : 'movie'
      setInList(isInWatchlist(item.id, type))
    }
  }, [item])

  if (!item) return null

  const type = item.media_type === 'tv' ? 'tv' : 'movie'
  const title = getMediaTitle(item)
  const date = getMediaDate(item)
  const backdropUrl = imgUrl(item.backdrop_path, 'original')

  function toggleList() {
    const mediaType = type
    if (inList) {
      removeFromWatchlist(item.id, mediaType)
      setInList(false)
    } else {
      addToWatchlist({
        id: item.id,
        media_type: mediaType,
        title,
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        release_date: date,
      })
      setInList(true)
    }
  }

  return (
    <section
      ref={sectionRef}
      className="relative h-[75vh] min-h-[500px] max-h-[800px] overflow-hidden"
    >
      {/* Backdrop */}
      <div className="absolute inset-0">
        {backdropUrl && (
          <Image
            src={backdropUrl}
            alt={title}
            fill
            priority
            sizes="100vw"
            className="object-cover object-top transition-opacity duration-700"
            key={item.id}
          />
        )}
        <div className="hero-gradient absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-cs-dark" />
      </div>

      {/* Content */}
      <div className="relative h-full flex items-center">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 w-full">
          <div className="max-w-2xl fade-in" key={item.id}>
            {/* Tags */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-widest ${
                type === 'movie' ? 'bg-cs-red text-white' : 'bg-blue-600 text-white'
              }`}>
                {type === 'movie' ? 'Movie' : 'TV Show'}
              </span>
              <div className="flex items-center gap-1.5 text-yellow-400">
                <Star className="w-4 h-4 fill-yellow-400" />
                <span className="text-sm font-bold text-white">{item.vote_average.toFixed(1)}</span>
              </div>
              {date && (
                <span className="text-sm text-gray-400">{getYear(date)}</span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight mb-4 drop-shadow-2xl">
              {title}
            </h1>

            {/* Overview */}
            <p className="text-base sm:text-lg text-gray-300 line-clamp-3 leading-relaxed mb-8 max-w-lg">
              {item.overview || 'No description available.'}
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/watch/${type}/${item.id}`}
                className="flex items-center gap-2 px-8 py-3.5 bg-white text-black rounded-full font-bold text-base hover:bg-gray-100 transition-all shadow-lg hover:shadow-white/20 hover:scale-105"
              >
                <Play className="w-5 h-5 fill-black" />
                Watch Now
              </Link>
              <Link
                href={`/${type}/${item.id}`}
                className="flex items-center gap-2 px-6 py-3.5 bg-white/15 text-white rounded-full font-semibold text-base hover:bg-white/25 transition-all backdrop-blur-sm border border-white/20"
              >
                <Info className="w-5 h-5" />
                More Info
              </Link>
              <button
                onClick={toggleList}
                className={`flex items-center gap-2 px-5 py-3.5 rounded-full font-semibold text-sm transition-all ${
                  inList
                    ? 'bg-cs-red text-white'
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20'
                }`}
              >
                {inList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {inList ? 'Saved' : 'Watchlist'}
              </button>
            </div>
          </div>
        </div>

        {/* Carousel controls */}
        <button
          onClick={prev}
          aria-label="Previous featured title"
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 focus-visible:bg-black/70 text-white transition-all backdrop-blur-sm"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={next}
          aria-label="Next featured title"
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 focus-visible:bg-black/70 text-white transition-all backdrop-blur-sm"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {featured.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Go to slide ${i + 1} of ${featured.length}`}
            aria-current={i === idx ? 'true' : undefined}
            className={`rounded-full transition-all ${
              i === idx ? 'w-6 h-2 bg-cs-red' : 'w-2 h-2 bg-white/40 hover:bg-white/70 focus-visible:bg-white/70'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
