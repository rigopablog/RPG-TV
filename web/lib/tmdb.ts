import type {
  TMDBMovie,
  TMDBShow,
  TMDBMediaItem,
  TMDBResponse,
  Credits,
  VideosResponse,
  SeasonDetail,
} from '@/types/tmdb'

const BASE_URL = 'https://api.themoviedb.org/3'
export const IMG_BASE = 'https://image.tmdb.org/t/p'

export function imgUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500') {
  if (!path) return null
  return `${IMG_BASE}/${size}${path}`
}

function getHeaders(): Record<string, string> {
  const token = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }
  return { 'Content-Type': 'application/json' }
}

function buildUrl(endpoint: string, params: Record<string, string> = {}) {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  const url = new URL(`${BASE_URL}${endpoint}`)
  if (apiKey && !process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN) {
    url.searchParams.set('api_key', apiKey)
  }
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return url.toString()
}

async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(buildUrl(endpoint, params), {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${endpoint}`)
  return res.json()
}

// ── Trending ──────────────────────────────────────────────
export async function getTrending(mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'week') {
  return fetchTMDB<TMDBResponse<TMDBMediaItem>>(`/trending/${mediaType}/${timeWindow}`)
}

// ── Movies ────────────────────────────────────────────────
export async function getPopularMovies(page = 1) {
  return fetchTMDB<TMDBResponse<TMDBMovie>>('/movie/popular', { page: String(page) })
}

export async function getNowPlayingMovies() {
  return fetchTMDB<TMDBResponse<TMDBMovie>>('/movie/now_playing')
}

export async function getTopRatedMovies() {
  return fetchTMDB<TMDBResponse<TMDBMovie>>('/movie/top_rated')
}

export async function getUpcomingMovies() {
  return fetchTMDB<TMDBResponse<TMDBMovie>>('/movie/upcoming')
}

export async function getMovieDetails(id: number) {
  return fetchTMDB<TMDBMovie>(`/movie/${id}`)
}

export async function getMovieCredits(id: number) {
  return fetchTMDB<Credits>(`/movie/${id}/credits`)
}

export async function getMovieVideos(id: number) {
  return fetchTMDB<VideosResponse>(`/movie/${id}/videos`)
}

export async function getSimilarMovies(id: number) {
  return fetchTMDB<TMDBResponse<TMDBMovie>>(`/movie/${id}/similar`)
}

// ── TV Shows ──────────────────────────────────────────────
export async function getPopularShows(page = 1) {
  return fetchTMDB<TMDBResponse<TMDBShow>>('/tv/popular', { page: String(page) })
}

export async function getTopRatedShows() {
  return fetchTMDB<TMDBResponse<TMDBShow>>('/tv/top_rated')
}

export async function getOnAirShows() {
  return fetchTMDB<TMDBResponse<TMDBShow>>('/tv/on_the_air')
}

export async function getShowDetails(id: number) {
  return fetchTMDB<TMDBShow>(`/tv/${id}`)
}

export async function getShowCredits(id: number) {
  return fetchTMDB<Credits>(`/tv/${id}/credits`)
}

export async function getShowVideos(id: number) {
  return fetchTMDB<VideosResponse>(`/tv/${id}/videos`)
}

export async function getSimilarShows(id: number) {
  return fetchTMDB<TMDBResponse<TMDBShow>>(`/tv/${id}/similar`)
}

export async function getSeasonDetails(showId: number, season: number) {
  return fetchTMDB<SeasonDetail>(`/tv/${showId}/season/${season}`)
}

// ── Search ────────────────────────────────────────────────
export async function searchMulti(query: string, page = 1) {
  return fetchTMDB<TMDBResponse<TMDBMediaItem>>('/search/multi', {
    query,
    page: String(page),
    include_adult: 'false',
  })
}

export async function searchMovies(query: string, page = 1) {
  return fetchTMDB<TMDBResponse<TMDBMovie>>('/search/movie', {
    query,
    page: String(page),
  })
}

export async function searchShows(query: string, page = 1) {
  return fetchTMDB<TMDBResponse<TMDBShow>>('/search/tv', {
    query,
    page: String(page),
  })
}

// ── Genres ────────────────────────────────────────────────
export async function getMovieGenres() {
  return fetchTMDB<{ genres: { id: number; name: string }[] }>('/genre/movie/list')
}

export async function getTVGenres() {
  return fetchTMDB<{ genres: { id: number; name: string }[] }>('/genre/tv/list')
}

// ── Helpers ───────────────────────────────────────────────
export function getMediaTitle(item: TMDBMediaItem | TMDBMovie | TMDBShow) {
  return (item as TMDBMovie).title ?? (item as TMDBShow).name ?? 'Unknown'
}

export function getMediaDate(item: TMDBMediaItem | TMDBMovie | TMDBShow) {
  return (
    (item as TMDBMovie).release_date ??
    (item as TMDBShow).first_air_date ??
    ''
  )
}

export function getYear(date: string) {
  return date ? new Date(date).getFullYear() : ''
}

export function formatRuntime(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function formatRating(rating: number) {
  return Math.round(rating * 10) / 10
}

// VidSrc embed URLs (free streaming)
export function getStreamUrl(type: 'movie' | 'tv', id: number, season?: number, episode?: number) {
  if (type === 'movie') {
    return `https://vidsrc.to/embed/movie/${id}`
  }
  return `https://vidsrc.to/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`
}

export function getAltStreamUrl(type: 'movie' | 'tv', id: number, season?: number, episode?: number) {
  if (type === 'movie') {
    return `https://vidsrc.me/embed/movie?tmdb=${id}`
  }
  return `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season ?? 1}&episode=${episode ?? 1}`
}
