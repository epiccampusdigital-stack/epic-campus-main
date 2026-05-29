'use client'

import { useState, useEffect } from 'react'

interface ExamTimerProps {
  startedAt: Date
  timeLimitMinutes: number
  onExpire: () => void
}

export default function ExamTimer({
  startedAt,
  timeLimitMinutes,
  onExpire,
}: ExamTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000)
    setTimeLeft(Math.max(0, timeLimitMinutes * 60 - elapsed))
  }, [startedAt, timeLimitMinutes])

  useEffect(() => {
    if (timeLeft === null) return
    if (timeLeft <= 0) {
      onExpire()
      return
    }
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          onExpire()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeLeft])

  if (timeLeft === null) return null

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isRed = timeLeft < 300

  return (
    <div
      className={`min-w-[90px] rounded-lg border-2 px-4 py-2 text-center font-mono text-xl font-bold ${
        isRed
          ? 'border-red-600 bg-red-50 text-red-600'
          : 'border-slate-400 bg-slate-100 text-[#0B3D6B]'
      }`}
    >
      ⏱ {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  )
}
