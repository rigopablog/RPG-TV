'use client'

import { useEffect, useRef } from 'react'

export interface VSource {
  url: string
  quality: string
  type: 'hls' | 'mp4' | 'mkv' | 'webm'
}

export interface VSubtitle {
  url: string
  lang: string
  label: string
}

interface Props {
  sources: VSource[]
  subtitles?: VSubtitle[]
  autoplay?: boolean
  onReady?: () => void
  onError?: () => void
  className?: string
}

/**
 * Native HTML5 video player.
 * Plays Real-Debrid direct MP4/WebM/MKV URLs without any external library.
 * Browser-native playback = no codec issues, no double-mount problems, no JS bloat.
 *
 * For HLS streams we keep the spec MIME (`application/x-mpegURL`); modern Safari
 * plays HLS natively. On other browsers HLS would need hls.js — we don't ship that
 * today because Real-Debrid serves us direct MP4s.
 */
export default function VideoPlayer({
  sources,
  subtitles = [],
  autoplay = true,
  onReady,
  onError,
  className = '',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onReadyRef = useRef(onReady)
  const onErrorRef = useRef(onError)
  useEffect(() => { onReadyRef.current = onReady }, [onReady])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const primary = sources[0]

  // Fire onReady when metadata loads; onError on actual errors
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const handleReady = () => onReadyRef.current?.()
    const handleError = () => {
      console.warn('[VideoPlayer] error:', v.error)
      onErrorRef.current?.()
    }
    v.addEventListener('loadedmetadata', handleReady)
    v.addEventListener('error', handleError)
    return () => {
      v.removeEventListener('loadedmetadata', handleReady)
      v.removeEventListener('error', handleError)
    }
  }, [])

  if (!primary) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-black ${className}`}>
        <div className="text-gray-500 text-sm">No source</div>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      key={primary.url}              // force re-mount when URL changes
      src={primary.url}
      controls
      autoPlay={autoplay}
      playsInline
      preload="metadata"
      className={`w-full h-full bg-black ${className}`}
    >
      {subtitles.map((s) => (
        <track key={s.url} kind="subtitles" src={s.url} srcLang={s.lang} label={s.label} />
      ))}
    </video>
  )
}
