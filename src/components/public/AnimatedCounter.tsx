'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  end: number
  duration?: number
  suffix?: string
  prefix?: string
}

export default function AnimatedCounter({ end, duration = 2000, suffix = '', prefix = '' }: AnimatedCounterProps) {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true) },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    let startTime: number | null = null
    const startVal = 0

    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease out cubic
      setCount(Math.floor(eased * (end - startVal) + startVal))
      if (progress < 1) requestAnimationFrame(animate)
      else setCount(end)
    }

    requestAnimationFrame(animate)
  }, [started, end, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  )
}
