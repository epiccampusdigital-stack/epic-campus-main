'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { isNavActive, navLinkClasses } from '@/lib/utils/nav'
import type { EpicUser, Role } from '@/types'

const NAV = [{ label: 'My Commissions', href: '/agent/commissions', icon: 'ti-coin' }]

export default function AgentPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<EpicUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
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
        if (role !== 'agent') {
          router.replace('/login')
          return
        }
        setUser({
          uid: firebaseUser.uid,
          email: data.email ?? firebaseUser.email ?? '',
          displayName: data.displayName ?? firebaseUser.displayName ?? '',
          role,
          branchId: data.branchId,
          locationAssigned: data.locationAssigned,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        })
      } catch {
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [router])

  async function handleLogout() {
    await fetch('/api/auth/session', { method: 'DELETE' })
    await signOut(auth)
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#eef2f7] dark:bg-[#080d18]">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  if (!user) return null

  const navContent = (
    <nav className="space-y-1 px-3 py-2 md:py-0">
      {NAV.map((item) => {
        const active = isNavActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className={navLinkClasses(active)}
          >
            <span className={`ti ${item.icon} text-[14px]`} aria-hidden="true" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#eef2f7] dark:bg-[#080d18]">
      <aside className="hidden w-[240px] shrink-0 border-r border-[#DDE3EC] bg-white dark:border-gray-700 dark:bg-gray-900 md:block">
        <div className="flex h-full flex-col p-4">
          <div className="mb-4 flex items-center gap-2">
            <img src="/favicon.png" alt="" className="h-8 w-8 rounded-md" />
            <div>
              <p className="text-sm font-bold text-[#0B3D6B] dark:text-white">EPIC Campus</p>
              <p className="text-xs text-[#5A6A7A]">Agent Portal</p>
            </div>
          </div>
          {navContent}
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-[240px] transform border-r border-[#DDE3EC] bg-white transition-transform dark:border-gray-700 dark:bg-gray-900 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4">{navContent}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#DDE3EC] bg-white/90 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="min-h-11 min-w-11 rounded-lg p-2 text-[#0B3D6B] hover:bg-[#F5F7FB] md:hidden dark:text-white"
              aria-label="Open menu"
            >
              <span className="ti ti-menu-2 text-xl" />
            </button>
            <span className="text-sm font-semibold text-[#0B3D6B] dark:text-white md:hidden">
              Agent Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[#5A6A7A] sm:inline dark:text-gray-400">
              {user.displayName}
            </span>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="min-h-11 rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm font-medium text-[#0B3D6B] hover:bg-[#F5F7FB] dark:border-gray-600 dark:text-white dark:hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
