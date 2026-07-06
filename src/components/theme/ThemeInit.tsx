'use client'

import { useDarkMode } from '@/hooks/useDarkMode'

/** Mounted once in the root layout so the dark/light class is corrected on every route, not just ones that render a theme toggle. */
export default function ThemeInit() {
  useDarkMode()
  return null
}
