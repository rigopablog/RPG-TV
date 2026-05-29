'use client'

/**
 * HLS-capable live TV player.
 *
 * Most iptv-org streams are HLS (.m3u8). Safari plays HLS natively, but
 * Chrome / Firefox / Edge don't, so we attach hls.js when needed.
 *
 * Lifecycle:
 *   1. Element mounts, source URL provided.
 *   2. If browser supports native HLS (Safari) → just set video.src.
 *   3. Otherwise → hls.js attaches to the <video> element.
 *   4. On unmount or src change → destroy the hls.js instance to free
 *      MediaSource buffers (otherwise Chrome runs out after ~3 channel changes).
 */

import { useEffect, useRef } from 'react'

interface Props {
  src: string
  poster?: string
  onError?: () => void
}

export default function LiveTVPlayer({ src, poster, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<{ destroy: () => void } | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    let cancelled = false

    // Tear down any previous hls.js instance before attaching a new one
    if (hlsRef.current) {
      try { hlsRef.current.destroy() } catch (_) {}
      hlsRef.current = null
    }

    const cleanup = () => {
      cancelled = true
      if (hlsRef.current) {
        try { hlsRef.current.destroy() } catch (_) {}
        hlsRef.current = null
      }
    }

    try {
      const looksLikeHls = /\.m3u8(\?|$)/i.test(src)

      // Safari + iOS — native HLS support, no library needed
      if (looksLikeHls && video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src
        video.play().catch(() => {})
        return cleanup
      }

      if (looksLikeHls) {
        // Dynamic import keeps hls.js out of the initial JS bundle for
        // pages that don't need it (homepage, settings, etc.)
        import('hls.js')
          .then(({ default: Hls }) => {
            if (cancelled) return
            if (!Hls.isSupported()) {
              video.src = src
              return
            }
            const hls = new Hls({
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              fragLoadingMaxRetry: 3,
              manifestLoadingMaxRetry: 3,
              levelLoadingMaxRetry: 3,
            })
            try {
              hls.loadSource(src)
              hls.attachMedia(video)
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(() => {})
              })
              hls.on(Hls.Events.ERROR, (_evt, data) => {
                if (data.fatal) {
                  if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    try { hls.startLoad() } catch (_) { onError?.() }
                  } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    try { hls.recoverMediaError() } catch (_) { onError?.() }
                  } else {
                    try { hls.destroy() } catch (_) {}
                    onError?.()
                  }
                }
              })
              hlsRef.current = hls
            } catch (e) {
              onError?.()
            }
          })
          .catch(() => onError?.())
        return cleanup
      }

      // Non-HLS (raw MP4/WebM stream) — just point the element at it
      video.src = src
      video.play().catch(() => {})
      return cleanup
    } catch (e) {
      onError?.()
      return cleanup
    }
  }, [src, onError])

  return (
    <video
      ref={videoRef}
      poster={poster}
      controls
      autoPlay
      playsInline
      className="w-full h-full bg-black"
      onError={() => onError?.()}
    />
  )
}
