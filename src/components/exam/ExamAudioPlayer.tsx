'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

interface ExamAudioPlayerProps {
  src: string
  className?: string
  /** Parent can call this to pause when changing questions */
  onPauseRef?: (pause: () => void) => void
}

export default function ExamAudioPlayer({
  src,
  className = '',
  onPauseRef,
}: ExamAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    setPlaying(false)
  }, [])

  useEffect(() => {
    onPauseRef?.(pause)
  }, [onPauseRef, pause])

  useEffect(() => {
    pause()
    setCurrent(0)
    setDuration(0)
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = 0
      audio.load()
    }
  }, [src, pause])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrent(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration || 0)
    const onEnded = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
    }
  }, [src])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      pause()
      return
    }

    try {
      await audio.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  const handleSeek = (value: number) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    audio.currentTime = value
    setCurrent(value)
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div className={`rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8A020] text-[#0B3D6B] shadow-sm transition-colors hover:bg-[#F5B942]"
          aria-label={playing ? 'Pause audio' : 'Play audio'}
        >
          <span className={`ti text-xl ${playing ? 'ti-player-pause' : 'ti-player-play'}`} />
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="h-2 w-full cursor-pointer accent-[#E8A020]"
            aria-label="Audio progress"
          />
          <div className="mt-1 flex justify-between font-inter text-xs text-[#5A6A7A]">
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-[#DDE3EC]"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-[#E8A020] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
