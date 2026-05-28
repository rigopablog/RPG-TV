'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ExternalLink, Eye, EyeOff, Globe, Loader2, Trash2 } from 'lucide-react'
import { getRDToken, setRDToken, clearRDToken, getLang, setLang, type AppLang } from '@/lib/storage'
import { useT } from '@/lib/i18n'

type Status = 'idle' | 'saving' | 'saved' | 'invalid' | 'error'

export default function SettingsPage() {
  const { t } = useT()
  const [token, setToken] = useState('')
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [username, setUsername] = useState<string | null>(null)
  const [premiumLeft, setPremiumLeft] = useState<number | null>(null)
  const [lang, setLangLocal] = useState<AppLang>('en')

  useEffect(() => {
    setLangLocal(getLang())
    const stored = getRDToken()
    if (stored) {
      setToken(stored)
      void validate(stored)
    }
  }, [])

  async function validate(t: string) {
    setStatus('saving')
    try {
      const res = await fetch('https://api.real-debrid.com/rest/1.0/user', {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!res.ok) {
        setStatus('invalid')
        return
      }
      const data = await res.json() as { username: string; premium: number; expiration: string }
      setUsername(data.username)
      setPremiumLeft(data.premium)
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  async function handleSave() {
    if (!token.trim()) return
    setRDToken(token.trim())
    await validate(token.trim())
  }

  function handleClear() {
    clearRDToken()
    setToken('')
    setUsername(null)
    setPremiumLeft(null)
    setStatus('idle')
  }

  function handleLangChange(newLang: AppLang) {
    setLang(newLang)
    setLangLocal(newLang)
    // Force a hard reload so server-rendered TMDB content picks up the new
    // cookie immediately. Soft refresh would keep cached server responses.
    setTimeout(() => window.location.reload(), 100)
  }

  return (
    <div className="min-h-screen bg-cs-dark text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-extrabold mb-2">{t('settings.title')}</h1>
        <p className="text-gray-400 mb-10">
          {t('settings.subtitle')}
        </p>

        {/* Language card */}
        <div className="bg-cs-surface border border-white/5 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-cs-red" />
            <div>
              <h2 className="text-xl font-bold">{t('settings.language')}</h2>
              <p className="text-sm text-gray-400">{t('settings.languageHint')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleLangChange('en')}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold border transition-all ${
                lang === 'en'
                  ? 'bg-cs-red text-white border-cs-red'
                  : 'bg-black/30 text-gray-300 border-white/10 hover:border-white/30'
              }`}
            >
              {t('settings.english')}
            </button>
            <button
              onClick={() => handleLangChange('es')}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold border transition-all ${
                lang === 'es'
                  ? 'bg-cs-red text-white border-cs-red'
                  : 'bg-black/30 text-gray-300 border-white/10 hover:border-white/30'
              }`}
            >
              {t('settings.spanish')}
            </button>
          </div>
        </div>

        {/* RD Status card */}
        <div className="bg-cs-surface border border-white/5 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">{t('settings.rdTitle')}</h2>
              <p className="text-sm text-gray-400">
                {t('settings.rdSubtitle')}
              </p>
            </div>
            {status === 'saved' && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-green-900/40 text-green-400 border border-green-500/30 rounded-full text-xs font-semibold">
                <Check className="w-3.5 h-3.5" /> {t('settings.connected')}
              </span>
            )}
            {status === 'invalid' && (
              <span className="px-3 py-1 bg-red-900/40 text-red-400 border border-red-500/30 rounded-full text-xs font-semibold">
                {t('settings.invalidToken')}
              </span>
            )}
          </div>

          {username && (
            <div className="bg-black/30 rounded-xl p-4 mb-4 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-400">{t('settings.account')}</span>
                <span className="font-semibold">{username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t('settings.premiumLeft')}</span>
                <span className="font-semibold text-green-400">
                  {premiumLeft ? Math.floor(premiumLeft / 86400) : 0}
                </span>
              </div>
            </div>
          )}

          {/* Token input */}
          <label className="block text-sm font-semibold mb-2 text-gray-300">
            {t('settings.apiToken')}
          </label>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <input
                type={show ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('settings.tokenPlaceholder')}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-sm font-mono focus:border-cs-red focus:outline-none"
              />
              <button
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white"
                type="button"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={!token.trim() || status === 'saving'}
              className="px-5 py-2.5 bg-cs-red rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {status === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : t('settings.save')}
            </button>
            {token && (
              <button
                onClick={handleClear}
                className="px-3 py-2.5 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                title={t('settings.removeToken')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500">
            {t('settings.tokenNote')}
          </p>
        </div>

        {/* Instructions card */}
        <div className="bg-cs-surface border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-4">How to get a Real-Debrid token</h3>
          <ol className="space-y-3 text-sm text-gray-300 list-decimal list-inside">
            <li>
              Sign up at{' '}
              <Link href="https://real-debrid.com" target="_blank" rel="noreferrer"
                className="text-cs-red hover:underline inline-flex items-center gap-1">
                real-debrid.com <ExternalLink className="w-3 h-3" />
              </Link>{' '}
              and buy premium ($3/month or €16/180 days).
            </li>
            <li>
              Visit{' '}
              <Link href="https://real-debrid.com/apitoken" target="_blank" rel="noreferrer"
                className="text-cs-red hover:underline inline-flex items-center gap-1">
                real-debrid.com/apitoken <ExternalLink className="w-3 h-3" />
              </Link>
              .
            </li>
            <li>Copy your private API token.</li>
            <li>Paste it above and click Save.</li>
          </ol>
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-xs text-blue-200">
            <strong>Why RD?</strong> Free embed sites monetize via popups. Real-Debrid
            gives you direct CDN URLs from cached torrents — same content, zero ads,
            often 4K with multi-audio.
          </div>
          <div className="mt-2 p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-xs text-green-200">
            <strong>TV shows already ad-free.</strong> Our sandboxed proxy strips popups
            from TV embeds — no RD token needed. Real-Debrid is only required for
            ad-free movies.
          </div>
        </div>
      </div>
    </div>
  )
}
