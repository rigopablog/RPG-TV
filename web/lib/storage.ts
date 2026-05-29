import type { WatchlistItem, ContinueWatchingItem } from '@/types/tmdb'

const WATCHLIST_KEY = 'cs_watchlist'
const CONTINUE_KEY = 'cs_continue'
const FAVORITES_KEY = 'cs_favorites'
const RD_KEY = 'rpg_rd_token'
const LANG_KEY = 'rpg_lang'

export type AppLang = 'en' | 'es'

function safeParse<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function safeSet(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

// ── Watchlist ──────────────────────────────────────────────
export function getWatchlist(): WatchlistItem[] {
  return safeParse<WatchlistItem[]>(WATCHLIST_KEY, [])
}

export function addToWatchlist(item: Omit<WatchlistItem, 'addedAt'>) {
  const list = getWatchlist()
  const exists = list.find((i) => i.id === item.id && i.media_type === item.media_type)
  if (exists) return
  list.unshift({ ...item, addedAt: Date.now() })
  safeSet(WATCHLIST_KEY, list)
}

export function removeFromWatchlist(id: number, mediaType: 'movie' | 'tv') {
  const list = getWatchlist().filter((i) => !(i.id === id && i.media_type === mediaType))
  safeSet(WATCHLIST_KEY, list)
}

export function isInWatchlist(id: number, mediaType: 'movie' | 'tv') {
  return getWatchlist().some((i) => i.id === id && i.media_type === mediaType)
}

// ── Favorites ─────────────────────────────────────────────
export function getFavorites(): WatchlistItem[] {
  return safeParse<WatchlistItem[]>(FAVORITES_KEY, [])
}

export function toggleFavorite(item: Omit<WatchlistItem, 'addedAt'>) {
  const list = getFavorites()
  const idx = list.findIndex((i) => i.id === item.id && i.media_type === item.media_type)
  if (idx >= 0) {
    list.splice(idx, 1)
  } else {
    list.unshift({ ...item, addedAt: Date.now() })
  }
  safeSet(FAVORITES_KEY, list)
  return idx < 0
}

export function isFavorite(id: number, mediaType: 'movie' | 'tv') {
  return getFavorites().some((i) => i.id === id && i.media_type === mediaType)
}

// ── Continue Watching ──────────────────────────────────────
export function getContinueWatching(): ContinueWatchingItem[] {
  return safeParse<ContinueWatchingItem[]>(CONTINUE_KEY, [])
}

export function updateContinueWatching(item: Omit<ContinueWatchingItem, 'updatedAt'>) {
  const list = getContinueWatching().filter(
    (i) => !(i.id === item.id && i.media_type === item.media_type)
  )
  list.unshift({ ...item, updatedAt: Date.now() })
  safeSet(CONTINUE_KEY, list.slice(0, 20))
}

export function removeContinueWatching(id: number, mediaType: 'movie' | 'tv') {
  const list = getContinueWatching().filter(
    (i) => !(i.id === id && i.media_type === mediaType)
  )
  safeSet(CONTINUE_KEY, list)
}

// ── Real-Debrid ────────────────────────────────────────────
export function getRDToken(): string {
  if (typeof window === 'undefined') return ''
  try { return localStorage.getItem(RD_KEY) ?? '' } catch { return '' }
}
export function setRDToken(token: string) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(RD_KEY, token.trim()) } catch {}
}
export function clearRDToken() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(RD_KEY) } catch {}
}

// ── Language preference ───────────────────────────────────
// 'en' = English (UI + TMDB metadata in en-US, player tries English audio)
// 'es' = Latin American Spanish (UI + TMDB in es-MX, player tries Spanish audio)
export function getLang(): AppLang {
  if (typeof window === 'undefined') return 'en'
  try {
    const v = localStorage.getItem(LANG_KEY)
    return v === 'es' ? 'es' : 'en'
  } catch { return 'en' }
}
export function setLang(lang: AppLang) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LANG_KEY, lang)
    // Mirror to a cookie so server components (TMDB calls) can read it too.
    // 1 year expiry, path=/ so every route sees it.
    document.cookie = `rpg_lang=${lang}; path=/; max-age=31536000; SameSite=Lax`
    // Notify other tabs/components
    window.dispatchEvent(new CustomEvent('rpg:lang-changed', { detail: lang }))
  } catch {}
}

/**
 * Call once on app mount to ensure the cookie matches localStorage.
 * Needed because the cookie is the source of truth for server-rendered
 * TMDB calls, but the language preference lives in localStorage.
 */
export function syncLangCookie() {
  if (typeof window === 'undefined') return
  const lang = getLang()
  try {
    document.cookie = `rpg_lang=${lang}; path=/; max-age=31536000; SameSite=Lax`
  } catch {}
}

// ── Server preference ─────────────────────────────────────────────
// Which numbered slots (Server 1, 2, 3, 4) the player is allowed to try
// per content type. Lets the user isolate bugs (e.g. "only Server 1") or
// stick to ad-free options (e.g. "only Servers 1 and 2").
// Slot indices are 1-based to match what's shown in the UI.
export type ServerSlot = 1 | 2 | 3 | 4
const SERVERS_KEY_MOVIE = 'rpg_servers_movie'
const SERVERS_KEY_TV = 'rpg_servers_tv'
const ALL_SLOTS: ServerSlot[] = [1, 2, 3, 4]

export function getEnabledServers(type: 'movie' | 'tv'): ServerSlot[] {
  if (typeof window === 'undefined') return ALL_SLOTS
  const key = type === 'tv' ? SERVERS_KEY_TV : SERVERS_KEY_MOVIE
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return ALL_SLOTS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return ALL_SLOTS
    const filtered = parsed.filter(
      (n): n is ServerSlot => n === 1 || n === 2 || n === 3 || n === 4,
    )
    return filtered.length > 0 ? filtered : ALL_SLOTS
  } catch {
    return ALL_SLOTS
  }
}

export function setEnabledServers(type: 'movie' | 'tv', slots: ServerSlot[]) {
  if (typeof window === 'undefined') return
  const key = type === 'tv' ? SERVERS_KEY_TV : SERVERS_KEY_MOVIE
  try {
    // Always keep at least one server enabled — guards against the user
    // saving an empty set and getting permanently stuck on the error page.
    const safe = slots.length > 0 ? slots : ALL_SLOTS
    localStorage.setItem(key, JSON.stringify(safe))
  } catch {}
}
