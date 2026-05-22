'use client'

import { useState, useEffect } from 'react'
import { Plus, Check } from 'lucide-react'
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '@/lib/storage'

interface Props {
  id: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
  voteAverage: number
  releaseDate?: string
}

export default function WatchlistButton({ id, mediaType, title, posterPath, voteAverage, releaseDate }: Props) {
  const [inList, setInList] = useState(false)

  useEffect(() => {
    setInList(isInWatchlist(id, mediaType))
  }, [id, mediaType])

  function toggle() {
    if (inList) {
      removeFromWatchlist(id, mediaType)
      setInList(false)
    } else {
      addToWatchlist({ id, media_type: mediaType, title, poster_path: posterPath, vote_average: voteAverage, release_date: releaseDate })
      setInList(true)
    }
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all ${
        inList
          ? 'bg-cs-red text-white hover:bg-red-700'
          : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
      }`}
    >
      {inList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
      {inList ? 'In Watchlist' : 'Add to Watchlist'}
    </button>
  )
}
