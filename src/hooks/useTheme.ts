'use client'

import { useEffect, useState } from 'react'

export function useTheme() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(false)
    document.documentElement.classList.remove('dark')
    localStorage.removeItem('epic-theme')
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
  }

  return { isDark, toggle }
}
