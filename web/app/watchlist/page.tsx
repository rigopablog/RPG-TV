import { Suspense } from 'react'
import WatchlistClient from './WatchlistClient'

export default function WatchlistPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-cs-red border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <WatchlistClient />
    </Suspense>
  )
}
