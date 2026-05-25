import { Suspense } from 'react'
import MediaRow from '@/components/MediaRow'
import { getPopularShows, getTopRatedShows, getOnAirShows } from '@/lib/tmdb'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TV Shows',
  description: 'Browse thousands of free TV shows — popular series, top rated, and on air right now.',
}

export const dynamic = 'force-dynamic'

async function ShowsContent() {
  const [popular, topRated, onAir] = await Promise.all([
    getPopularShows(),
    getTopRatedShows(),
    getOnAirShows(),
  ])

  return (
    <div className="space-y-10">
      <MediaRow title="📡 Popular TV Shows" items={popular.results} mediaType="tv" />
      <MediaRow title="📺 On Air Right Now" items={onAir.results} mediaType="tv" />
      <MediaRow title="🏆 Top Rated" items={topRated.results} mediaType="tv" />
    </div>
  )
}

export default function ShowsPage() {
  return (
    <div className="pt-24 pb-10">
      <div className="max-w-[1400px] mx-auto">
        <div className="px-6 mb-8">
          <h1 className="text-3xl font-black">TV Shows</h1>
          <p className="text-gray-400 mt-1">Binge-worthy series — completely free</p>
        </div>
        <Suspense fallback={<div className="h-96 flex items-center justify-center text-gray-500">Loading...</div>}>
          <ShowsContent />
        </Suspense>
      </div>
    </div>
  )
}
