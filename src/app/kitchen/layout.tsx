'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import DarkModeToggle from '@/components/ui/DarkModeToggle'
import KitchenBottomNav from '@/components/kitchen/KitchenBottomNav'
import { isNavActive, navLinkClasses } from '@/lib/utils/nav'
import { KitchenContext } from '@/app/kitchen/context'
import type { EpicUser } from '@/types'

// Kitchen staff see operations only — no finance/cost reports, payments, or admin items.
const NAV = [
  { label: 'Dashboard', href: '/kitchen/dashboard', icon: 'ti-home' },
  { label: 'Inventory', href: '/kitchen/inventory', icon: 'ti-package' },
  { label: 'Meal Log', href: '/kitchen/meal-log', icon: 'ti-soup' },
  { label: 'Daily Menus', href: '/kitchen/menus', icon: 'ti-book-2' },
  { label: 'Waste Tracker', href: '/kitchen/waste', icon: 'ti-trash' },
  { label: 'Stock Changes', href: '/kitchen/stock-changes', icon: 'ti-history' },
  { label: 'Order Requests', href: '/kitchen/orders', icon: 'ti-clipboard-list' },
]

function KitchenSidebar({
  user,
  sidebarOpen,
  setSidebarOpen,
}: {
  user: EpicUser | null
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  async function handleLogout() {
    await fetch('/api/auth/session', { method: 'DELETE' })
    await signOut(auth)
    router.replace('/login')
  }

  const content = (
    <div className="flex h-full w-[240px] flex-col border-r border-white/80 bg-white/60 backdrop-blur-2xl transition-all duration-300 dark:border-white/[0.06] dark:bg-[#0B3D6B]/20">
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 px-2 py-1">
          <img src="/favicon.png" alt="EPIC Campus" className="h-7 w-7 rounded-md object-cover" />
          <div>
            <p className="text-[13px] font-semibold text-[#0B3D6B] transition-colors duration-300 dark:text-[#E8A020]">
              EPIC Campus
            </p>
            <p className="text-[10px] text-gray-400 dark:text-white/40">Kitchen · Ahangama</p>
          </div>
        </div>
      </div>
      <div className="mx-4 border-t border-[#0B3D6B]/10 dark:border-white/[0.06]" />
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {NAV.map((item) => {
          const active = mounted && isNavActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={navLinkClasses(active)}
            >
              <span className={`ti ${item.icon} text-[14px] leading-none`} aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="mx-4 border-t border-[#0B3D6B]/10 dark:border-white/[0.06]" />
      <div className="p-3">
        {user && (
          <div className="mb-2 px-1">
            <p className="truncate text-[12px] font-medium text-[#0B3D6B] dark:text-white/80">
              {user.displayName}
            </p>
            <span className="mt-0.5 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
              Kitchen Staff
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 px-1">
          <DarkModeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-[44px] flex-1 items-center gap-2 rounded-[9px] px-[10px] py-[8px] text-[12px] font-medium text-gray-500 transition-all duration-200 hover:bg-[#0B3D6B]/[0.06] hover:text-[#0B3D6B] dark:text-white/45 dark:hover:bg-white/[0.05] dark:hover:text-white/70"
          >
            <span className="ti ti-logout text-[14px]" aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null

  return (
    <>
      <aside className="hidden shrink-0 md:block">{content}</aside>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content}
      </aside>
    </>
  )
}

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
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
        if (data.role !== 'kitchen' && data.role !== 'admin' && data.role !== 'owner') {
          router.replace('/login')
          return
        }
        setUser({
          uid: firebaseUser.uid,
          email: String(data.email ?? firebaseUser.email ?? ''),
          displayName: String(data.displayName ?? firebaseUser.displayName ?? ''),
          role: data.role,
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#eef2f7] transition-colors duration-300 dark:bg-[#080d18]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
          <p className="text-sm text-[#5A6A7A] dark:text-white/50">Loading kitchen portal…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <KitchenContext.Provider value={{ user, sidebarOpen, setSidebarOpen }}>
      <div className="flex h-screen overflow-hidden bg-[#eef2f7] font-['DM_Sans'] transition-colors duration-300 dark:bg-[#080d18]">
        <KitchenSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-50 flex h-[52px] shrink-0 items-center justify-between border-b border-white/80 bg-white/70 px-4 backdrop-blur-xl transition-all duration-300 dark:border-white/[0.05] dark:bg-[#080d18]/75 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[#0B3D6B] hover:bg-[#0B3D6B]/[0.06] dark:text-white/70 dark:hover:bg-white/[0.06] md:hidden"
                aria-label="Open menu"
              >
                <span className="ti ti-menu-2 text-xl" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[#0D1B2A] dark:text-white/90">
                  Kitchen Portal
                </p>
                <p className="hidden text-[11px] text-[#5A6A7A] dark:text-white/40 sm:block">
                  Ahangama Main Campus
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:block">
                <DarkModeToggle />
              </div>
              {user && (
                <div className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white">
                  {user.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#eef2f7] p-4 pb-20 transition-colors duration-300 dark:bg-[#080d18] md:pb-6 sm:p-6">
            <div className="mx-auto max-w-full">{children}</div>
          </main>
        </div>
        <KitchenBottomNav />
      </div>
    </KitchenContext.Provider>
  )
}
