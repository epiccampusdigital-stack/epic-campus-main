'use client'

import { useEffect, useState } from 'react'
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

        if (!ALLOWED_ROLES.includes(role)) {
          router.replace('/login')
          return
        }

        setUser({
          uid: firebaseUser.uid,
          email: data.email ?? firebaseUser.email ?? '',
          displayName: data.displayName ?? firebaseUser.displayName ?? '',
          role,
          branchId: data.branchId,
          studentId: data.studentId,
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F7FB]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
          <p className="font-inter text-sm text-[#5A6A7A]">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <ManagementContext.Provider
      value={{ user, loading, sidebarOpen, setSidebarOpen }}
    >
      <div className="flex h-screen overflow-hidden bg-[#F5F7FB] dark:bg-gray-900">
        <ManagementSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-[#F5F7FB] p-6 dark:bg-gray-900">
            {children}
          </main>
        </div>
      </div>
    </ManagementContext.Provider>
  )
}
