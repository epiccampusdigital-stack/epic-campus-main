'use client'

import { createContext, useContext } from 'react'
import type { EpicUser, Student } from '@/types'
import type { StudentEnrollmentType } from '@/lib/student/navTabs'

export type StudentPortalStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'profile_unavailable'

interface StudentContextValue {
  user: EpicUser | null
  student: Student | null
  status: StudentPortalStatus
  /** Resolved Account Activation gate — see src/lib/access/accountActivation.ts */
  isAccountActive: boolean
  /** Drives nav gating (see src/lib/student/navTabs.ts) — defaults to 'residential' when unset. */
  enrollmentType: StudentEnrollmentType
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  refreshStudent: () => void
}

export const StudentContext = createContext<StudentContextValue>({
  user: null,
  student: null,
  status: 'idle',
  isAccountActive: false,
  enrollmentType: 'residential',
  sidebarOpen: false,
  setSidebarOpen: () => {},
  refreshStudent: () => {},
})

export function useStudentPortal() {
  return useContext(StudentContext)
}
