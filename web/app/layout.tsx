import type { Metadata } from 'next'
import './globals.css'
import './videojs.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import PopupBlocker from '@/components/PopupBlocker'

export const metadata: Metadata = {
  title: {
    default: 'RPG TV — Free Movie & TV Streaming',
    template: '%s | RPG TV',
  },
  description:
    'Stream 100,000+ movies & TV shows completely FREE. Netflix-style experience in your browser.',
  keywords: [
    'free movies online',
    'watch tv shows free',
    'free streaming',
    'rpg tv',
    'free streaming',
  ],
  themeColor: '#0a0a1a',
  openGraph: {
    type: 'website',
    siteName: 'RPG TV',
    title: 'RPG TV — Free Movie & TV Streaming',
    description: 'Stream 100,000+ movies & TV shows completely FREE.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RPG TV — Free Movie & TV Streaming',
    description: 'Stream 100,000+ movies & TV shows completely FREE.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-cs-dark text-white min-h-screen flex flex-col">
        <PopupBlocker />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
