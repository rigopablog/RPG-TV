/**
 * Sandboxed embed proxy.
 *
 * Defeats the ad scripts that providers (vidsrc.in, embed.su, etc.) wrap
 * around the video iframe by:
 *
 *   1. Fetching the provider's embed page server-side.
 *   2. Extracting the *inner* player iframe URL (the real video).
 *   3. Returning a minimal HTML page that loads that inner URL inside a
 *      `sandbox` iframe — blocking popups + top-nav at the browser level.
 *
 * The outer wrapper's ad scripts never run (because we don't ship them);
 * the inner iframe is sandboxed (so any popup attempt it makes is blocked
 * by the browser at the engine level).
 *
 * Empirically this works for TV embeds and lightly-protected movie embeds.
 * For heavily-protected movie embeds (where the ad fires from inside the
 * inner iframe itself), the recommended path is Real-Debrid via /api/stream-sources.
 */

import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36'

// ── Source URL builders ────────────────────────────────────────────────────
// NB: vidsrc.in 404s as of May 2026; vidsrc.me redirects to vidsrcme.ru and is alive.
function buildSourceUrl(opts: {
  source: string
  type: 'movie' | 'tv'
  imdb?: string
  tmdb?: string
  season?: number
  episode?: number
}): string | null {
  const { source, type, imdb, tmdb, season = 1, episode = 1 } = opts
  switch (source) {
    case 'vidsrc-me':
    case 'vidsrc-in': // legacy alias — routes to vidsrc.me now
      if (imdb) {
        return type === 'movie'
          ? `https://vidsrc.me/embed/movie?imdb=${imdb}`
          : `https://vidsrc.me/embed/tv?imdb=${imdb}&season=${season}&episode=${episode}`
      }
      if (!tmdb) return null
      return type === 'movie'
        ? `https://vidsrc.me/embed/movie?tmdb=${tmdb}`
        : `https://vidsrc.me/embed/tv?tmdb=${tmdb}&season=${season}&episode=${episode}`
    case 'vidsrc-xyz':
      if (!tmdb) return null
      return type === 'movie'
        ? `https://vidsrc.xyz/embed/movie?tmdb=${tmdb}`
        : `https://vidsrc.xyz/embed/tv?tmdb=${tmdb}&season=${season}&episode=${episode}`
    case 'vidsrc-to':
      if (!tmdb) return null
      return type === 'movie'
        ? `https://vidsrc.to/embed/movie/${tmdb}`
        : `https://vidsrc.to/embed/tv/${tmdb}/${season}/${episode}`
    case 'embed-su':
      if (!tmdb) return null
      return type === 'movie'
        ? `https://embed.su/embed/movie/${tmdb}`
        : `https://embed.su/embed/tv/${tmdb}/${season}/${episode}`
    default:
      return null
  }
}

