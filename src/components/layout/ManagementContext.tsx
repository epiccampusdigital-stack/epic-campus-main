'use client'

import { createContext, useContext } from 'react'
import type { EpicUser, Role } from '@/types'

interface ManagementContextValue {
  user: EpicUser | null
  loading: boolean
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  /** Whether the current user has the given role, checking all assigned roles. */
  hasRole: (role: Role) => boolean
}

export const ManagementContext = createContext<ManagementContextValue>({
  user: null,
  loading: true,
  sidebarOpen: false,
  setSidebarOpen: () => {},
  hasRole: () => false,
})

export function useManagement() {
  return useContext(ManagementContext)
}
