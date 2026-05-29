'use client'

import { useEffect, useState } from 'react'

export function useTheme() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('epic-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = stored ? stored === 'dark' : prefersDark
    setIsDark(shouldBeDark)
    document.documentElement.classList.toggle('dark', shouldBeDark)
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('epic-theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
  }

  return { isDark, toggle }
}
