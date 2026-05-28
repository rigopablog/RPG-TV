'use client'

import { useEffect, useState } from 'react'
import { getLang, type AppLang } from './storage'

// ── Translations ──────────────────────────────────────────
// Add new strings to BOTH dictionaries. Keys are dotted for clarity.
type Dict = Record<string, string>

const EN: Dict = {
  // Nav
  'nav.home': 'Home',
  'nav.movies': 'Movies',
  'nav.tvShows': 'TV Shows',
  'nav.watchlist': 'Watchlist',
  'nav.settings': 'Settings',
  'nav.search': 'Search',

  // Hero / cards
  'hero.watchNow': 'Watch Now',
  'hero.moreInfo': 'More Info',
  'card.play': 'Play',
  'card.addWatchlist': 'Add to Watchlist',
  'card.removeWatchlist': 'Remove from Watchlist',

  // Player
  'player.back': 'Back',
  'player.retry': 'Retry',
  'player.episodes': 'Episodes',
  'player.info': 'Info',
  'player.loading': 'Loading…',
  'player.extracting': 'Extracting stream…',
  'player.unavailable': 'Stream unavailable',
  'player.directStream': 'Direct stream — no ads',
  'player.adFree': 'Direct Stream (no ads)',
  'player.embedMode': 'Embed mode',
  'player.tryDirect': 'Try direct stream',
  'player.prev': 'Prev',
  'player.next': 'Next',
  'player.noSources': 'No working sources for this title.',
  'player.season': 'Season',
  'player.episode': 'Episode',

  // Watchlist / continue
  'section.continueWatching': 'Continue Watching',
  'section.myWatchlist': 'My Watchlist',
  'section.trending': 'Trending This Week',
  'section.popularMovies': 'Popular Movies',
  'section.popularShows': 'Popular TV Shows',
  'section.nowPlaying': 'Now Playing',
  'section.topRated': 'Top Rated',

  // Settings
  'settings.title': 'Settings',
  'settings.subtitle': 'Connect Real-Debrid to unlock ad-free, popup-free 4K streaming.',
  'settings.language': 'Language',
  'settings.languageHint': 'Affects movie/show titles, descriptions, posters, and tries to default the player audio to your language.',
  'settings.english': 'English',
  'settings.spanish': 'Español (Latinoamérica)',
  'settings.rdTitle': 'Real-Debrid',
  'settings.rdSubtitle': 'Premium torrent resolver. Required for ad-free playback.',
  'settings.connected': 'Connected',
  'settings.invalidToken': 'Invalid token',
  'settings.account': 'Account',
  'settings.premiumLeft': 'Premium days left',
  'settings.apiToken': 'API Token',
  'settings.tokenPlaceholder': 'Paste your private API token…',
  'settings.save': 'Save',
  'settings.removeToken': 'Remove token',
  'settings.tokenNote': 'Stored locally in your browser. Never sent to RPG TV servers.',

  // Misc
  'common.viewAll': 'View All',
  'common.empty': 'Nothing here yet.',
  'common.loading': 'Loading…',
  'common.search': 'Search movies and shows…',
}

const ES: Dict = {
  // Nav
  'nav.home': 'Inicio',
  'nav.movies': 'Películas',
  'nav.tvShows': 'Series',
  'nav.watchlist': 'Mi Lista',
  'nav.settings': 'Configuración',
  'nav.search': 'Buscar',

  // Hero / cards
  'hero.watchNow': 'Ver Ahora',
  'hero.moreInfo': 'Más Información',
  'card.play': 'Reproducir',
  'card.addWatchlist': 'Agregar a Mi Lista',
  'card.removeWatchlist': 'Quitar de Mi Lista',

  // Player
  'player.back': 'Atrás',
  'player.retry': 'Reintentar',
  'player.episodes': 'Episodios',
  'player.info': 'Información',
  'player.loading': 'Cargando…',
  'player.extracting': 'Extrayendo transmisión…',
  'player.unavailable': 'Transmisión no disponible',
  'player.directStream': 'Transmisión directa — sin anuncios',
  'player.adFree': 'Transmisión Directa (sin anuncios)',
  'player.embedMode': 'Modo embebido',
  'player.tryDirect': 'Probar transmisión directa',
  'player.prev': 'Anterior',
  'player.next': 'Siguiente',
  'player.noSources': 'No hay fuentes disponibles para este título.',
  'player.season': 'Temporada',
  'player.episode': 'Episodio',

  // Watchlist / continue
  'section.continueWatching': 'Continuar Viendo',
  'section.myWatchlist': 'Mi Lista',
  'section.trending': 'Tendencias de la Semana',
  'section.popularMovies': 'Películas Populares',
  'section.popularShows': 'Series Populares',
  'section.nowPlaying': 'En Cartelera',
  'section.topRated': 'Mejor Calificadas',

  // Settings
  'settings.title': 'Configuración',
  'settings.subtitle': 'Conecta Real-Debrid para desbloquear transmisión 4K sin anuncios ni popups.',
  'settings.language': 'Idioma',
  'settings.languageHint': 'Cambia los títulos, descripciones y carteles de películas/series, e intenta poner el audio del reproductor en tu idioma.',
  'settings.english': 'English',
  'settings.spanish': 'Español (Latinoamérica)',
  'settings.rdTitle': 'Real-Debrid',
  'settings.rdSubtitle': 'Resolutor premium de torrents. Necesario para reproducción sin anuncios.',
  'settings.connected': 'Conectado',
  'settings.invalidToken': 'Token inválido',
  'settings.account': 'Cuenta',
  'settings.premiumLeft': 'Días premium restantes',
  'settings.apiToken': 'Token API',
  'settings.tokenPlaceholder': 'Pega tu token privado de API…',
  'settings.save': 'Guardar',
  'settings.removeToken': 'Eliminar token',
  'settings.tokenNote': 'Se guarda solo en tu navegador. Nunca se envía a los servidores de RPG TV.',

  // Misc
  'common.viewAll': 'Ver Todo',
  'common.empty': 'Aún no hay nada aquí.',
  'common.loading': 'Cargando…',
  'common.search': 'Buscar películas y series…',
}

const DICTS: Record<AppLang, Dict> = { en: EN, es: ES }

/**
 * Translate a key. Falls back to the English string, then to the raw key.
 * Use the hook `useT()` in components so they re-render on language change.
 */
export function t(key: string, lang: AppLang = 'en'): string {
  return DICTS[lang]?.[key] ?? EN[key] ?? key
}

/**
 * Hook returning the current language and a translation function.
 * Re-renders the component whenever the language changes (via the
 * 'rpg:lang-changed' custom event dispatched by setLang).
 */
export function useT() {
  const [lang, setLangState] = useState<AppLang>('en')

  useEffect(() => {
    setLangState(getLang())
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<AppLang>).detail
      setLangState(detail ?? getLang())
    }
    window.addEventListener('rpg:lang-changed', onChange)
    window.addEventListener('storage', () => setLangState(getLang()))
    return () => {
      window.removeEventListener('rpg:lang-changed', onChange)
    }
  }, [])

  return {
    lang,
    t: (key: string) => t(key, lang),
  }
}

/**
 * Map AppLang to the TMDB language code used in API requests.
 * TMDB doesn't have es-419, so we use es-MX for Latin American Spanish.
 */
export function tmdbLang(lang: AppLang): string {
  return lang === 'es' ? 'es-MX' : 'en-US'
}

/**
 * Map AppLang to the 'ds_lang' parameter many embed providers accept
 * for default subtitle/dub language.
 */
export function embedLang(lang: AppLang): string {
  return lang === 'es' ? 'es' : 'en'
}
