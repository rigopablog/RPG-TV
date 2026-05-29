'use client'

import { Radio, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useT } from '@/lib/i18n'

export default function RadioPage() {
  const { t } = useT()
  return (
    <div className="min-h-screen bg-cs-dark text-white flex flex-col items-center justify-center px-4 text-center">
      <Radio className="w-20 h-20 text-cs-red mb-6" />
      <h1 className="text-3xl sm:text-4xl font-black mb-3">{t('nav.radio')}</h1>
      <p className="text-gray-400 max-w-md mb-8">
        Worldwide radio streaming is coming soon. 40,000+ stations from
        RadioBrowser, filterable by language, country, and genre.
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 px-5 py-2.5 bg-cs-red text-white rounded-full font-bold hover:bg-red-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('nav.home')}
      </Link>
    </div>
  )
}
