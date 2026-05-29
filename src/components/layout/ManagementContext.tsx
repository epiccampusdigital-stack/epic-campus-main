'use client'

import { createContext, useContext } from 'react'
import type { EpicUser } from '@/types'

interface ManagementContextValue {
  user: EpicUser | null
  loading: boolean
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const ManagementContext = createContext<ManagementContextValue>({
  user: null,
  loading: true,
  sidebarOpen: false,
  setSidebarOpen: () => {},
})

export function useManagement() {
  return useContext(ManagementContext)
}
