'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { getPartnerCompany } from '@/lib/partners/helpers'
import CompanySidebar from '@/components/company/CompanySidebar'
import { CompanyContext, type CompanyPortalStatus } from '@/components/company/CompanyContext'
import DarkModeToggle from '@/components/ui/DarkModeToggle'
import type { EpicUser, PartnerCompany } from '@/types'

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#eef2f7] dark:bg-[#080d18] transition-colors duration-300">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0B3D6B]/20 border-t-[#0B3D6B]" />
    </div>
  )
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<EpicUser | null>(null)
  const [company, setCompany] = useState<PartnerCompany | null>(null)
  const [status, setStatus] = useState<CompanyPortalStatus>('idle')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const refresh = useCallback(() => {
    setRefreshToken((t) => t + 1)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace('/login')
        return
      }

      setStatus('loading')

      try {
        const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (!userSnap.exists()) {
          router.replace('/login')
          return
        }

        const data = userSnap.data()
        if (String(data.role) !== 'company') {
          router.replace('/dashboard')
          return
        }

        const companyId = String(data.companyId ?? '')
        if (!companyId) {
          setStatus('unavailable')
          return
        }

        const profile = await getPartnerCompany(companyId)
        if (!profile || profile.status !== 'active') {
          setStatus('unavailable')
          return
        }

        setUser({
          uid: firebaseUser.uid,
          email: String(data.email ?? firebaseUser.email ?? ''),
          displayName: String(data.displayName ?? firebaseUser.displayName ?? ''),
          role: 'company',
          companyId,
          createdAt:
            data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        })
        setCompany(profile)
        setStatus('ready')
      } catch {
        setStatus('unavailable')
      }
    })

    return () => unsubscribe()
  }, [router, refreshToken])

  if (status === 'loading') return <LoadingScreen />

  if (status === 'unavailable') {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#eef2f7] dark:bg-[#080d18] px-6 text-center transition-colors duration-300">
        <p className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white/90">
          Company portal unavailable
        </p>
        <p className="mt-2 text-sm text-[#5A6A7A] dark:text-white/50">
          Contact Epic Campus to activate your partner account.
        </p>
      </div>
    )
  }

  if (status !== 'ready' || !user || !company) return <LoadingScreen />

  return (
    <CompanyContext.Provider
      value={{ user, company, status, sidebarOpen, setSidebarOpen, refresh }}
    >
      <div className="flex h-screen overflow-hidden bg-[#eef2f7] dark:bg-[#080d18] text-[#0D1B2A] dark:text-white/90 transition-colors duration-300 font-['DM_Sans']">
        <CompanySidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-[52px] items-center justify-between border-b border-white/80 dark:border-white/[0.05] bg-white/70 dark:bg-[#080d18]/75 backdrop-blur-xl px-4 sticky top-0 z-50 transition-all duration-300 md:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-[#0B3D6B] dark:text-white/70 hover:bg-[#0B3D6B]/[0.06] dark:hover:bg-white/[0.06] md:hidden"
              aria-label="Open menu"
            >
              <span className="ti ti-menu-2 text-xl" aria-hidden="true" />
            </button>
            <h1 className="font-jakarta text-[15px] font-semibold text-[#0D1B2A] dark:text-white/90">{company.name}</h1>
            <div className="w-8">
              <DarkModeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-[#eef2f7] dark:bg-[#080d18] p-4 md:p-6 transition-colors duration-300">{children}</main>
        </div>
      </div>
    </CompanyContext.Provider>
  )
}
