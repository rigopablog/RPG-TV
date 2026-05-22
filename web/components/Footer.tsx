import Link from 'next/link'
import { Play } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-cs-surface border-t border-cs-border mt-20">
      <div className="max-w-[1400px] mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-cs-red rounded-lg flex items-center justify-center">
                <Play className="w-3.5 h-3.5 text-white fill-white" />
              </div>
              <span className="text-lg font-black">
                RPG<span className="text-cs-red"> TV</span>
              </span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              Your free streaming hub. Watch 100,000+ movies and TV shows anytime, anywhere.
            </p>
          </div>

          {/* Browse */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Browse</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/', label: 'Home' },
                { href: '/movies', label: 'Movies' },
                { href: '/shows', label: 'TV Shows' },
                { href: '/search', label: 'Search' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-500 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Library */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Library</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/watchlist', label: 'Watchlist' },
                { href: '/watchlist?tab=favorites', label: 'Favorites' },
                { href: '/watchlist?tab=continue', label: 'Continue Watching' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-500 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Features</h4>
            <ul className="space-y-2.5">
              {['1080p / 4K', '50+ Subtitles', 'Multi-Source', 'Free Forever', 'No Sign-Up'].map((f) => (
                <li key={f}>
                  <span className="text-sm text-gray-500 flex items-center gap-2">
                    <span className="text-cs-red">✓</span> {f}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            © 2026 RPG TV. All rights reserved. Content sourced from TMDB.
          </p>
          <p className="text-xs text-gray-600">
            Movie data provided by{' '}
            <a
              href="https://www.themoviedb.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cs-red hover:underline"
            >
              TMDB
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
