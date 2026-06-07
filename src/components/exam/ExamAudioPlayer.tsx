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
  questionNumber?: number
  playLimit?: number
  onPauseRef?: (pause: () => void) => void
}

export default function ExamAudioPlayer({
  src,
  className = '',
  questionNumber,
  playLimit,
  onPauseRef,
}: ExamAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playCount, setPlayCount] = useState(0)

  const canPlay = playLimit == null || playCount < playLimit

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
    setPlayCount(0)
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
    if (!canPlay) return
    try {
      await audio.play()
      setPlaying(true)
      if (current === 0 || current >= duration - 0.5) {
        setPlayCount((c) => c + 1)
      }
    } catch {
      setPlaying(false)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * duration
    setCurrent(ratio * duration)
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0

  if (!src) {
    return (
      <div className={`flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 ${className}`}>
        <span className="text-amber-600 text-sm">🎵 Audio for this question will be available soon.</span>
      </div>
    )
  }

  return (
    <div className={`bg-[#0B3D6B] rounded-[10px] px-4 py-3 mb-4 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Top row */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={togglePlay}
          disabled={!canPlay}
          className={`w-[34px] h-[34px] rounded-full flex items-center justify-center
                      flex-shrink-0 transition-colors
                      ${canPlay ? 'bg-[#E8A020] hover:bg-amber-500' : 'bg-white/20 cursor-not-allowed'}`}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg width="10" height="12" fill="white" viewBox="0 0 10 12">
              <rect x="0" y="0" width="3.5" height="12" />
              <rect x="6.5" y="0" width="3.5" height="12" />
            </svg>
          ) : (
            <svg width="11" height="13" fill="white" viewBox="0 0 11 13">
              <polygon points="0,0 11,6.5 0,13" />
            </svg>
          )}
        </button>
        <span className="text-white/70 text-[12px] flex-1">
          {questionNumber != null ? `Q${questionNumber} · ` : ''}Listening
        </span>
        {playLimit != null && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full
                            ${canPlay ? 'bg-[#E8A020]/20 text-[#E8A020]' : 'bg-red-500/20 text-red-300'}`}>
            {playCount}/{playLimit} plays
          </span>
        )}
      </div>

      {/* Progress row */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-[3px] bg-white/15 rounded-full cursor-pointer"
          onClick={handleSeek}
        >
          <div
            className="h-[3px] bg-[#E8A020] rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-white/50 text-[11px] tabular-nums w-16 text-right">
          {formatTime(current)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}
