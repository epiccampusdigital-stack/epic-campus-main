'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { useParentPortalOptional } from '@/components/parent/ParentContext'
import DarkModeToggle from '@/components/ui/DarkModeToggle'
import { isNavActive, navLinkClasses } from '@/lib/utils/nav'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/parent/dashboard', icon: 'ti-layout-dashboard' },
  { label: 'Payments', href: '/parent/payments', icon: 'ti-credit-card' },
  { label: 'Results', href: '/parent/results', icon: 'ti-certificate' },
  { label: 'Attendance', href: '/parent/attendance', icon: 'ti-calendar-check' },
  { label: 'Visa', href: '/parent/visa', icon: 'ti-plane' },
]

export default function ParentSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const ctx = useParentPortalOptional()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  async function handleSignOut() {
    await signOut(auth)
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {})
    router.replace('/login')
  }

  const studentName = ctx?.student?.name ?? 'Student'
  const parentName = ctx?.parent?.parentName ?? ctx?.user?.displayName ?? 'Parent'

  const sidebarContent = (
    <div className="flex h-full w-[240px] flex-col bg-white/60 dark:bg-[#0B3D6B]/20 backdrop-blur-2xl border-r border-white/80 dark:border-white/[0.06] transition-all duration-300">
      {/* Logo */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 px-2 py-1">
          <img src="/favicon.png" alt="EPIC Campus" className="h-7 w-7 rounded-md object-cover" />
          <span className="text-[14px] font-semibold text-[#0B3D6B] dark:text-[#E8A020] transition-colors duration-300">
            EPIC Campus
          </span>
        </div>
      </div>

      <div className="mx-4 border-t border-[#0B3D6B]/10 dark:border-white/[0.06]" />

      <div className="px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/30">
          Parent Portal
        </p>
        <p className="mt-0.5 truncate text-[12px] font-bold text-[#0B3D6B] dark:text-white/90">{parentName}</p>
        <p className="truncate text-[11px] text-[#E8A020]">{studentName}</p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = mounted && isNavActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => ctx?.setSidebarOpen(false)}
              className={navLinkClasses(active)}
            >
              <span className={`ti ${item.icon} text-[14px]`} aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mx-4 border-t border-[#0B3D6B]/10 dark:border-white/[0.06]" />

      <div className="p-3">
        <div className="flex items-center gap-2 px-1">
          <DarkModeToggle />
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex flex-1 items-center gap-2 rounded-[9px] px-[10px] py-[8px] text-[12px] font-medium text-gray-500 dark:text-white/45 transition-all duration-200 hover:bg-[#0B3D6B]/[0.06] dark:hover:bg-white/[0.05] hover:text-[#0B3D6B] dark:hover:text-white/70"
          >
            <span className="ti ti-logout text-[14px]" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {ctx?.sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden"
          aria-label="Close menu"
          onClick={() => ctx.setSidebarOpen(false)}
        />
      )}

      <aside className="hidden shrink-0 md:block">{sidebarContent}</aside>

      <aside
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 md:hidden ${
          ctx?.sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
