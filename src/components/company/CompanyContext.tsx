'use client'

import { createContext, useContext } from 'react'
import type { EpicUser, PartnerCompany } from '@/types'

export type CompanyPortalStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

interface CompanyContextValue {
  user: EpicUser | null
  company: PartnerCompany | null
  status: CompanyPortalStatus
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  refresh: () => void
}

export const CompanyContext = createContext<CompanyContextValue>({
  user: null,
  company: null,
  status: 'idle',
  sidebarOpen: false,
  setSidebarOpen: () => {},
  refresh: () => {},
})

export function useCompanyPortal() {
  return useContext(CompanyContext)
}
