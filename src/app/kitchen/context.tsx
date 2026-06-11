'use client'

import { createContext, useContext } from 'react'
import type { EpicUser } from '@/types'

export interface KitchenContextValue {
  user: EpicUser | null
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}

export const KitchenContext = createContext<KitchenContextValue>({
  user: null,
  sidebarOpen: false,
  setSidebarOpen: () => {},
})

export function useKitchen() {
  return useContext(KitchenContext)
}
