import Link from 'next/link'
import { Play, Home, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center">
      <div>
        <div className="text-8xl font-black text-cs-red mb-4">404</div>
        <h1 className="text-2xl font-bold text-white mb-3">Page Not Found</h1>
        <p className="text-gray-400 mb-8">The content you're looking for doesn't exist or was removed.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 bg-cs-red rounded-full text-sm font-bold text-white hover:bg-red-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <Link
            href="/search"
            className="flex items-center gap-2 px-6 py-3 bg-cs-surface border border-cs-border rounded-full text-sm font-semibold text-white hover:border-cs-red/40 transition-colors"
          >
            <Search className="w-4 h-4" />
            Search
          </Link>
        </div>
      </div>
    </div>
  )
}
