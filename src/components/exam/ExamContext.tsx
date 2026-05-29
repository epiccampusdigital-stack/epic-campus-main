'use client'

import { createContext, useContext } from 'react'
import type { EpicUser, Student } from '@/types'

interface ExamContextValue {
  user: EpicUser
  student: Student | null
}

export const ExamContext = createContext<ExamContextValue | null>(null)

export function useExamPortal() {
  const ctx = useContext(ExamContext)
  if (!ctx) throw new Error('useExamPortal must be used within ExamContext')
  return ctx
}
