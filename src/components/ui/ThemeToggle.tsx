'use client'

import { useTheme } from '@/hooks/useTheme'

export default function ThemeToggle() {
  const { isDark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      type="button"
    >
      {isDark ? (
        <span className="text-xl">☀️</span>
      ) : (
        <span className="text-xl">🌙</span>
      )}
    </button>
  )
}
