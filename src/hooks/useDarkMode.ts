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
      // First visit: no stored preference — default to dark regardless of system preference
      setDark(true)
      root.classList.add('dark')
      root.classList.remove('light')
      localStorage.setItem('theme', 'dark')
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
