'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { MANAGEMENT_ROLES } from '@/lib/constants/roles'
import type { EpicUser, Role } from '@/types'
import ManagementSidebar from '@/components/layout/ManagementSidebar'
import TopBar from '@/components/layout/TopBar'
import { ManagementContext } from '@/components/layout/ManagementContext'

const ALLOWED_ROLES = MANAGEMENT_ROLES as Role[]

export default function ManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<EpicUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace('/login')
        return
      }

      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (!snap.exists()) {
          router.replace('/login')
          return
        }

        const data = snap.data()
        const role = data.role as Role
        const roles: Role[] = Array.isArray(data.roles) && data.roles.length > 0
          ? (data.roles as Role[])
          : [role]

        if (!roles.some((r) => ALLOWED_ROLES.includes(r))) {
          // Kitchen staff have their own portal — send them there, not to login.
          router.replace(roles.includes('kitchen' as Role) ? '/kitchen/dashboard' : '/login')
          return
        }

        setUser({
          uid: firebaseUser.uid,
          email: data.email ?? firebaseUser.email ?? '',
          displayName: data.displayName ?? firebaseUser.displayName ?? '',
          role,
          roles,
          branchId: data.branchId,
          locationAssigned: data.locationAssigned
            ? (String(data.locationAssigned) as EpicUser['locationAssigned'])
            : undefined,
          studentId: data.studentId,
          showFinances: data.showFinances === true,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        })
      } catch {
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  const hasRole = useCallback(
    (role: Role) => (user?.roles ?? (user ? [user.role] : [])).includes(role),
    [user],
  )

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#eef2f7] dark:bg-[#080d18] transition-colors duration-300">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
          <p className="font-inter text-sm text-[#5A6A7A] dark:text-white/50">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <ManagementContext.Provider
      value={{ user, loading, sidebarOpen, setSidebarOpen, hasRole }}
    >
      <div className="flex h-screen overflow-hidden bg-[#eef2f7] dark:bg-[#080d18] transition-colors duration-300 font-['DM_Sans']">
        <ManagementSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-[#eef2f7] dark:bg-[#080d18] p-6 transition-colors duration-300">
            {children}
          </main>
        </div>
      </div>
    </ManagementContext.Provider>
  )
}
