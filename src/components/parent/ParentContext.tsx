'use client'

import { createContext, useContext } from 'react'
import type { EpicUser, ParentAccount, Student } from '@/types'

export type ParentPortalStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

interface ParentContextValue {
  user: EpicUser | null
  parent: ParentAccount | null
  student: Student | null
  status: ParentPortalStatus
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  refresh: () => void
}

export const ParentContext = createContext<ParentContextValue>({
  user: null,
  parent: null,
  student: null,
  status: 'idle',
  sidebarOpen: false,
  setSidebarOpen: () => {},
  refresh: () => {},
})

export function useParentPortal() {
  const ctx = useContext(ParentContext)
  if (!ctx.user || !ctx.student) {
    throw new Error('useParentPortal must be used within parent layout when ready')
  }
  return ctx as ParentContextValue & {
    user: EpicUser
    student: Student
    parent: ParentAccount | null
  }
}

export function useParentPortalOptional() {
  return useContext(ParentContext)
}
