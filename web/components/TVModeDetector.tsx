'use client'

import { useEffect } from 'react'

/**
 * Add `tv-mode` to <body> on the first arrow-key / D-pad / Enter press.
 *
 * Why: smart TV remotes report arrow keys + Enter; mouse users don't normally
 * press those. Detecting them lets us boost focus-ring contrast and apply
 * other TV-only styles without affecting desktop users who never touch the
 * keyboard.
 *
 * Also handles `scrollIntoView` for focused elements inside horizontally
 * scrollable rows (`[data-tv-row]`) so the D-pad doesn't push focus off-screen.
 */
export default function TVModeDetector() {
  useEffect(() => {
    let armed = !document.body.classList.contains('tv-mode')

    const TV_KEYS = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Enter', 'Return',
      // Smart-TV-specific keycodes:
      'GoBack', 'XF86Back',
      // Remote OK button on some platforms:
      'Select',
    ])

    function onKey(e: KeyboardEvent) {
      if (armed && TV_KEYS.has(e.key)) {
        document.body.classList.add('tv-mode')
        armed = false
      }
    }

    function onFocusIn(e: FocusEvent) {
      const el = e.target as HTMLElement | null
      if (!el || typeof el.scrollIntoView !== 'function') return
      // Only auto-scroll inside our horizontal rows; full-page scroll is
      // jarring for sidebars and the navbar.
      const row = el.closest('[data-tv-row]')
      if (row) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }

    function onMouseMove() {
      // If a real mouse appears, drop TV mode (someone plugged a USB mouse
      // into the Fire Stick? Fine — give them a cursor.)
      if (document.body.classList.contains('tv-mode')) {
        document.body.classList.remove('tv-mode')
        armed = true
      }
    }

    window.addEventListener('keydown', onKey, true)
    document.addEventListener('focusin', onFocusIn, true)
    window.addEventListener('mousemove', onMouseMove, { passive: true, once: false })

    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('focusin', onFocusIn, true)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return null
}
