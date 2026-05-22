'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown, Play } from 'lucide-react'
import { getSeasonDetails, imgUrl } from '@/lib/tmdb'
import type { Season, Episode } from '@/types/tmdb'

interface Props {
  showId: number
  seasons: Season[]
}

export default function SeasonSelector({ showId, seasons }: Props) {
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    getSeasonDetails(showId, selectedSeason)
      .then((data) => setEpisodes(data.episodes ?? []))
      .catch(() => setEpisodes([]))
      .finally(() => setLoading(false))
  }, [showId, selectedSeason])

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Episodes</h2>
        {/* Season dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-4 py-2 bg-cs-surface border border-cs-border rounded-xl text-sm font-semibold hover:border-white/20 transition-colors"
          >
            Season {selectedSeason}
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-cs-surface border border-cs-border rounded-xl overflow-hidden z-20 shadow-xl shadow-black/50">
              {seasons.map((s) => (
                <button
                  key={s.season_number}
                  onClick={() => { setSelectedSeason(s.season_number); setOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors ${
                    s.season_number === selectedSeason ? 'text-cs-red font-semibold' : 'text-gray-300'
                  }`}
                >
                  Season {s.season_number}
                  <span className="text-gray-500 ml-2">({s.episode_count} eps)</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 hide-scrollbar">
          {episodes.map((ep) => {
            const stillUrl = imgUrl(ep.still_path, 'w342')
            return (
              <Link
                key={ep.id}
                href={`/watch/tv/${showId}?season=${ep.season_number}&episode=${ep.episode_number}`}
                className="flex items-center gap-4 p-3 rounded-xl bg-cs-surface border border-cs-border hover:border-cs-red/40 hover:bg-cs-red/5 transition-all group"
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-black relative">
                  {stillUrl ? (
                    <Image src={stillUrl} alt={ep.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-cs-dark text-2xl">🎬</div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60">
                    <Play className="w-8 h-8 text-white fill-white" />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-cs-red">E{ep.episode_number}</span>
                    <span className="text-sm font-semibold text-white truncate">{ep.name}</span>
                  </div>
                  {ep.overview && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{ep.overview}</p>
                  )}
                  {ep.runtime && (
                    <p className="text-xs text-gray-600 mt-1">{ep.runtime}m</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