// TMDB → IMDB conversion (we already do this in stream-sources; copy here to avoid coupling)
async function tmdbToImdb(type: 'movie' | 'tv', tmdbId: string): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  const url = new URL(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids`)
  if (apiKey && !token) url.searchParams.set('api_key', apiKey)
  try {
    const res = await fetch(url.toString(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { imdb_id?: string }
    return data.imdb_id ?? null
  } catch {
    return null
  }
}

// ── Inner-iframe extraction ─────────────────────────────────────────────────
function extractInnerIframe(html: string, baseUrl: string): string | null {
  const iframes = Array.from(html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi))
  if (!iframes.length) return null

  // Prefer iframes pointing at obvious player paths
  const playerLike = iframes.find((m) => /rcp|player|srcrcp|cloudnestra|embed|stream/i.test(m[1]))
  const chosen = (playerLike ?? iframes[0])[1]

  // Reject known "no content" placeholders that vidsrc/embed-su serve when they
  // don't actually have the title (the user sees a CentOS Apache 404 inside).
  if (!chosen || /not_found|notfound|\/error|about:blank/i.test(chosen)) return null

  try {
    return new URL(chosen, baseUrl).toString()
  } catch {
    return null
  }
}

/**
 * HEAD-probe the extracted inner URL with a short timeout. If it 404s or fails,
 * we treat the source as "no content" and try the next provider.
 * Some providers don't support HEAD — for those we accept any non-404 response.
 */
async function innerIsAlive(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': UA, Referer: new URL(url).origin },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    })
    return r.status !== 404
  } catch {
    // Network error / timeout — assume it's alive; let the browser try.
    return true
  }
}

// ── Build the response page ─────────────────────────────────────────────────
function wrapperPage(innerSrc: string, referer: string): string {
  // Browser will sandbox the inner iframe: no popups, no top-nav, no extra windows.
  // The inner page can still run scripts to play the video (allow-scripts) and
  // talk to its own origin's APIs (allow-same-origin).
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="origin">
<title>Player</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
  iframe { width: 100%; height: 100%; border: 0; display: block; }
</style>
</head>
<body>
<iframe
  src="${innerSrc.replace(/"/g, '&quot;')}"
  sandbox="allow-scripts allow-same-origin allow-presentation allow-orientation-lock"
  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
  allowfullscreen
  referrerpolicy="origin"
></iframe>
</body>
</html>`
}

// ── Try a single source: fetch, extract inner iframe, verify it's alive ─────
async function tryResolve(opts: {
  source: string
  type: 'movie' | 'tv'
  imdb?: string
  tmdb?: string
  season?: number
  episode?: number
}): Promise<{ innerSrc: string; finalUrl: string } | null> {
  const url = buildSourceUrl(opts)
  if (!url) return null

  let html: string
  let finalUrl = url
  try {
    const upstream = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Referer: new URL(url).origin,
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
      signal: AbortSignal.timeout(10000),
    })
    finalUrl = upstream.url || url
    if (!upstream.ok) return null
    html = await upstream.text()
  } catch {
    return null
  }

  const innerSrc = extractInnerIframe(html, finalUrl)
  if (!innerSrc) return null

  // Verify the inner URL doesn't 404
  if (!(await innerIsAlive(innerSrc))) return null

  return { innerSrc, finalUrl }
}

// ── Main handler ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const type = (searchParams.get('type') ?? 'movie') as 'movie' | 'tv'
  const tmdb = searchParams.get('tmdb') ?? searchParams.get('id') ?? undefined
  const season = Number(searchParams.get('season') ?? 1)
  const episode = Number(searchParams.get('episode') ?? 1)
  const preferred = searchParams.get('source') ?? 'vidsrc-me'

  if (!tmdb) return new Response('Missing tmdb id', { status: 400 })

  // Build a server-side fallback chain: try preferred source first, then others
  const allSources = ['vidsrc-me', 'embed-su', 'vidsrc-xyz', 'vidsrc-to']
  const chain = [preferred, ...allSources.filter((s) => s !== preferred)]

  // IMDB id (vidsrc.me works better with IMDB for niche content)
  const imdb = (await tmdbToImdb(type, tmdb)) ?? undefined

  for (const source of chain) {
    const r = await tryResolve({ source, type, imdb, tmdb, season, episode })
    if (r) {
      return new Response(wrapperPage(r.innerSrc, r.finalUrl), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-Proxy-Source': source,
        },
      })
    }
  }

  // Nothing worked. Return a tiny HTML page that immediately tells the parent
  // window to advance to the next server — iframes can't surface HTTP errors,
  // so we use postMessage instead. Status is still 502 for any non-browser
  // clients.
  const fallbackPage = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>No source</title>
<style>html,body{margin:0;background:#000;color:#666;font:14px/1.4 system-ui;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;padding:1rem}</style>
</head><body>
<div>
<p>No source available — trying next server…</p>
<script>try { window.parent.postMessage('rpgtv:proxy-failed', '*'); } catch(_) {}</script>
</div>
</body></html>`
  return new Response(fallbackPage, {
    status: 502,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
