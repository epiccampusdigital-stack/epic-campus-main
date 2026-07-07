'use client'
import { useEffect, useState } from 'react'

export function useDarkMode() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const root = document.documentElement
    if (saved === 'light') {
      setDark(false)
      root.classList.remove('dark')
      root.classList.add('light')
    } else if (saved === 'dark') {
      setDark(true)
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      // First visit: apply dark as the temporary visual default but do NOT
      // persist it — the one-time ThemeChooser prompt owns the actual choice
      // (writes both `theme` and `themeChosen`).
      setDark(true)
      root.classList.add('dark')
      root.classList.remove('light')
    }
  }, [])

  const toggle = () => {
    setDark(prev => {
      const next = !prev
      const root = document.documentElement
      if (next) {
        root.classList.add('dark')
        root.classList.remove('light')
        localStorage.setItem('theme', 'dark')
      } else {
        root.classList.remove('dark')
        root.classList.add('light')
        localStorage.setItem('theme', 'light')
      }
      return next
    })
  }

  return { dark, toggle }
}
