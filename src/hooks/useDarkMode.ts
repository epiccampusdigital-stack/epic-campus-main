'use client'
import { useEffect, useState } from 'react'

export function useDarkMode() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('epic-theme')
    if (saved === 'dark') {
      setDark(true)
      document.documentElement.classList.add('dark')
    } else {
      setDark(false)
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggle = () => {
    setDark(prev => {
      const next = !prev
      if (next) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('epic-theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('epic-theme', 'light')
      }
      return next
    })
  }

  return { dark, toggle }
}
