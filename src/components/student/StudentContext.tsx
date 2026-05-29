'use client'

import { createContext, useContext } from 'react'
import type { EpicUser, Student } from '@/types'

interface StudentContextValue {
  user: EpicUser | null
  student: Student | null
  loading: boolean
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  refreshStudent: () => void
  setRefreshStudent: (fn: () => void) => void
}

export const StudentContext = createContext<StudentContextValue>({
  user: null,
  student: null,
  loading: true,
  sidebarOpen: false,
  setSidebarOpen: () => {},
  refreshStudent: () => {},
  setRefreshStudent: () => {},
})

export function useStudentPortal() {
  return useContext(StudentContext)
}
