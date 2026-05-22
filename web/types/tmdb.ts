export interface TMDBMovie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  genre_ids?: number[]
  genres?: Genre[]
  runtime?: number
  status?: string
  tagline?: string
  imdb_id?: string
  production_companies?: ProductionCompany[]
  spoken_languages?: SpokenLanguage[]
  budget?: number
  revenue?: number
}

export interface TMDBShow {
  id: number
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  vote_count: number
  genre_ids?: number[]
  genres?: Genre[]
  number_of_seasons?: number
  number_of_episodes?: number
  status?: string
  tagline?: string
  episode_run_time?: number[]
  networks?: Network[]
  seasons?: Season[]
  in_production?: boolean
}

export interface TMDBMediaItem {
  id: number
  media_type: 'movie' | 'tv' | 'person'
  title?: string
  name?: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string
  first_air_date?: string
  vote_average: number
  vote_count: number
  genre_ids?: number[]
}

export interface Genre {
  id: number
  name: string
}

export interface ProductionCompany {
  id: number
  name: string
  logo_path: string | null
}

export interface SpokenLanguage {
  iso_639_1: string
  english_name: string
  name: string
}

export interface Network {
  id: number
  name: string
  logo_path: string | null
}

export interface Season {
  id: number
  name: string
  season_number: number
  episode_count: number
  air_date: string | null
  poster_path: string | null
  overview: string
}

export interface Episode {
  id: number
  name: string
  overview: string
  episode_number: number
  season_number: number
  air_date: string | null
  still_path: string | null
  vote_average: number
  runtime: number | null
}

export interface SeasonDetail {
  id: number
  name: string
  season_number: number
  episodes: Episode[]
  air_date: string | null
  poster_path: string | null
  overview: string
}

export interface Cast {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

export interface Credits {
  cast: Cast[]
  crew: {
    id: number
    name: string
    job: string
    department: string
    profile_path: string | null
  }[]
}

export interface Video {
  id: string
  key: string
  name: string
  site: string
  type: string
  official: boolean
}

export interface VideosResponse {
  results: Video[]
}

export interface TMDBResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export interface WatchlistItem {
  id: number
  media_type: 'movie' | 'tv'
  title: string
  poster_path: string | null
  vote_average: number
  release_date?: string
  addedAt: number
}

export interface ContinueWatchingItem {
  id: number
  media_type: 'movie' | 'tv'
  title: string
  poster_path: string | null
  season?: number
  episode?: number
  progress: number
  updatedAt: number
}
