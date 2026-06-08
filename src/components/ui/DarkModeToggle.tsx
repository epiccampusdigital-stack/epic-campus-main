'use client'
import { useDarkMode } from '@/hooks/useDarkMode'

export default function DarkModeToggle() {
  const { dark, toggle } = useDarkMode()
  return (
    <button
      onClick={toggle}
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all duration-200
                 bg-[#0B3D6B]/[0.07] hover:bg-[#0B3D6B]/[0.12] text-[#0B3D6B]
                 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] dark:text-white/70"
      aria-label="Toggle dark mode"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )
}
