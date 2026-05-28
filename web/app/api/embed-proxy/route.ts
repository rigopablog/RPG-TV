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
// `lang` is a 2-letter language hint (e.g. 'es', 'en') — most providers honor
// it as the default subtitle/dub language via `?ds_lang=` (vidsrc family) or
// equivalent. Falls back gracefully if the provider ignores it.
function buildSourceUrl(opts: {
  source: string
  type: 'movie' | 'tv'
  imdb?: string
  tmdb?: string
  season?: number
  episode?: number
  lang?: string
}): string | null {
  const { source, type, imdb, tmdb, season = 1, episode = 1, lang } = opts
  const langQs = lang ? `&ds_lang=${lang}` : ''
  switch (source) {
    case 'vidsrc-me':
    case 'vidsrc-in': // legacy alias — routes to vidsrc.me now
      if (imdb) {
        return type === 'movie'
          ? `https://vidsrc.me/embed/movie?imdb=${imdb}${langQs}`
          : `https://vidsrc.me/embed/tv?imdb=${imdb}&season=${season}&episode=${episode}${langQs}`
      }
      if (!tmdb) return null
      return type === 'movie'
        ? `https://vidsrc.me/embed/movie?tmdb=${tmdb}${langQs}`
        : `https://vidsrc.me/embed/tv?tmdb=${tmdb}&season=${season}&episode=${episode}${langQs}`
    case 'vidsrc-xyz':
      if (!tmdb) return null
      return type === 'movie'
        ? `https://vidsrc.xyz/embed/movie?tmdb=${tmdb}${langQs}`
        : `https://vidsrc.xyz/embed/tv?tmdb=${tmdb}&season=${season}&episode=${episode}${langQs}`
    case 'vidsrc-to':
      if (!tmdb) return null
      return type === 'movie'
        ? `https://vidsrc.to/embed/movie/${tmdb}${lang ? `?ds_lang=${lang}` : ''}`
        : `https://vidsrc.to/embed/tv/${tmdb}/${season}/${episode}${lang ? `?ds_lang=${lang}` : ''}`
    case 'embed-su':
      if (!tmdb) return null
      // embed.su uses a different param convention; pass via hash fragment.
      return type === 'movie'
        ? `https://embed.su/embed/movie/${tmdb}${lang ? `?lang=${lang}` : ''}`
        : `https://embed.su/embed/tv/${tmdb}/${season}/${episode}${lang ? `?lang=${lang}` : ''}`
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
  //
  // Dead-source detection. Some upstream providers serve an Apache/CentOS
  // "Not Found" page (or get redirected to /not_found by cloudnestra) for
  // titles they don't actually have. We catch this on the client by checking
  // TWO cheap signals after the iframe finishes loading:
  //
  //   1. iframe.contentWindow.length — the number of nested frames inside.
  //      Real player pages always have 1+ (video element wrapper, ads,
  //      trackers, etc.). Static Apache error pages have 0.
  //   2. Whether the iframe has emitted any postMessage events. Real players
  //      send analytics/ready/ad-framework messages within 1-2 seconds;
  //      static HTML pages send nothing.
  //
  // We require BOTH to indicate failure (no nested frames AND no postMessage)
  // before bailing — that way we never false-positive on a quiet but valid
  // player.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Player</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
  iframe { width: 100%; height: 100%; border: 0; display: block; }
</style>
</head>
<body>
<iframe
  id="player"
  src="${innerSrc.replace(/"/g, '&quot;')}"
  sandbox="allow-scripts allow-same-origin allow-presentation allow-orientation-lock"
  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
  allowfullscreen
  referrerpolicy="no-referrer"
></iframe>
<script>
(function () {
  var iframe = document.getElementById('player');
  var heardFromIframe = false;
  var failed = false;

  // Track any postMessage emitted by the inner iframe (real players do this).
  window.addEventListener('message', function (e) {
    try { if (e.source === iframe.contentWindow) heardFromIframe = true; } catch (_) {}
  });

  function reportFailure(reason) {
    if (failed) return;
    failed = true;
    try { window.parent.postMessage('rpgtv:proxy-failed', '*'); } catch (_) {}
  }

  function probe() {
    if (failed) return;
    var nested = -1;
    try { nested = iframe.contentWindow.length; } catch (_) {}
    // Both signals say dead — advance.
    if (nested === 0 && !heardFromIframe) {
      reportFailure('no-frames-no-messages');
    }
  }

  iframe.addEventListener('load', function () {
    // First probe at 3s — enough time for a real player to spin up its
    // nested frames and emit at least one analytics ping.
    setTimeout(probe, 3000);
    // Second probe at 7s as a backstop for slow connections.
    setTimeout(probe, 7000);
  });

  // Network-level failure (DNS fail, TLS fail, connection reset, malformed
  // HTTP response — e.g. cloudnestra "invalid response"). Fires before
  // onload so we can advance to the next server in milliseconds rather
  // than waiting on the timeout backstop.
  iframe.addEventListener('error', function () {
    reportFailure('iframe-error');
  });

  // Backstop: if the iframe never fires onload within 8s, assume the
  // upstream is dead (stalled DNS / TCP / TLS) and advance.
  setTimeout(function () { if (!heardFromIframe) reportFailure('onload-never-fired'); }, 8000);
})();
</script>
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
  lang?: string
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
  // Preferred player audio/subtitle language. Source: ?lang= query param if set,
  // else the rpg_lang cookie set by the client. 2-letter code ('en', 'es').
  const lang =
    searchParams.get('lang') ??
    req.cookies.get('rpg_lang')?.value ??
    undefined

  if (!tmdb) return new Response('Missing tmdb id', { status: 400 })

  // Build a server-side fallback chain: try preferred source first, then others
  const allSources = ['vidsrc-me', 'embed-su', 'vidsrc-xyz', 'vidsrc-to']
  const chain = [preferred, ...allSources.filter((s) => s !== preferred)]

  // IMDB id (vidsrc.me works better with IMDB for niche content)
  const imdb = (await tmdbToImdb(type, tmdb)) ?? undefined

  for (const source of chain) {
    const r = await tryResolve({ source, type, imdb, tmdb, season, episode, lang })
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
