import { Suspense } from 'react'
import DashboardHero from '@/components/DashboardHero'
import CategoryNav from '@/components/CategoryNav'
import MediaRow from '@/components/MediaRow'
import {
  getTrending,
  getPopularMovies,
  getTopRatedMovies,
  getNowPlayingMovies,
  getPopularShows,
  getTopRatedShows,
  getOnAirShows,
  getUpcomingMovies,
} from '@/lib/tmdb'

export const dynamic = 'force-dynamic'

async function HomeContent() {
  const [
    trending,
    popularMovies,
    nowPlaying,
    topRatedMovies,
    upcoming,
    popularShows,
    topRatedShows,
    onAirShows,
  ] = await Promise.all([
    getTrending('all', 'week'),
    getPopularMovies(),
    getNowPlayingMovies(),
    getTopRatedMovies(),
    getUpcomingMovies(),
    getPopularShows(),
    getTopRatedShows(),
    getOnAirShows(),
  ])

  const heroItems = trending.results.filter((i) => i.media_type !== 'person')

  return (
    <>
      {/* sticktv-style Dashboard: hero with side info panel + bottom category nav */}
      <DashboardHero items={heroItems} />
      <CategoryNav />

      {/* Content rows below the dashboard for browse-style discovery */}
      <div className="space-y-10 py-10">
        <MediaRow title="🔥 Trending This Week" items={heroItems} />
        <MediaRow title="🎬 Now Playing" items={nowPlaying.results} mediaType="movie" />
        <MediaRow title="⭐ Top Rated Movies" items={topRatedMovies.results} mediaType="movie" />
        <MediaRow title="🎥 Popular Movies" items={popularMovies.results} mediaType="movie" />
        <MediaRow title="📺 On Air Right Now" items={onAirShows.results} mediaType="tv" />
        <MediaRow title="🏆 Top Rated TV Shows" items={topRatedShows.results} mediaType="tv" />
        <MediaRow title="📡 Popular TV Shows" items={popularShows.results} mediaType="tv" />
        <MediaRow title="🚀 Coming Soon" items={upcoming.results} mediaType="movie" />
      </div>
    </>
  )
}

function HomeSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-[70vh] skeleton" />
      <div className="flex gap-3 py-6 px-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-40 h-24 skeleton rounded-2xl flex-shrink-0" />
        ))}
      </div>
      <div className="space-y-10 py-10 px-6">
        {[...Array(3)].map((_, i) => (
          <div key={i}>
            <div className="h-6 w-48 skeleton mb-4 rounded" />
            <div className="flex gap-3">
              {[...Array(6)].map((_, j) => (
                <div key={j} className="w-44 aspect-[2/3] skeleton rounded-xl flex-shrink-0" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  )
}
