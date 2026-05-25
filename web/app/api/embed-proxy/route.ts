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
  // Try a few patterns providers actually use:
  //   <iframe id="player_iframe" src="...">
  //   <iframe class="vds" src="...">
  //   <iframe ... src="https://...vidsrc.../rcp/...">
  const iframes = Array.from(html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi))
  if (!iframes.length) return null

  // Prefer iframes pointing at obvious player paths
  const playerLike = iframes.find((m) => /rcp|player|src|embed|stream/i.test(m[1]))
  const chosen = (playerLike ?? iframes[0])[1]

  // Resolve relative URL against base
  try {
    return new URL(chosen, baseUrl).toString()
  } catch {
    return null
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

// ── Main handler ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const type = (searchParams.get('type') ?? 'movie') as 'movie' | 'tv'
  const tmdb = searchParams.get('tmdb') ?? searchParams.get('id') ?? undefined
  const season = Number(searchParams.get('season') ?? 1)
  const episode = Number(searchParams.get('episode') ?? 1)
  const source = searchParams.get('source') ?? 'vidsrc-in'

  if (!tmdb) {
    return new Response('Missing tmdb id', { status: 400 })
  }

  // Get IMDB id if we'll need it (vidsrc.in uses IMDB)
  const imdb = source === 'vidsrc-in' ? await tmdbToImdb(type, tmdb) : null

  const sourceUrl = buildSourceUrl({ source, type, imdb: imdb ?? undefined, tmdb, season, episode })
  if (!sourceUrl) {
    return new Response('Could not build source URL (missing IMDB?)', { status: 502 })
  }

  // Fetch upstream embed page (follow redirects — vidsrc.me → vidsrcme.ru)
  let html: string
  let finalUrl = sourceUrl
  try {
    const upstream = await fetch(sourceUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Referer: new URL(sourceUrl).origin,
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
      signal: AbortSignal.timeout(10000),
    })
    finalUrl = upstream.url || sourceUrl
    if (!upstream.ok) {
      return new Response(`Upstream ${upstream.status}`, { status: 502 })
    }
    html = await upstream.text()
  } catch (e) {
    return new Response(`Fetch failed: ${e instanceof Error ? e.message : 'unknown'}`, { status: 502 })
  }

  // Find the inner player iframe
  const innerSrc = extractInnerIframe(html, finalUrl)
  if (!innerSrc) {
    // Fall back to wrapping the source URL itself — still gains sandbox isolation
    return new Response(wrapperPage(finalUrl, finalUrl), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    })
  }

  return new Response(wrapperPage(innerSrc, finalUrl), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  })
}
