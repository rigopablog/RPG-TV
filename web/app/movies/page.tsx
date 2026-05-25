import { Suspense } from 'react'
import MediaRow from '@/components/MediaRow'
import { getPopularMovies, getTopRatedMovies, getNowPlayingMovies, getUpcomingMovies } from '@/lib/tmdb'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Movies',
  description: 'Browse thousands of free movies — popular, top rated, now playing, and upcoming.',
}

export const dynamic = 'force-dynamic'

async function MoviesContent() {
  const [popular, topRated, nowPlaying, upcoming] = await Promise.all([
    getPopularMovies(),
    getTopRatedMovies(),
    getNowPlayingMovies(),
    getUpcomingMovies(),
  ])

  return (
    <div className="space-y-10">
      <MediaRow title="🎥 Popular Movies" items={popular.results} mediaType="movie" />
      <MediaRow title="🎬 Now Playing" items={nowPlaying.results} mediaType="movie" />
      <MediaRow title="⭐ Top Rated" items={topRated.results} mediaType="movie" />
      <MediaRow title="🚀 Coming Soon" items={upcoming.results} mediaType="movie" />
    </div>
  )
}

export default function MoviesPage() {
  return (
    <div className="pt-24 pb-10">
      <div className="max-w-[1400px] mx-auto">
        <div className="px-6 mb-8">
          <h1 className="text-3xl font-black">Movies</h1>
          <p className="text-gray-400 mt-1">Thousands of movies — completely free</p>
        </div>
        <Suspense fallback={<div className="h-96 flex items-center justify-center text-gray-500">Loading...</div>}>
          <MoviesContent />
        </Suspense>
      </div>
    </div>
  )
}
