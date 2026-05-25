import { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Play, Star, Clock, Calendar, Heart, Plus, ExternalLink } from 'lucide-react'
import {
  getMovieDetails,
  getMovieCredits,
  getMovieVideos,
  getSimilarMovies,
  imgUrl,
  getYear,
  formatRuntime,
  formatRating,
} from '@/lib/tmdb'
import MediaRow from '@/components/MediaRow'
import WatchlistButton from '@/components/WatchlistButton'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const movie = await getMovieDetails(Number(params.id))
    return {
      title: movie.title,
      description: movie.overview?.slice(0, 160),
      openGraph: {
        title: movie.title,
        description: movie.overview?.slice(0, 160),
        images: imgUrl(movie.poster_path, 'w500') ? [imgUrl(movie.poster_path, 'w500')!] : [],
      },
    }
  } catch {
    return { title: 'Movie' }
  }
}

async function MovieContent({ id }: { id: number }) {
  const [movie, credits, videos, similar] = await Promise.all([
    getMovieDetails(id),
    getMovieCredits(id),
    getMovieVideos(id),
    getSimilarMovies(id),
  ])

  const trailer = videos.results.find((v) => v.type === 'Trailer' && v.site === 'YouTube')
  const director = credits.crew.find((c) => c.job === 'Director')
  const cast = credits.cast.slice(0, 10)
  const backdropUrl = imgUrl(movie.backdrop_path, 'w780')
  const posterUrl = imgUrl(movie.poster_path, 'w342')

  return (
    <div>
      {/* Hero backdrop */}
      <div className="relative h-64 sm:h-96 overflow-hidden">
        {backdropUrl ? (
          <Image src={backdropUrl} alt={movie.title} fill className="object-cover object-top" priority />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-cs-dark" />
        <div className="absolute inset-0 bg-gradient-to-r from-cs-dark/70 to-transparent" />
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 -mt-32 relative z-10">
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Poster */}
          <div className="flex-shrink-0 w-40 sm:w-52 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            {posterUrl ? (
              <Image src={posterUrl} alt={movie.title} width={208} height={312} className="w-full h-auto" />
            ) : (
              <div className="w-full aspect-[2/3] bg-cs-surface flex items-center justify-center text-4xl">🎬</div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pt-32 sm:pt-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="badge bg-cs-red/20 text-cs-red border border-cs-red/30">Movie</span>
              {movie.status && (
                <span className="badge bg-white/10 text-gray-300">{movie.status}</span>
              )}
              {movie.genres?.map((g) => (
                <span key={g.id} className="badge bg-white/5 text-gray-400 border border-white/10">{g.name}</span>
              ))}
            </div>

            <h1 className="text-3xl sm:text-4xl font-black mb-2">{movie.title}</h1>
            {movie.tagline && (
              <p className="text-gray-400 italic mb-4">"{movie.tagline}"</p>
            )}

            <div className="flex flex-wrap items-center gap-4 mb-5 text-sm text-gray-400">
              <span className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="font-bold text-white">{formatRating(movie.vote_average)}</span>
                <span className="text-gray-500">/ 10</span>
              </span>
              {movie.runtime && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {formatRuntime(movie.runtime)}
                </span>
              )}
              {movie.release_date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {new Date(movie.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              )}
              {director && (
                <span className="text-gray-400">Dir. <span className="text-white">{director.name}</span></span>
              )}
            </div>

            <p className="text-gray-300 leading-relaxed mb-6 max-w-2xl">{movie.overview}</p>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mb-8">
              <Link
                href={`/watch/movie/${movie.id}`}
                className="flex items-center gap-2 px-8 py-3 bg-cs-red rounded-full font-bold text-white hover:bg-red-700 transition-all hover:scale-105 shadow-lg shadow-red-900/30"
              >
                <Play className="w-5 h-5 fill-white" />
                Watch Now
              </Link>
              {trailer && (
                <a
                  href={`https://www.youtube.com/watch?v=${trailer.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 rounded-full font-semibold text-white hover:bg-white/20 transition-all border border-white/10"
                >
                  <ExternalLink className="w-4 h-4" />
                  Trailer
                </a>
              )}
              <WatchlistButton
                id={movie.id}
                mediaType="movie"
                title={movie.title}
                posterPath={movie.poster_path}
                voteAverage={movie.vote_average}
                releaseDate={movie.release_date}
              />
            </div>
          </div>
        </div>

        {/* Cast */}
        {cast.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold mb-4">Cast</h2>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
              {cast.map((actor) => {
                const profileUrl = imgUrl(actor.profile_path, 'w185')
                return (
                  <div key={actor.id} className="flex-shrink-0 w-24 text-center">
                    <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-2 bg-cs-surface ring-2 ring-white/10">
                      {profileUrl ? (
                        <Image src={profileUrl} alt={actor.name} width={80} height={80} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-white truncate">{actor.name}</p>
                    <p className="text-xs text-gray-500 truncate">{actor.character}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Details grid */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Release Year', value: getYear(movie.release_date || '') || '—' },
            { label: 'Runtime', value: movie.runtime ? formatRuntime(movie.runtime) : '—' },
            { label: 'Rating', value: `${formatRating(movie.vote_average)} / 10` },
            { label: 'Votes', value: movie.vote_count?.toLocaleString() ?? '—' },
          ].map((d) => (
            <div key={d.label} className="bg-cs-surface rounded-xl p-4 border border-cs-border">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{d.label}</p>
              <p className="font-bold text-white">{d.value}</p>
            </div>
          ))}
        </div>

        {/* Similar */}
        {similar.results.length > 0 && (
          <div className="mt-12 -mx-4 sm:-mx-6">
            <MediaRow title="Similar Movies" items={similar.results} mediaType="movie" />
          </div>
        )}
      </div>
    </div>
  )
}

export default async function MoviePage({ params }: Props) {
  const id = Number(params.id)
  if (isNaN(id)) notFound()

  return (
    <div className="pt-16 pb-16">
      <Suspense fallback={
        <div className="h-screen flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-cs-red border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <MovieContent id={id} />
      </Suspense>
    </div>
  )
}
