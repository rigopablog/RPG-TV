'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  getFavorites,
  toggleFavorite,
  isFavorite,
  getContinueWatching,
  updateContinueWatching,
} from '@/lib/storage'
import type { WatchlistItem, ContinueWatchingItem } from '@/types/tmdb'

export function useWatchlist(id?: number, mediaType?: 'movie' | 'tv') {
  const [inList, setInList] = useState(false)
  const [inFavorites, setInFavorites] = useState(false)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [favorites, setFavorites] = useState<WatchlistItem[]>([])
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([])

  useEffect(() => {
    if (id && mediaType) {
      setInList(isInWatchlist(id, mediaType))
      setInFavorites(isFavorite(id, mediaType))
    }
    setWatchlist(getWatchlist())
    setFavorites(getFavorites())
    setContinueWatching(getContinueWatching())
  }, [id, mediaType])

  const toggleWatchlist = useCallback(
    (item: Omit<WatchlistItem, 'addedAt'>) => {
      if (inList) {
        removeFromWatchlist(item.id, item.media_type)
        setInList(false)
      } else {
        addToWatchlist(item)
        setInList(true)
      }
      setWatchlist(getWatchlist())
    },
    [inList]
  )

  const toggleFav = useCallback(
    (item: Omit<WatchlistItem, 'addedAt'>) => {
      const added = toggleFavorite(item)
      setInFavorites(added)
      setFavorites(getFavorites())
    },
    []
  )

  const addToContinue = useCallback((item: Omit<ContinueWatchingItem, 'updatedAt'>) => {
    updateContinueWatching(item)
    setContinueWatching(getContinueWatching())
  }, [])

  return {
    inList,
    inFavorites,
    watchlist,
    favorites,
    continueWatching,
    toggleWatchlist,
    toggleFav,
    addToContinue,
  }
}
