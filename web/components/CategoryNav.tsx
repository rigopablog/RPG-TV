'use client'

/**
 * sticktv-style horizontal category nav row.
 *
 * Lives at the bottom of the dashboard. D-pad navigable: arrow-left/right
 * moves focus, Enter activates. Each card has a focus-scale animation
 * (parent body has class "tv-mode" when D-pad navigation is detected, see
 * TVModeDetector).
 *
 * Designed to mirror sticktv's `rv_dashboard` RecyclerView pattern.
 */

import Link from 'next/link'
import { useRef } from 'react'
import {
  Film, Tv, Radio, Tv2, Heart, Search, Settings, Clock,
} from 'lucide-react'
import { useT } from '@/lib/i18n'

interface Category {
  href: string
  labelKey: string
  Icon: React.ComponentType<{ className?: string }>
  badge?: string // optional "Soon" / "New" pill
}

const CATEGORIES: Category[] = [
  { href: '/',          labelKey: 'nav.home',        Icon: Clock },
  { href: '/movies',    labelKey: 'nav.movies',      Icon: Film },
  { href: '/shows',     labelKey: 'nav.tvShows',     Icon: Tv },
  { href: '/live-tv',   labelKey: 'nav.liveTv',      Icon: Tv2 },
  { href: '/radio',     labelKey: 'nav.radio',       Icon: Radio, badge: 'Soon' },
  { href: '/watchlist', labelKey: 'nav.watchlist',   Icon: Heart },
  { href: '/search',    labelKey: 'nav.search',      Icon: Search },
  { href: '/settings',  labelKey: 'nav.settings',    Icon: Settings },
]

export default function CategoryNav() {
  const { t } = useT()
  const scrollerRef = useRef<HTMLDivElement>(null)

  return (
    <nav
      ref={scrollerRef}
      data-tv-row
      className="
        flex gap-3 overflow-x-auto hide-scrollbar
        py-6 px-4 sm:px-8
        snap-x snap-mandatory
        bg-gradient-to-t from-cs-dark via-cs-dark/95 to-transparent
      "
      aria-label="Categories"
    >
      {CATEGORIES.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="
            group relative flex-shrink-0 snap-start
            w-[140px] sm:w-[160px] lg:w-[180px]
            aspect-[16/10]
            flex flex-col items-center justify-center gap-2
            rounded-2xl
            bg-cs-surface/60 hover:bg-cs-surface
            border border-white/5 hover:border-white/20
            focus:outline-none focus:border-cs-red focus:bg-cs-surface
            focus:scale-105 focus:z-10
            transition-all duration-200
            cursor-pointer
            text-gray-300 hover:text-white focus:text-white
          "
        >
          <c.Icon className="w-8 h-8 lg:w-10 lg:h-10" />
          <span className="text-sm lg:text-base font-bold tracking-tight">
            {t(c.labelKey)}
          </span>
          {c.badge && (
            <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-cs-red text-white text-[10px] font-bold rounded-full">
              {c.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}
