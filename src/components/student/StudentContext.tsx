'use client'

import { createContext, useContext } from 'react'
import type { EpicUser, Student } from '@/types'

export type StudentPortalStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'profile_unavailable'

interface StudentContextValue {
  user: EpicUser | null
  student: Student | null
  status: StudentPortalStatus
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  refreshStudent: () => void
}

export const StudentContext = createContext<StudentContextValue>({
  user: null,
  student: null,
  status: 'idle',
  sidebarOpen: false,
  setSidebarOpen: () => {},
  refreshStudent: () => {},
})

export function useStudentPortal() {
  return useContext(StudentContext)
}
