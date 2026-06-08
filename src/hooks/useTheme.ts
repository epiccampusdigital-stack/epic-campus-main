'use client'

import { useDarkMode } from '@/hooks/useDarkMode'

/** Backward-compatible alias for useDarkMode */
export function useTheme() {
  const { dark: isDark, toggle } = useDarkMode()
  return { isDark, toggle }
}
