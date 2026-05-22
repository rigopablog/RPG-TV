'use client'

import { useEffect } from 'react'

export default function PopupBlocker() {
  useEffect(() => {
    /* ── 1. Override window.open ─────────────────────────────────────────────
       Blocks any script on THIS page from opening a popup.
       Cross-origin iframes have their own window context, so we also
       handle those via the blur trap below.                                  */
    const originalOpen = window.open.bind(window)
    window.open = function (...args: Parameters<typeof window.open>) {
      const url = String(args[0] ?? '')
      if (!url || url === 'about:blank' || url.startsWith(window.location.origin)) {
        return originalOpen(...args)
      }
      console.info('[RPG TV] Blocked window.open:', url)
      // Return a fake window object so caller scripts don't crash
      return {
        closed: true,
        close: () => {},
        focus: () => {},
        blur: () => {},
        postMessage: () => {},
        location: { href: '', replace: () => {}, assign: () => {} },
        document: { write: () => {}, writeln: () => {} },
      } as unknown as Window
    }

    /* ── 1b. Patch window.open on same-origin iframes we can touch ──────────*/
    const patchIframeOpen = () => {
      document.querySelectorAll('iframe').forEach((frame) => {
        try {
          const w = (frame as HTMLIFrameElement).contentWindow
          if (w && !(w as unknown as { __rpgPatched?: boolean }).__rpgPatched) {
            w.open = () => null
            ;(w as unknown as { __rpgPatched?: boolean }).__rpgPatched = true
          }
        } catch { /* cross-origin — sandbox attribute handles those */ }
      })
    }
    patchIframeOpen()
    const iframePatchInterval = setInterval(patchIframeOpen, 2000)

    /* ── 2. Block window.location hijacks ────────────────────────────────────
       Some ads redirect the top page via window.location = "..."             */
    const locDescriptor = Object.getOwnPropertyDescriptor(window, 'location')
    // Only override if configurable (most browsers)
    if (locDescriptor?.configurable) {
      let _href = window.location.href
      Object.defineProperty(window, 'location', {
        configurable: true,
        get: () => window.location,
        set: (url: string) => {
          if (url && !url.startsWith(window.location.origin) && !url.startsWith('/')) {
            console.info('[RPG TV] Blocked location redirect:', url)
            return
          }
          _href = url
          window.location.href = _href
        },
      })
    }

    /* ── 3. Blur-refocus trap ────────────────────────────────────────────────
       When the iframe opens a popup, the browser focuses the new window,
       which fires window.blur on our page. We track whether the user
       actually clicked (intentional navigation) or not (ad popup),
       and immediately refocus the page in the latter case.                   */
    let lastInteraction = 0
    let refocusTimer: ReturnType<typeof setTimeout> | null = null

    const onInteraction = () => { lastInteraction = Date.now() }

    const onBlur = () => {
      const msSinceInteraction = Date.now() - lastInteraction
      // If blur fires without a recent deliberate click → it's an ad popup
      // If blur fires <800ms after a click → might also be ad-triggered
      refocusTimer = setTimeout(() => {
        window.focus()
        // Try to close whatever opened (works if popup was same-origin)
        try { window.open('', '_self')?.close() } catch {}
      }, 100)
    }

    const onFocus = () => {
      // User came back intentionally — cancel pending refocus
      if (refocusTimer) { clearTimeout(refocusTimer); refocusTimer = null }
    }

    window.addEventListener('blur',       onBlur)
    window.addEventListener('focus',      onFocus)
    window.addEventListener('mousedown',  onInteraction, true)
    window.addEventListener('keydown',    onInteraction, true)
    window.addEventListener('touchstart', onInteraction, true)

    /* ── 4. Block external _blank links injected into the page ──────────────*/
    const onLinkClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      if (a?.target === '_blank' && a.href && !a.href.startsWith(window.location.origin)) {
        e.preventDefault()
        e.stopImmediatePropagation()
        console.info('[RPG TV] Blocked _blank link:', a.href)
      }
    }
    document.addEventListener('click', onLinkClick, true)

    /* ── 5. MutationObserver — strip injected ad scripts/iframes ────────────
       Some embeds append <script> or <iframe> tags to document.body.         */
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType !== 1) continue
          const el = node as HTMLElement
          // Remove injected script tags pointing to ad networks
          if (el.tagName === 'SCRIPT') {
            const src = el.getAttribute('src') ?? ''
            if (src && !src.startsWith(window.location.origin)) {
              el.remove()
              console.info('[RPG TV] Removed injected script:', src)
            }
          }
          // Remove injected iframe overlays — but NEVER touch our own player iframes
          if (el.tagName === 'IFRAME') {
            const isOurPlayer =
              el.hasAttribute('data-rpgtv-player') ||
              el.classList.contains('player-iframe') ||
              el.closest('[data-rpgtv-player]')
            if (!isOurPlayer) {
              const src = el.getAttribute('src') ?? ''
              if (src && !src.startsWith(window.location.origin) && !src.startsWith('blob:')) {
                el.remove()
                console.info('[RPG TV] Removed injected iframe:', src)
              }
            }
          }
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.open = originalOpen
      window.removeEventListener('blur',       onBlur)
      window.removeEventListener('focus',      onFocus)
      window.removeEventListener('mousedown',  onInteraction, true)
      window.removeEventListener('keydown',    onInteraction, true)
      window.removeEventListener('touchstart', onInteraction, true)
      document.removeEventListener('click', onLinkClick, true)
      observer.disconnect()
      if (refocusTimer) clearTimeout(refocusTimer)
      clearInterval(iframePatchInterval)
    }
  }, [])

  return null
}
