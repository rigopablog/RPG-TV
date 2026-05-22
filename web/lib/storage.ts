import type { WatchlistItem, ContinueWatchingItem } from '@/types/tmdb'

const WATCHLIST_KEY = 'cs_watchlist'
const CONTINUE_KEY = 'cs_continue'
const FAVORITES_KEY = 'cs_favorites'
const RD_KEY = 'rpg_rd_token'

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
