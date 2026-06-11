'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'kitchenSinhala'

export function useKitchenSinhala() {
  const [sinhala, setSinhala] = useState(false)

  useEffect(() => {
    try {
      setSinhala(localStorage.getItem(STORAGE_KEY) === 'true')
    } catch {
      setSinhala(false)
    }
  }, [])

  const toggleSinhala = useCallback((value: boolean) => {
    setSinhala(value)
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
    } catch {
      // ignore
    }
  }, [])

  return { sinhala, toggleSinhala }
}
