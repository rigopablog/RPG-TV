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
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const looksLikeHls = /\.m3u8(\?|$)/i.test(src)

    // Safari + iOS — native HLS support, no library needed
    if (looksLikeHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      video.play().catch(() => {})
      return
    }

    if (looksLikeHls) {
      // Dynamic import keeps hls.js out of the initial JS bundle for
      // pages that don't need it (homepage, settings, etc.)
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return
        if (!Hls.isSupported()) {
          // Last-resort fallback: try direct src and hope the browser
          // handles it. Most likely will fail and trigger onError.
          video.src = src
          return
        }
        const hls = new Hls({
          // Conservative buffer for live streams — large buffers cause
          // long catch-up delays when channels glitch
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          // Skip broken segments instead of stalling
          fragLoadingMaxRetry: 3,
          manifestLoadingMaxRetry: 3,
          levelLoadingMaxRetry: 3,
        })
        hls.loadSource(src)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            // Try graceful recovery for network errors, otherwise bail
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad()
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError()
            } else {
              hls.destroy()
              onError?.()
            }
          }
        })
        hlsRef.current = hls
      })
      return
    }

    // Non-HLS (raw MP4/WebM stream) — just point the element at it
    video.src = src
    video.play().catch(() => {})

    return () => {
      cancelled = true
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
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
