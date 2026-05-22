'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Bookmark, Bell, Menu, X, Play, Film, Tv, Settings } from 'lucide-react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [pathname])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      setSearchOpen(false)
      setQuery('')
    }
  }

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/movies', label: 'Movies' },
    { href: '/shows', label: 'TV Shows' },
    { href: '/watchlist', label: 'Watchlist' },
    { href: '/settings', label: 'Settings' },
  ]

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-cs-dark/95 backdrop-blur-md shadow-lg shadow-black/30' : 'bg-transparent'
      }`}
    >
      <nav className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-cs-red rounded-lg flex items-center justify-center">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-xl font-black tracking-tight">
            RPG<span className="text-cs-red"> TV</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors hover:text-white ${
                pathname === l.href ? 'text-white' : 'text-gray-400'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Search bar (desktop) */}
          <div className="relative hidden md:flex items-center">
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search movies, shows..."
                  className="w-64 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-cs-red transition-all"
                />
                <button
                  type="button"
                  onClick={() => { setSearchOpen(false); setQuery('') }}
                  className="ml-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
          </div>

          <Link
            href="/watchlist"
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
            title="Watchlist"
          >
            <Bookmark className="w-5 h-5" />
          </Link>

          <Link
            href="/settings"
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Link>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-cs-dark/98 backdrop-blur-md border-t border-white/5">
          <div className="px-4 py-4 space-y-1">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 mb-4">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search movies, shows..."
                className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-cs-red"
              />
              <button
                type="submit"
                className="p-2 bg-cs-red rounded-full text-white"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>

            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? 'bg-cs-red/10 text-cs-red'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {l.href === '/movies' && <Film className="w-4 h-4" />}
                {l.href === '/shows' && <Tv className="w-4 h-4" />}
                {l.href === '/watchlist' && <Bookmark className="w-4 h-4" />}
                {l.href === '/settings' && <Settings className="w-4 h-4" />}
                {l.href === '/' && <Play className="w-4 h-4" />}
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
