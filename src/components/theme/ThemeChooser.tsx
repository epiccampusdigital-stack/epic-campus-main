'use client'

import { useEffect, useState } from 'react'

/** One-time light/dark preference prompt shown on a visitor's first ever load
 *  (when no `themeChosen` flag is stored). Not dismissible — the user must pick.
 *  After a choice, both `theme` and `themeChosen` are persisted so it never
 *  reappears; the navbar toggle continues to work as before afterwards. */
export default function ThemeChooser() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Only decide on the client, after mount, to avoid hydration mismatches.
    try {
      if (!localStorage.getItem('themeChosen')) setVisible(true)
    } catch {
      /* localStorage blocked — never show */
    }
  }, [])

  function choose(theme: 'dark' | 'light') {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.remove('dark')
      root.classList.add('light')
    }
    try {
      localStorage.setItem('theme', theme)
      localStorage.setItem('themeChosen', 'true')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your view"
    >
      <div className="w-full max-w-md rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur-xl dark:bg-[#1A1535]/95">
        <div className="mb-6 text-center">
          <img
            src="/images/logo-transparent.png"
            alt="EPIC Campus"
            className="mx-auto mb-4 h-12 w-auto object-contain"
          />
          <h2 className="font-jakarta text-xl font-bold text-[#0D1B2A] dark:text-white">Choose your view</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-white/50">
            You can change this anytime from the toggle in the navbar.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Dark */}
          <button
            type="button"
            onClick={() => choose('dark')}
            className="group flex flex-1 flex-col items-center gap-3 rounded-2xl border-2 border-transparent bg-[#F5F7FB] p-5 transition-all hover:border-[#E8A020] hover:shadow-md dark:bg-white/[0.04]"
          >
            <div className="flex h-20 w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#0D0B1E] to-[#1A1535]">
              <span className="font-jakarta text-lg font-black text-[#E8A020]">Aa</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="ti ti-moon text-lg text-[#E8A020]" aria-hidden="true" />
              <span className="font-semibold text-[#0D1B2A] dark:text-white">Dark Mode</span>
            </div>
          </button>

          {/* Light */}
          <button
            type="button"
            onClick={() => choose('light')}
            className="group flex flex-1 flex-col items-center gap-3 rounded-2xl border-2 border-transparent bg-[#F5F7FB] p-5 transition-all hover:border-[#0B3D6B] hover:shadow-md dark:bg-white/[0.04]"
          >
            <div className="flex h-20 w-full items-center justify-center rounded-xl border border-gray-200 bg-white">
              <span className="font-jakarta text-lg font-black text-[#0B3D6B]">Aa</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="ti ti-sun text-lg text-[#0B3D6B]" aria-hidden="true" />
              <span className="font-semibold text-[#0D1B2A] dark:text-white">Light Mode</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
