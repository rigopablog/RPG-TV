'use client'

import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import MediaCard from './MediaCard'
import type { TMDBMovie, TMDBShow, TMDBMediaItem } from '@/types/tmdb'

type Item = TMDBMovie | TMDBShow | TMDBMediaItem

interface Props {
  title: string
  items: Item[]
  mediaType?: 'movie' | 'tv'
  size?: 'sm' | 'md' | 'lg'
}

export default function MediaRow({ title, items, mediaType, size = 'md' }: Props) {
  const rowRef = useRef<HTMLDivElement>(null)

  function scroll(dir: 'left' | 'right') {
    if (!rowRef.current) return
    const by = rowRef.current.clientWidth * 0.7
    rowRef.current.scrollBy({ left: dir === 'left' ? -by : by, behavior: 'smooth' })
  }

  if (!items.length) return null

  return (
    <section className="relative group/row">
      <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
        <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-gray-400 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 px-4 sm:px-6"
      >
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            mediaType={mediaType}
            size={size}
          />
        ))}
      </div>
    </section>
  )
}
